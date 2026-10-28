"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { signSolarSurveyFileUrl } from "@/data/solar-survey-service";
import { SOLAR_SURVEY_BUCKET } from "@/lib/solar-survey-bucket";
import { formatDateTime } from "@/lib/format";
import { findMissingRequired, getSolarFileItem, isContentTypeAllowed } from "@/lib/solar-survey-fields";
import { formatSolarSurveyAnswers } from "@/lib/solar-survey-format";
import { buildPropertyPatchFromSurvey } from "@/lib/solar-survey-property";
import { normalizeSolarSurveyAnswers, type SolarSurveyAnswers } from "@/types/solar-survey";

/**
 * Mutations for the public, unauthenticated solar `/survey/[token]` form.
 * Same model as `./actions.ts` (the boiler survey): every function re-looks-up
 * the survey by `access_token` and uses the service-role client — there is no
 * portal session to authenticate these requests, by design.
 *
 * Files never pass through a Server Action: videos routinely exceed the 25MB
 * body limit, so the browser uploads straight to Storage using a signed
 * upload URL from `createSolarUploadUrl`, then calls `registerSolarFile` to
 * record it.
 */

async function findSurveyByToken(token: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.from("solar_surveys").select("id, quote_id").eq("access_token", token).maybeSingle();
  if (error) console.error("solar findSurveyByToken failed", error);
  return data as { id: string; quote_id: string } | null;
}

/** Strips anything that isn't safe in a storage object name; the original name is kept separately for display. */
function safeExtension(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return /^[a-z0-9]{1,5}$/.test(extension) ? extension : "bin";
}

/** Merges the survey's answers over the quote's existing `property_details` — only the fields the survey covers, and only ones actually answered. Returns whether anything was written. */
async function populatePropertyDetails(
  supabase: ReturnType<typeof createServiceRoleClient>,
  quoteId: string,
  existing: unknown,
  answers: SolarSurveyAnswers,
): Promise<boolean> {
  const patch = buildPropertyPatchFromSurvey(answers);
  if (Object.keys(patch).length === 0) return false;

  const current = existing && typeof existing === "object" ? (existing as Record<string, unknown>) : {};
  const { error } = await supabase
    .from("quotes")
    .update({ property_details: { ...current, ...patch } })
    .eq("id", quoteId);

  if (error) {
    console.error("populatePropertyDetails failed", error);
    return false;
  }
  return true;
}

export async function saveSolarSurvey(
  token: string,
  rawAnswers: SolarSurveyAnswers,
  submit: boolean,
): Promise<{ ok: boolean; error?: string; missing?: string[] }> {
  const survey = await findSurveyByToken(token);
  if (!survey) return { ok: false, error: "This survey link is no longer valid." };

  // Re-normalised so only known keys/strings reach the database, whatever the client sent.
  const answers = formatSolarSurveyAnswers(normalizeSolarSurveyAnswers(rawAnswers));
  const supabase = createServiceRoleClient();

  if (submit) {
    const { data: fileRows } = await supabase.from("solar_survey_files").select("item_key").eq("survey_id", survey.id);
    const uploaded = new Set((fileRows ?? []).map((row: { item_key: string }) => row.item_key));
    const missing = findMissingRequired(answers, uploaded);
    if (missing.length > 0) {
      return { ok: false, error: "Some required items are still missing.", missing };
    }
  }

  const submittedAt = new Date().toISOString();
  const { error } = await supabase
    .from("solar_surveys")
    .update({
      answers,
      updated_at: submittedAt,
      ...(submit ? { status: "submitted", submitted_at: submittedAt } : {}),
    })
    .eq("id", survey.id);

  if (error) {
    console.error("saveSolarSurvey failed", error);
    return { ok: false, error: "Could not save the survey. Please try again." };
  }

  if (submit) {
    const { data: quote } = await supabase
      .from("quotes")
      .select("customer_name, is_locked, property_details")
      .eq("id", survey.quote_id)
      .maybeSingle();
    const customerName = quote?.customer_name ?? "";

    // Copy what the customer told us into the quote's Property details. Skipped on a locked quote, like every other property edit (see `isQuoteLocked`).
    const populated =
      !quote?.is_locked && (await populatePropertyDetails(supabase, survey.quote_id, quote?.property_details, answers));

    const description = `${answers.completedBy || "The customer"} submitted the pre-installation survey (${formatDateTime(submittedAt)})${populated ? " — property details updated from the survey" : ""}`;
    await Promise.all([
      supabase.from("quote_history").insert({ quote_id: survey.quote_id, is_system: true, description }),
      supabase.from("activities").insert({
        is_system: true,
        customer_name: customerName,
        description: `${description} — ${customerName}`,
        status: "allocated",
        entity_type: "quote",
        entity_id: survey.quote_id,
      }),
    ]);
  }

  revalidatePath(`/quotes/${survey.quote_id}`);
  return { ok: true };
}

