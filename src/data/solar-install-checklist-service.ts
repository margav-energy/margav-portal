import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { SOLAR_SURVEY_BUCKET } from "@/lib/solar-survey-bucket";
import { CHECKLIST_STAGES, type ChecklistStage } from "@/lib/solar-install-checklist";

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
  /** "submitted" once every stage has been sent. */
  status: "draft" | "submitted";
  /** Stages currently sent to the office (editing a stage un-sends it). */
  submittedStages: Partial<Record<ChecklistStage, { at: string; byName?: string }>>;
  /** Item keys marked N/A. */
  naItems: string[];
  submittedAt?: string;
  submittedByName?: string;
  photos: ChecklistPhoto[];
}

export const EMPTY_CHECKLIST: SolarInstallChecklist = { status: "draft", submittedStages: {}, naItems: [], photos: [] };

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
    .select("id, status, na_items, submitted_at, submitted_by, submitted_stages")
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (error) console.error("getSolarInstallChecklist failed", error);
  if (!row) return EMPTY_CHECKLIST;

  const rawStages = (row.submitted_stages ?? {}) as Record<string, { at?: string; by?: string } | undefined>;
  const submitterIds = [...new Set([row.submitted_by, ...Object.values(rawStages).map((s) => s?.by)].filter((id): id is string => !!id))];

  const [{ data: photoRows, error: photosError }, { data: submitters }] = await Promise.all([
    supabase
      .from("solar_install_checklist_photos")
      .select("id, item_key, storage_path, file_name, uploaded_at")
      .eq("checklist_id", row.id)
      .order("uploaded_at", { ascending: true }),
    submitterIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", submitterIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
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

  const names = new Map((submitters ?? []).map((p) => [p.id, p.full_name || undefined]));
  const submittedStages: SolarInstallChecklist["submittedStages"] = {};
  for (const { stage } of CHECKLIST_STAGES) {
    const entry = rawStages[stage];
    if (entry?.at) submittedStages[stage] = { at: entry.at, byName: entry.by ? names.get(entry.by) : undefined };
  }

  return {
    id: row.id,
    status: row.status === "submitted" ? "submitted" : "draft",
    submittedStages,
    naItems: Array.isArray(row.na_items) ? (row.na_items as string[]) : [],
    submittedAt: row.submitted_at ?? undefined,
    submittedByName: row.submitted_by ? names.get(row.submitted_by) : undefined,
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

  // A few at a time: dozens of phone photos downloaded at once can exhaust a serverless function's memory.
  const list = rows ?? [];
  const files: (ChecklistPhotoBytes | null)[] = new Array(list.length).fill(null);
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < list.length; i = next++) {
      const row = list[i];
      const { data, error: downloadError } = await supabase.storage.from(SOLAR_SURVEY_BUCKET).download(row.storage_path);
      if (downloadError || !data) {
        console.error("loadChecklistPhotoBytes: download failed", row.storage_path, downloadError);
        continue;
      }
      files[i] = ({ id: row.id, itemKey: row.item_key, fileName: row.file_name || row.id, bytes: Buffer.from(await data.arrayBuffer()) });
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return files.filter((file): file is ChecklistPhotoBytes => file !== null);
}
