"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/data/current-user";
import { getAllProfiles } from "@/data/profiles-service";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { signChecklistPhotoUrl, type ChecklistPhoto } from "@/data/solar-install-checklist-service";
import { SOLAR_SURVEY_BUCKET } from "@/lib/solar-survey-bucket";
import { logActivity } from "@/lib/activity";
import { notifyUser } from "@/lib/notify";
import {
  CHECKLIST_IMAGE_TYPES,
  CHECKLIST_MAX_PHOTO_BYTES,
  countCompleted,
  getChecklistItem,
} from "@/lib/solar-install-checklist";

/**
 * Server actions behind the installer's photo checklist
 * (src/components/jobs/InstallerChecklistCard.tsx). Every one first checks
 * the job is a solar quote assigned to the calling installer who has
 * accepted it, then works through the service-role client (the browser
 * uploads straight to Storage with a one-shot signed URL — see
 * `createChecklistPhotoUploadUrl`).
 */

type Result = { ok: true } | { ok: false; error: string };

interface OwnedJob {
  userId: string;
  firstName: string;
  customerName: string;
}

async function requireAcceptedSolarJob(quoteId: string): Promise<{ job: OwnedJob } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role !== "installer") return { error: "Only installers can fill in the checklist." };

  const supabase = createServiceRoleClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("customer_name, installer_id, product_type, install_acceptance_status")
    .eq("id", quoteId)
    .maybeSingle();

  if (!quote || quote.installer_id !== user.id || quote.product_type !== "solar") {
    return { error: "This job isn't assigned to you." };
  }
  if (quote.install_acceptance_status !== "accepted") {
    return { error: "Accept the job before filling in the checklist." };
  }
  return { job: { userId: user.id, firstName: user.firstName, customerName: quote.customer_name } };
}

async function getOrCreateChecklistId(quoteId: string): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase
    .from("solar_install_checklists")
    .select("id")
    .eq("quote_id", quoteId)
    .maybeSingle();
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

/** Any edit after a submission puts the checklist back to "draft" so it has to be re-submitted for the admins to re-check. */
async function touchChecklist(checklistId: string, extra: Record<string, unknown> = {}): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase
    .from("solar_install_checklists")
    .update({ status: "draft", updated_at: new Date().toISOString(), ...extra })
    .eq("id", checklistId);
}

function safeExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : "jpg";
}

/** Step 1 of an upload: validates the item/type and hands the browser a one-shot signed upload token. */
export async function createChecklistPhotoUploadUrl(
  quoteId: string,
  itemKey: string,
  fileId: string,
  fileName: string,
  contentType: string,
): Promise<{ ok: boolean; path?: string; uploadToken?: string; error?: string }> {
  const auth = await requireAcceptedSolarJob(quoteId);
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!getChecklistItem(itemKey)) return { ok: false, error: "Unknown checklist item." };
  if (!CHECKLIST_IMAGE_TYPES.includes(contentType.toLowerCase())) return { ok: false, error: "Only photos can be added here." };
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return { ok: false, error: "Invalid file id." };

  const checklistId = await getOrCreateChecklistId(quoteId);
  if (!checklistId) return { ok: false, error: "Could not start the upload. Please try again." };

  const supabase = createServiceRoleClient();
  const path = `solar-install/${checklistId}/${itemKey}/${fileId}.${safeExtension(fileName)}`;
  const { data, error } = await supabase.storage.from(SOLAR_SURVEY_BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error || !data) {
    console.error("createChecklistPhotoUploadUrl failed", error);
    return { ok: false, error: "Could not start the upload. Please try again." };
  }
  return { ok: true, path, uploadToken: data.token };
}

/** Step 2: records the uploaded object against the item and returns a preview URL. */
export async function registerChecklistPhoto(
  quoteId: string,
  itemKey: string,
  fileId: string,
  path: string,
  fileName: string,
  contentType: string,
  sizeBytes: number,
): Promise<{ ok: boolean; photo?: ChecklistPhoto; error?: string }> {
  const auth = await requireAcceptedSolarJob(quoteId);
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!getChecklistItem(itemKey)) return { ok: false, error: "Unknown checklist item." };
  if (Number.isFinite(sizeBytes) && sizeBytes > CHECKLIST_MAX_PHOTO_BYTES) return { ok: false, error: "That photo is too large." };

  const checklistId = await getOrCreateChecklistId(quoteId);
  if (!checklistId) return { ok: false, error: "Could not save the photo. Please try again." };
  // The path must be the one `createChecklistPhotoUploadUrl` would have issued for this checklist/item/file.
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
      uploaded_by: auth.job.userId,
      uploaded_at: uploadedAt,
    },
    { onConflict: "id" },
  );
  if (error) {
    console.error("registerChecklistPhoto failed", error);
    return { ok: false, error: "Could not save the photo. Please try again." };
  }

  // A photo means the item applies — drop any earlier "N/A".
  const { data: checklist } = await supabase.from("solar_install_checklists").select("na_items").eq("id", checklistId).single();
  const naItems = ((checklist?.na_items as string[] | null) ?? []).filter((key) => key !== itemKey);
  await touchChecklist(checklistId, { na_items: naItems });

  const url = await signChecklistPhotoUrl(path);
  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true, photo: { id: fileId, itemKey, fileName, url: url ?? "", uploadedAt } };
}