/** Step 1 of an upload: validates the item/type and hands the browser a one-shot signed upload URL token. */
export async function createSolarUploadUrl(
  token: string,
  itemKey: string,
  fileId: string,
  fileName: string,
  contentType: string,
): Promise<{ ok: boolean; path?: string; uploadToken?: string; error?: string }> {
  const survey = await findSurveyByToken(token);
  if (!survey) return { ok: false, error: "This survey link is no longer valid." };

  const item = getSolarFileItem(itemKey);
  if (!item) return { ok: false, error: "Unknown upload slot." };
  if (!isContentTypeAllowed(item.kind, contentType)) {
    return { ok: false, error: "That file type isn't accepted here." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return { ok: false, error: "Invalid file id." };

  const supabase = createServiceRoleClient();
  const path = `solar/${survey.id}/${itemKey}/${fileId}.${safeExtension(fileName)}`;
  const { data, error } = await supabase.storage.from(SOLAR_SURVEY_BUCKET).createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    console.error("createSolarUploadUrl failed", error);
    return { ok: false, error: "Could not start the upload. Please try again." };
  }
  return { ok: true, path, uploadToken: data.token };
}

/** Step 2 of an upload: records the now-uploaded object and returns a preview URL. */
export async function registerSolarFile(
  token: string,
  itemKey: string,
  fileId: string,
  path: string,
  fileName: string,
  contentType: string,
  sizeBytes: number,
): Promise<{ ok: boolean; file?: { id: string; url: string; uploadedAt: string }; error?: string }> {
  const survey = await findSurveyByToken(token);
  if (!survey) return { ok: false, error: "This survey link is no longer valid." };
  if (!getSolarFileItem(itemKey)) return { ok: false, error: "Unknown upload slot." };
  // The path must be the one `createSolarUploadUrl` would have issued for this survey/item/file.
  if (!path.startsWith(`solar/${survey.id}/${itemKey}/${fileId}.`)) return { ok: false, error: "Invalid upload." };

  const supabase = createServiceRoleClient();
  const uploadedAt = new Date().toISOString();
  const { error } = await supabase.from("solar_survey_files").upsert(
    {
      id: fileId,
      survey_id: survey.id,
      item_key: itemKey,
      storage_path: path,
      file_name: fileName.slice(0, 200),
      content_type: contentType,
      size_bytes: Number.isFinite(sizeBytes) ? sizeBytes : null,
      uploaded_at: uploadedAt,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("registerSolarFile failed", error);
    return { ok: false, error: "Could not save the file. Please try again." };
  }

  const url = await signSolarSurveyFileUrl(supabase, path);
  revalidatePath(`/quotes/${survey.quote_id}`);
  return { ok: true, file: { id: fileId, url: url ?? "", uploadedAt } };
}

export async function removeSolarFile(token: string, fileId: string): Promise<{ ok: boolean; error?: string }> {
  const survey = await findSurveyByToken(token);
  if (!survey) return { ok: false, error: "This survey link is no longer valid." };

  const supabase = createServiceRoleClient();
  const { data: file } = await supabase
    .from("solar_survey_files")
    .select("storage_path")
    .eq("id", fileId)
    .eq("survey_id", survey.id)
    .maybeSingle();

  if (file?.storage_path) {
    await supabase.storage.from(SOLAR_SURVEY_BUCKET).remove([file.storage_path]);
  }
  await supabase.from("solar_survey_files").delete().eq("id", fileId).eq("survey_id", survey.id);

  revalidatePath(`/quotes/${survey.quote_id}`);
  return { ok: true };
}
