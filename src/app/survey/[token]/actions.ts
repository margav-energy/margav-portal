"use server";

import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { serializeAnswersPatch, SURVEY_PHOTOS_BUCKET } from "@/data/boiler-survey-service";
import type { BoilerSurveyAnswers, PhotoChecklistItemKey } from "@/types/boiler-survey";

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
  const { error } = await supabase
    .from("boiler_surveys")
    .update({ ...serializeAnswersPatch(answers), status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", survey.id);

  if (error) {
    console.error("submitBoilerSurvey failed", error);
    return { ok: false, error: "Could not save the survey. Please try again." };
  }

  const { data: quote } = await supabase.from("quotes").select("customer_name").eq("id", survey.quote_id).maybeSingle();
  const customerName = quote?.customer_name ?? "";
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
