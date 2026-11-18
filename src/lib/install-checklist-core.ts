import "server-only";
import { revalidatePath } from "next/cache";
import { getAllProfiles } from "@/data/profiles-service";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { signChecklistPhotoUrl, type ChecklistPhoto } from "@/data/solar-install-checklist-service";
import { SOLAR_SURVEY_BUCKET } from "@/lib/solar-survey-bucket";
import { logActivity } from "@/lib/activity";
import { notifyUser } from "@/lib/notify";
import {
  CHECKLIST_IMAGE_TYPES,
  CHECKLIST_ITEMS,
  CHECKLIST_MAX_PHOTO_BYTES,
  CHECKLIST_STAGES,
  canEditChecklistItem,
  countStageCompleted,
  getChecklistItem,
  type ChecklistEditorRole,
  type ChecklistStage,
} from "@/lib/solar-install-checklist";

/**
 * The install photo checklist's mutations, shared by the two ways in:
 * the signed-in installer/electrician (`src/app/jobs/checklist-actions.ts`)
 * and the no-login share link (`src/app/checklist/[token]/actions.ts`).
 * Each caller authorises first and hands over a `ChecklistActor`; the item
 * rules (an electrician only edits electrical items) live here so both
 * paths enforce exactly the same thing. Not a "use server" file — these are
 * never callable from the browser directly.
 */

export interface ChecklistActor {
  role: ChecklistEditorRole;
  /** Null when acting through the share link (no signed-in user). */
  userId: string | null;
  /** Shown in history, the activity feed and notifications, e.g. "Sam" or "Installer (via link)". */
  name: string;
  customerName: string;
}

export type ChecklistResult = { ok: true } | { ok: false; error: string };

const NOT_YOUR_ITEM = "That item is filled in by the installer.";

export async function getOrCreateChecklistId(quoteId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase.from("solar_install_checklists").select("id").eq("quote_id", quoteId).maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase.from("solar_install_checklists").insert({ quote_id: quoteId }).select("id").single();
  if (error || !data) {
    // Lost a race with a parallel upload that created it first.
    const { data: again } = await supabase.from("solar_install_checklists").select("id").eq("quote_id", quoteId).maybeSingle();
    if (!again) console.error("getOrCreateChecklistId failed", error);
    return again?.id ?? null;
  }
  return data.id;
}

/** Any edit to a stage after it was sent un-sends that stage (and so the whole checklist) so it has to be re-submitted for the admins to re-check. */
async function touchChecklist(checklistId: string, stage: ChecklistStage, extra: Record<string, unknown> = {}): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("solar_install_checklists").select("submitted_stages").eq("id", checklistId).single();
  const stages = { ...((data?.submitted_stages as Record<string, unknown> | null) ?? {}) };
  delete stages[stage];
  await supabase
    .from("solar_install_checklists")
    .update({ status: "draft", submitted_stages: stages, updated_at: new Date().toISOString(), ...extra })
    .eq("id", checklistId);
}

function safeExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : "jpg";
}

function revalidateChecklist(quoteId: string): void {
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath(`/jobs/${quoteId}`);
}

/** Step 1 of an upload: validates the item/type and hands the browser a one-shot signed upload token. */
export async function createPhotoUploadUrl(
  quoteId: string,
  actor: ChecklistActor,
  itemKey: string,
  fileId: string,
  fileName: string,
  contentType: string,
): Promise<{ ok: boolean; path?: string; uploadToken?: string; error?: string }> {
  if (!getChecklistItem(itemKey)) return { ok: false, error: "Unknown checklist item." };
  if (!canEditChecklistItem(actor.role, itemKey)) return { ok: false, error: NOT_YOUR_ITEM };
  if (!CHECKLIST_IMAGE_TYPES.includes(contentType.toLowerCase())) return { ok: false, error: "Only photos can be added here." };
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return { ok: false, error: "Invalid file id." };

  const checklistId = await getOrCreateChecklistId(quoteId);
  if (!checklistId) return { ok: false, error: "Could not start the upload. Please try again." };

  const supabase = createServiceRoleClient();
  const path = `solar-install/${checklistId}/${itemKey}/${fileId}.${safeExtension(fileName)}`;
  const { data, error } = await supabase.storage.from(SOLAR_SURVEY_BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) {
    console.error("createPhotoUploadUrl failed", error);
    return { ok: false, error: "Could not start the upload. Please try again." };
  }
  return { ok: true, path, uploadToken: data.token };
}

