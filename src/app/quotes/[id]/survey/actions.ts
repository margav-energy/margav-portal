"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/data/current-user";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { SOLAR_SURVEY_BUCKET } from "@/lib/solar-survey-bucket";
import { getSolarFileItem } from "@/lib/solar-survey-fields";

/**
 * Deletes one uploaded file from a solar survey — backs the delete button in
 * the portal's survey gallery. Staff only; a rep can only touch quotes
 * assigned to them (same rule as `getSolarSurveyBundle`). Removes the stored
 * object and its row, then leaves a trail in the quote history and the
 * Activity Feed, since this is irreversible.
 */
export async function deleteSolarSurveyFile(
  quoteId: string,
  fileId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role === "installer") return { ok: false, error: "You don't have permission to do that." };

  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("representative_id, customer_name")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) return { ok: false, error: "Quote not found." };
  if (user.role === "rep" && quote.representative_id !== user.id) return { ok: false, error: "Quote not found." };

  const { data: survey } = await supabase.from("solar_surveys").select("id").eq("quote_id", quoteId).maybeSingle();
  if (!survey) return { ok: false, error: "Survey not found." };

  // Filtered by survey id as well, so a file id from another quote's survey can't be deleted through this one.
  const { data: file } = await supabase
    .from("solar_survey_files")
    .select("id, item_key, storage_path, file_name")
    .eq("id", fileId)
    .eq("survey_id", survey.id)
    .maybeSingle();
  if (!file) return { ok: false, error: "File not found." };

  const { error: storageError } = await supabase.storage.from(SOLAR_SURVEY_BUCKET).remove([file.storage_path]);
  if (storageError) {
    console.error("deleteSolarSurveyFile: storage remove failed", storageError);
    return { ok: false, error: "Could not delete the file. Please try again." };
  }

  const { error: deleteError } = await supabase.from("solar_survey_files").delete().eq("id", file.id).eq("survey_id", survey.id);
  if (deleteError) {
    console.error("deleteSolarSurveyFile: row delete failed", deleteError);
    return { ok: false, error: "Could not delete the file. Please try again." };
  }

  const itemLabel = getSolarFileItem(file.item_key)?.label ?? file.item_key;
  const description = `${user.firstName} deleted a survey file (${itemLabel}: ${file.file_name || "file"})`;
  await Promise.all([
    supabase.from("quote_history").insert({ quote_id: quoteId, actor_id: user.id, is_system: false, description }),
    logActivity({
      actorId: user.id,
      customerName: quote.customer_name ?? "",
      description: `${description} — ${quote.customer_name ?? ""}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath(`/quotes/${quoteId}/survey`);
  revalidatePath(`/quotes/${quoteId}/survey/gallery`);
  return { ok: true };
}
