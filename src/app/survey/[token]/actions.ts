"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { generateAndStoreSurveyPdf, serializeAnswersPatch, SURVEY_PHOTOS_BUCKET } from "@/data/boiler-survey-service";
import { mapBoilerPropertyDetails } from "@/data/quotes-mappers";
import { formatDateTime } from "@/lib/format";
import type { BoilerSurveyAnswers, PhotoChecklistItemKey } from "@/types/boiler-survey";
import type { BoilerPropertyDetails } from "@/types/boiler-quote";

/**
 * The on-site survey is generally more accurate than whatever was guessed at
 * quote time — every submit carries the fields the two share forward onto
 * the quote's own "Property details" card (`BoilerPropertyCard.tsx`). Only
 * overwrites a field the surveyor actually answered; anything left blank on
 * the survey leaves the existing quote-side value alone. Fields with no
 * shared meaning (e.g. `mprn`, or survey-only fields like `radiators`) are
 * left untouched — see `boiler-survey-fields.ts`'s field-overlap notes.
 */
function applySurveyToPropertyDetails(
  current: BoilerPropertyDetails,
  answers: BoilerSurveyAnswers,
): BoilerPropertyDetails {
  const gasSupplyConfirmed: "Yes" | "No" =
    answers.existingGasSupply === "Yes" || answers.existingGasSupply === "No"
      ? answers.existingGasSupply
      : current.gasSupplyConfirmed;

  return {
    ...current,
    propertyType: answers.propertyType.trim() || current.propertyType,
    bedrooms: answers.bedrooms ?? current.bedrooms,
    bathrooms: answers.bathrooms ?? current.bathrooms,
    currentBoilerType: answers.currentBoilerType.trim() || current.currentBoilerType,
    currentBoilerAge: answers.currentBoilerAge.trim() || current.currentBoilerAge,
    boilerLocation: answers.currentBoilerLocation.trim() || current.boilerLocation,
    gasSupplyConfirmed,
    accessNotes: answers.accessNotes.trim() || current.accessNotes,
  };
}

/**
 * Mutations for the public, unauthenticated `/survey/[token]` form. Every
 * function here re-looks-up the survey by `access_token` and uses the
 * service-role client (see `src/lib/supabase/service.ts`) — there is no
 * portal session to authenticate these requests, by design.
 */

async function findSurveyByToken(token: string) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("boiler_surveys")
    .select("id, quote_id")
    .eq("access_token", token)
    .maybeSingle();
  if (error) console.error("findSurveyByToken failed", error);
  return data as { id: string; quote_id: string } | null;
}

export async function submitBoilerSurvey(
  token: string,
  answers: BoilerSurveyAnswers,
): Promise<{ ok: boolean; error?: string }> {
  const survey = await findSurveyByToken(token);
  if (!survey) return { ok: false, error: "This survey link is no longer valid." };

  const supabase = createServiceRoleClient();
  const submittedAt = new Date().toISOString();
  const { error } = await supabase
    .from("boiler_surveys")
    .update({ ...serializeAnswersPatch(answers), status: "submitted", submitted_at: submittedAt })
    .eq("id", survey.id);

  if (error) {
    console.error("submitBoilerSurvey failed", error);
    return { ok: false, error: "Could not save the survey. Please try again." };
  }

  // Best-effort — rebuilds the "Download survey PDF" artifact from the
  // just-saved answers/photos. A failure here doesn't fail the submission
  // itself (see `generateAndStoreSurveyPdf`'s doc comment).
  await generateAndStoreSurveyPdf(supabase, {
    surveyId: survey.id,
    quoteId: survey.quote_id,
    answers,
    submittedAtLabel: formatDateTime(submittedAt),
  });

  const { data: quote } = await supabase
    .from("quotes")
    .select("customer_name, property_details")
    .eq("id", survey.quote_id)
    .maybeSingle();
  const customerName = quote?.customer_name ?? "";

  // Best-effort, same as the PDF regeneration above — a hiccup here shouldn't fail the submission.
  if (quote) {
    const updatedDetails = applySurveyToPropertyDetails(mapBoilerPropertyDetails(quote.property_details), answers);
    const { error: propertyError } = await supabase
      .from("quotes")
      .update({ property_details: updatedDetails })
      .eq("id", survey.quote_id);
    if (propertyError) console.error("submitBoilerSurvey: updating property details failed", propertyError);
  }

  const description = `${answers.surveyorName || "The surveyor"} submitted the pre-installation survey`;
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

  revalidatePath(`/quotes/${survey.quote_id}`);
  return { ok: true };
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export async function uploadSurveyPhoto(
  token: string,
  itemKey: PhotoChecklistItemKey,
  formData: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const survey = await findSurveyByToken(token);
  if (!survey) return { ok: false, error: "This survey link is no longer valid." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No photo selected." };
  if (!file.type.startsWith("image/")) return { ok: false, error: "Please choose a photo." };

  const supabase = createServiceRoleClient();
  const extension = EXTENSION_BY_MIME[file.type] ?? "jpg";
  const storagePath = `${survey.id}/${itemKey}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(SURVEY_PHOTOS_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("uploadSurveyPhoto failed", uploadError);
    return { ok: false, error: "Could not upload the photo. Please try again." };
  }

  const { error: upsertError } = await supabase
    .from("boiler_survey_photos")
    .upsert(
      { survey_id: survey.id, item_key: itemKey, storage_path: storagePath, uploaded_at: new Date().toISOString() },
      { onConflict: "survey_id,item_key" },
    );

  if (upsertError) {
    console.error("uploadSurveyPhoto upsert failed", upsertError);
    return { ok: false, error: "Could not save the photo. Please try again." };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(SURVEY_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (signError || !signed) {
    console.error("createSignedUrl failed", signError);
    return { ok: false, error: "Photo uploaded but couldn't be previewed — refresh to see it." };
  }

  revalidatePath(`/quotes/${survey.quote_id}`);
  return { ok: true, url: signed.signedUrl };
}

export async function removeSurveyPhoto(
  token: string,
  itemKey: PhotoChecklistItemKey,
): Promise<{ ok: boolean; error?: string }> {
  const survey = await findSurveyByToken(token);
  if (!survey) return { ok: false, error: "This survey link is no longer valid." };

  const supabase = createServiceRoleClient();
  const { data: photo } = await supabase
    .from("boiler_survey_photos")
    .select("storage_path")
    .eq("survey_id", survey.id)
    .eq("item_key", itemKey)
    .maybeSingle();

  if (photo?.storage_path) {
    await supabase.storage.from(SURVEY_PHOTOS_BUCKET).remove([photo.storage_path]);
  }
  await supabase.from("boiler_survey_photos").delete().eq("survey_id", survey.id).eq("item_key", itemKey);

  revalidatePath(`/quotes/${survey.quote_id}`);
  return { ok: true };
}