export async function removeChecklistPhoto(quoteId: string, photoId: string): Promise<Result> {
  const auth = await requireAcceptedSolarJob(quoteId);
  if ("error" in auth) return { ok: false, error: auth.error };

  const checklistId = await getOrCreateChecklistId(quoteId);
  if (!checklistId) return { ok: false, error: "Checklist not found." };

  const supabase = createServiceRoleClient();
  // Filtered by checklist id so a photo id from another job can't be removed through this one.
  const { data: photo } = await supabase
    .from("solar_install_checklist_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("checklist_id", checklistId)
    .maybeSingle();
  if (!photo) return { ok: false, error: "Photo not found." };

  await supabase.storage.from(SOLAR_SURVEY_BUCKET).remove([photo.storage_path]);
  await supabase.from("solar_install_checklist_photos").delete().eq("id", photoId).eq("checklist_id", checklistId);
  await touchChecklist(checklistId);

  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true };
}

export async function setChecklistItemNotApplicable(quoteId: string, itemKey: string, notApplicable: boolean): Promise<Result> {
  const auth = await requireAcceptedSolarJob(quoteId);
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!getChecklistItem(itemKey)) return { ok: false, error: "Unknown checklist item." };

  const checklistId = await getOrCreateChecklistId(quoteId);
  if (!checklistId) return { ok: false, error: "Could not save that. Please try again." };

  const supabase = createServiceRoleClient();
  const { data: checklist } = await supabase.from("solar_install_checklists").select("na_items").eq("id", checklistId).single();
  const current = new Set((checklist?.na_items as string[] | null) ?? []);
  if (notApplicable) current.add(itemKey);
  else current.delete(itemKey);

  await touchChecklist(checklistId, { na_items: [...current] });
  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true };
}

/** Sends the checklist to every admin to check. Allowed while incomplete — the notification says how far through it is. */
export async function submitInstallChecklist(quoteId: string): Promise<Result> {
  const auth = await requireAcceptedSolarJob(quoteId);
  if ("error" in auth) return { ok: false, error: auth.error };
  const { job } = auth;

  const checklistId = await getOrCreateChecklistId(quoteId);
  if (!checklistId) return { ok: false, error: "Could not submit. Please try again." };

  const supabase = createServiceRoleClient();
  const [{ data: checklist }, { data: photoRows }] = await Promise.all([
    supabase.from("solar_install_checklists").select("na_items").eq("id", checklistId).single(),
    supabase.from("solar_install_checklist_photos").select("item_key").eq("checklist_id", checklistId),
  ]);
  const photoCount = photoRows?.length ?? 0;
  if (photoCount === 0) return { ok: false, error: "Add at least one photo before submitting." };

  const { done, total } = countCompleted(
    (photoRows ?? []).map((row) => row.item_key),
    (checklist?.na_items as string[] | null) ?? [],
  );

  const { error } = await supabase
    .from("solar_install_checklists")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      submitted_by: job.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", checklistId);
  if (error) {
    console.error("submitInstallChecklist failed", error);
    return { ok: false, error: "Could not submit. Please try again." };
  }

  const summary = `${done} of ${total} items complete, ${photoCount} photo${photoCount === 1 ? "" : "s"}`;
  const description = `${job.firstName} submitted the install photo checklist (${summary})`;
  const admins = (await getAllProfiles()).filter((profile) => profile.role === "admin");
  await Promise.all([
    supabase.from("quote_history").insert({ quote_id: quoteId, actor_id: job.userId, is_system: false, description }),
    logActivity({
      actorId: job.userId,
      customerName: job.customerName,
      description: `${description} — ${job.customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
    ...admins.map((admin) =>
      notifyUser({
        userId: admin.id,
        title: "Install photo checklist submitted",
        body: `${job.firstName} submitted the photo checklist for ${job.customerName}'s install — ${summary}. Open the quote to check it.`,
        link: `/quotes/${quoteId}`,
      }),
    ),
  ]);

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath(`/jobs/${quoteId}`);
  return { ok: true };
}
