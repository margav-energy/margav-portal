import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { SOLAR_SURVEY_BUCKET } from "@/lib/solar-survey-bucket";

/**
 * Reads the solar install photo checklist (supabase/migrations/0044_*.sql).
 * Uses the service-role client for the photo list and signed URLs, so
 * callers MUST have authorised the request first: an installer who's
 * assigned to the quote (src/app/jobs/[id]/page.tsx) or staff who can open
 * it (src/app/quotes/[id]/page.tsx).
 */

export interface ChecklistPhoto {
  id: string;
  itemKey: string;
  fileName: string;
  /** Signed, expires after an hour. */
  url: string;
  uploadedAt: string;
}

export interface SolarInstallChecklist {
  /** Absent until the installer first touches the checklist. */
  id?: string;
  status: "draft" | "submitted";
  /** Item keys marked N/A. */
  naItems: string[];
  submittedAt?: string;
  submittedByName?: string;
  photos: ChecklistPhoto[];
}

export const EMPTY_CHECKLIST: SolarInstallChecklist = { status: "draft", naItems: [], photos: [] };

export async function signChecklistPhotoUrl(storagePath: string): Promise<string | undefined> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage.from(SOLAR_SURVEY_BUCKET).createSignedUrl(storagePath, 60 * 60);
  if (error || !data) {
    console.error("signChecklistPhotoUrl failed", storagePath, error);
    return undefined;
  }
  return data.signedUrl;
}

export async function getSolarInstallChecklist(quoteId: string): Promise<SolarInstallChecklist> {
  const supabase = createServiceRoleClient();

  const { data: row, error } = await supabase
    .from("solar_install_checklists")
    .select("id, status, na_items, submitted_at, submitted_by")
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (error) console.error("getSolarInstallChecklist failed", error);
  if (!row) return EMPTY_CHECKLIST;

  const [{ data: photoRows, error: photosError }, submitter] = await Promise.all([
    supabase
      .from("solar_install_checklist_photos")
      .select("id, item_key, storage_path, file_name, uploaded_at")
      .eq("checklist_id", row.id)
      .order("uploaded_at", { ascending: true }),
    row.submitted_by
      ? supabase.from("profiles").select("full_name").eq("id", row.submitted_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (photosError) console.error("getSolarInstallChecklist: photos failed", photosError);

  const photos = (
    await Promise.all(
      (photoRows ?? []).map(async (photo): Promise<ChecklistPhoto | null> => {
        const url = await signChecklistPhotoUrl(photo.storage_path);
        if (!url) return null;
        return {
          id: photo.id,
          itemKey: photo.item_key,
          fileName: photo.file_name,
          url,
          uploadedAt: photo.uploaded_at,
        };
      }),
    )
  ).filter((photo): photo is ChecklistPhoto => photo !== null);

  return {
    id: row.id,
    status: row.status === "submitted" ? "submitted" : "draft",
    naItems: Array.isArray(row.na_items) ? (row.na_items as string[]) : [],
    submittedAt: row.submitted_at ?? undefined,
    submittedByName: (submitter.data as { full_name?: string } | null)?.full_name || undefined,
    photos,
  };
}

export interface ChecklistPhotoBytes {
  id: string;
  itemKey: string;
  fileName: string;
  bytes: Buffer;
}

/** Downloads the photos for a quote's checklist (service role — authorise the caller first). Optionally limited to item keys. */
export async function loadChecklistPhotoBytes(quoteId: string, itemKeys?: string[]): Promise<ChecklistPhotoBytes[]> {
  const supabase = createServiceRoleClient();
  const { data: checklist } = await supabase.from("solar_install_checklists").select("id").eq("quote_id", quoteId).maybeSingle();
  if (!checklist) return [];

  let query = supabase
    .from("solar_install_checklist_photos")
    .select("id, item_key, storage_path, file_name")
    .eq("checklist_id", checklist.id)
    .order("uploaded_at", { ascending: true });
  if (itemKeys) query = query.in("item_key", itemKeys);
  const { data: rows, error } = await query;
  if (error) {
    console.error("loadChecklistPhotoBytes failed", error);
    return [];
  }

  const files = await Promise.all(
    (rows ?? []).map(async (row): Promise<ChecklistPhotoBytes | null> => {
      const { data, error: downloadError } = await supabase.storage.from(SOLAR_SURVEY_BUCKET).download(row.storage_path);
      if (downloadError || !data) {
        console.error("loadChecklistPhotoBytes: download failed", row.storage_path, downloadError);
        return null;
      }
      return { id: row.id, itemKey: row.item_key, fileName: row.file_name || row.id, bytes: Buffer.from(await data.arrayBuffer()) };
    }),
  );
  return files.filter((file): file is ChecklistPhotoBytes => file !== null);
}