/** Step 2: records the uploaded object against the item and returns a preview URL. */
export async function registerPhoto(
  quoteId: string,
  actor: ChecklistActor,
  itemKey: string,
  fileId: string,
  path: string,
  fileName: string,
  contentType: string,
  sizeBytes: number,
): Promise<{ ok: boolean; photo?: ChecklistPhoto; error?: string }> {
  if (!getChecklistItem(itemKey)) return { ok: false, error: "Unknown checklist item." };
  if (!canEditChecklistItem(actor.role, itemKey)) return { ok: false, error: NOT_YOUR_ITEM };
  if (!CHECKLIST_IMAGE_TYPES.includes(contentType.toLowerCase())) return { ok: false, error: "Only photos can be added here." };
  if (Number.isFinite(sizeBytes) && sizeBytes > CHECKLIST_MAX_PHOTO_BYTES) return { ok: false, error: "That photo is too large." };

  const checklistId = await getOrCreateChecklistId(quoteId);
  if (!checklistId) return { ok: false, error: "Could not save the photo. Please try again." };
  // The path must be the one `createPhotoUploadUrl` would have issued for this checklist/item/file.
  if (!path.startsWith(`solar-install/${checklistId}/${itemKey}/${fileId}.`)) return { ok: false, error: "Invalid upload." };

  const supabase = createServiceRoleClient();
  const uploadedAt = new Date().toISOString();
  const { error } = await supabase.from("solar_install_checklist_photos").upsert(
    {
      id: fileId,
      checklist_id: checklistId,
      item_key: itemKey,
      storage_path: path,
      file_name: fileName.slice(0, 200),
      content_type: contentType,
      size_bytes: Number.isFinite(sizeBytes) ? sizeBytes : null,
      uploaded_by: actor.userId,
      uploaded_role: actor.role,
      uploaded_at: uploadedAt,
    },
    { onConflict: "id" },
  );
  if (error) {
    console.error("registerPhoto failed", error);
    return { ok: false, error: "Could not save the photo. Please try again." };
  }

  // A photo means the item applies — drop any earlier "N/A".
  const { data: checklist } = await supabase.from("solar_install_checklists").select("na_items").eq("id", checklistId).single();
  const naItems = ((checklist?.na_items as string[] | null) ?? []).filter((key) => key !== itemKey);
  await touchChecklist(checklistId, getChecklistItem(itemKey)!.stage, { na_items: naItems });

  const url = await signChecklistPhotoUrl(path);
  revalidateChecklist(quoteId);
  return { ok: true, photo: { id: fileId, itemKey, fileName, url: url ?? "", uploadedAt } };
}

export async function removePhoto(quoteId: string, actor: ChecklistActor, photoId: string): Promise<ChecklistResult> {
  const checklistId = await getOrCreateChecklistId(quoteId);
  if (!checklistId) return { ok: false, error: "Checklist not found." };

  const supabase = createServiceRoleClient();
  // Filtered by checklist id so a photo id from another job can't be removed through this one.
  const { data: photo } = await supabase
    .from("solar_install_checklist_photos")
    .select("storage_path, item_key, uploaded_by, uploaded_role")
    .eq("id", photoId)
    .eq("checklist_id", checklistId)
    .maybeSingle();
  if (!photo) return { ok: false, error: "Photo not found." };
  if (!canEditChecklistItem(actor.role, photo.item_key)) return { ok: false, error: NOT_YOUR_ITEM };
  // An electrician can only take back photos an electrician added; the installer can clear any.
  if (actor.role === "electrician" && photo.uploaded_role !== "electrician" && (!actor.userId || photo.uploaded_by !== actor.userId)) {
    return { ok: false, error: "You can only remove photos the electrician added." };
  }

  await supabase.storage.from(SOLAR_SURVEY_BUCKET).remove([photo.storage_path]);
  await supabase.from("solar_install_checklist_photos").delete().eq("id", photoId).eq("checklist_id", checklistId);
  await touchChecklist(checklistId, getChecklistItem(photo.item_key)?.stage ?? "pre");

  revalidateChecklist(quoteId);
  return { ok: true };
}

