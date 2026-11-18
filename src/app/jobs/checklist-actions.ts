"use server";

import { getCurrentUser } from "@/data/current-user";
import { isFieldRole } from "@/lib/roles";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { ChecklistPhoto } from "@/data/solar-install-checklist-service";
import {
  createPhotoUploadUrl,
  registerPhoto,
  removePhoto,
  setItemNotApplicable,
  submitStage,
  type ChecklistActor,
  type ChecklistResult,
} from "@/lib/install-checklist-core";
import type { ChecklistStage } from "@/lib/solar-install-checklist";

/**
 * Server actions behind the signed-in install photo checklist
 * (src/components/jobs/InstallerChecklistCard.tsx), used by the job's
 * installer and its electrician (who can only touch electrical items - see
 * `canEditChecklistItem`). Every one first checks the job is a solar quote
 * assigned to the calling installer/electrician and accepted by *them*, then
 * hands over to the shared core (src/lib/install-checklist-core.ts), which
 * is also what the no-login share link uses (src/app/checklist/[token]).
 */

async function requireAcceptedSolarJob(quoteId: string): Promise<{ actor: ChecklistActor } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (!isFieldRole(user.role)) return { error: "Only installers and electricians can fill in the checklist." };

  const supabase = createServiceRoleClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("customer_name, installer_id, electrician_id, product_type, install_acceptance_status, electrician_acceptance_status")
    .eq("id", quoteId)
    .maybeSingle();

  const assignedId = user.role === "installer" ? quote?.installer_id : quote?.electrician_id;
  if (!quote || assignedId !== user.id || quote.product_type !== "solar") {
    return { error: "This job isn't assigned to you." };
  }
  // Each role needs to have accepted the job themselves - the electrician's acceptance is separate from the installer's.
  const accepted = user.role === "installer" ? quote.install_acceptance_status : quote.electrician_acceptance_status;
  if (accepted !== "accepted") return { error: "Accept the job before filling in the checklist." };

  const name = user.role === "electrician" ? `${user.firstName} (electrician)` : user.firstName;
  return { actor: { role: user.role, userId: user.id, name, customerName: quote.customer_name } };
}

export async function createChecklistPhotoUploadUrl(
  quoteId: string,
  itemKey: string,
  fileId: string,
  fileName: string,
  contentType: string,
): Promise<{ ok: boolean; path?: string; uploadToken?: string; error?: string }> {
  const auth = await requireAcceptedSolarJob(quoteId);
  if ("error" in auth) return { ok: false, error: auth.error };
  return createPhotoUploadUrl(quoteId, auth.actor, itemKey, fileId, fileName, contentType);
}

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
  return registerPhoto(quoteId, auth.actor, itemKey, fileId, path, fileName, contentType, sizeBytes);
}

export async function removeChecklistPhoto(quoteId: string, photoId: string): Promise<ChecklistResult> {
  const auth = await requireAcceptedSolarJob(quoteId);
  if ("error" in auth) return { ok: false, error: auth.error };
  return removePhoto(quoteId, auth.actor, photoId);
}

export async function setChecklistItemNotApplicable(quoteId: string, itemKey: string, notApplicable: boolean): Promise<ChecklistResult> {
  const auth = await requireAcceptedSolarJob(quoteId);
  if ("error" in auth) return { ok: false, error: auth.error };
  return setItemNotApplicable(quoteId, auth.actor, itemKey, notApplicable);
}

/** Sends one stage (pre / mid / post) of the checklist to every admin to check. */
export async function submitInstallChecklistStage(quoteId: string, stage: ChecklistStage): Promise<ChecklistResult> {
  const auth = await requireAcceptedSolarJob(quoteId);
  if ("error" in auth) return { ok: false, error: auth.error };
  return submitStage(quoteId, auth.actor, stage);
}