export async function setItemNotApplicable(
  quoteId: string,
  actor: ChecklistActor,
  itemKey: string,
  notApplicable: boolean,
): Promise<ChecklistResult> {
  if (!getChecklistItem(itemKey)) return { ok: false, error: "Unknown checklist item." };
  if (!canEditChecklistItem(actor.role, itemKey)) return { ok: false, error: NOT_YOUR_ITEM };

  const checklistId = await getOrCreateChecklistId(quoteId);
  if (!checklistId) return { ok: false, error: "Could not save that. Please try again." };

  const supabase = createServiceRoleClient();
  const { data: checklist } = await supabase.from("solar_install_checklists").select("na_items").eq("id", checklistId).single();
  const current = new Set((checklist?.na_items as string[] | null) ?? []);
  if (notApplicable) current.add(itemKey);
  else current.delete(itemKey);

  await touchChecklist(checklistId, getChecklistItem(itemKey)!.stage, { na_items: [...current] });
  revalidateChecklist(quoteId);
  return { ok: true };
}

/** Sends one stage (pre / mid / post) of the checklist to every admin to check. Allowed while incomplete — the notification says how far through the stage is. */
export async function submitStage(quoteId: string, actor: ChecklistActor, stage: ChecklistStage): Promise<ChecklistResult> {
  const stageInfo = CHECKLIST_STAGES.find((s) => s.stage === stage);
  if (!stageInfo) return { ok: false, error: "Unknown stage." };

  const checklistId = await getOrCreateChecklistId(quoteId);
  if (!checklistId) return { ok: false, error: "Could not submit. Please try again." };

  const supabase = createServiceRoleClient();
  const [{ data: checklist }, { data: photoRows }] = await Promise.all([
    supabase.from("solar_install_checklists").select("na_items, submitted_stages").eq("id", checklistId).single(),
    supabase.from("solar_install_checklist_photos").select("item_key").eq("checklist_id", checklistId),
  ]);
  const stageKeys = new Set(CHECKLIST_ITEMS.filter((item) => item.stage === stage).map((item) => item.key));
  const stagePhotoKeys = (photoRows ?? []).map((row) => row.item_key).filter((key) => stageKeys.has(key));
  if (stagePhotoKeys.length === 0) return { ok: false, error: `Add at least one ${stageInfo.title.toLowerCase()} photo before submitting.` };

  const { done, total } = countStageCompleted(stage, stagePhotoKeys, (checklist?.na_items as string[] | null) ?? []);

  const now = new Date().toISOString();
  const stages = { ...((checklist?.submitted_stages as Record<string, unknown> | null) ?? {}), [stage]: { at: now, by: actor.userId, role: actor.role } };
  const allSent = CHECKLIST_STAGES.every((s) => stages[s.stage]);
  const { error } = await supabase
    .from("solar_install_checklists")
    .update({
      submitted_stages: stages,
      status: allSent ? "submitted" : "draft",
      submitted_at: now,
      submitted_by: actor.userId,
      updated_at: now,
    })
    .eq("id", checklistId);
  if (error) {
    console.error("submitStage failed", error);
    return { ok: false, error: "Could not submit. Please try again." };
  }

  const summary = `${done} of ${total} items complete, ${stagePhotoKeys.length} photo${stagePhotoKeys.length === 1 ? "" : "s"}`;
  const description = `${actor.name} submitted the ${stageInfo.title.toLowerCase()} photos (${summary})`;
  const admins = (await getAllProfiles()).filter((profile) => profile.role === "admin");
  await Promise.all([
    supabase.from("quote_history").insert({ quote_id: quoteId, actor_id: actor.userId, is_system: actor.userId === null, description }),
    logActivity({
      actorId: actor.userId ?? undefined,
      customerName: actor.customerName,
      description: `${description} — ${actor.customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
      asService: actor.userId === null,
    }),
    ...admins.map((admin) =>
      notifyUser({
        userId: admin.id,
        title: `${stageInfo.title} photos submitted`,
        body: `${actor.name} submitted the ${stageInfo.title.toLowerCase()} photos for ${actor.customerName}'s install — ${summary}. Open the quote to check them.`,
        link: `/quotes/${quoteId}`,
        asService: actor.userId === null,
      }),
    ),
  ]);

  revalidateChecklist(quoteId);
  return { ok: true };
}
