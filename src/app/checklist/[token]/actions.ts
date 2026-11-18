"use server";

import { findQuoteIdByChecklistToken } from "@/data/solar-install-checklist-service";
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
import type { ChecklistEditorRole, ChecklistStage } from "@/lib/solar-install-checklist";

/**
 * Mutations for the public, unauthenticated `/checklist/[token]` form - the
 * install photo checklist opened from the office's share link (same model as
 * the survey's `/survey/[token]` actions). Every call re-looks-up the quote
 * by the unguessable token and uses the service-role client. There is no
 * signed-in user, so the person picks "Installer" or "Electrician" on the
 * page and that role is passed in; it only decides which items they may
 * edit (an electrician: the electrical ones), exactly as for logged-in users.
 */

const ROLE_LABELS: Record<ChecklistEditorRole, string> = { installer: "Installer", electrician: "Electrician" };

function parseRole(role: string): ChecklistEditorRole | null {
  return role === "installer" || role === "electrician" ? role : null;
}

async function resolveActor(token: string, rawRole: string): Promise<{ quoteId: string; actor: ChecklistActor } | { error: string }> {
  const role = parseRole(rawRole);
  if (!role) return { error: "Choose whether you're the installer or the electrician first." };

  const quoteId = await findQuoteIdByChecklistToken(token);
  if (!quoteId) return { error: "This checklist link is no longer valid." };

  const supabase = createServiceRoleClient();
  const { data: quote } = await supabase.from("quotes").select("customer_name, product_type").eq("id", quoteId).maybeSingle();
  if (!quote || quote.product_type !== "solar") return { error: "This checklist link is no longer valid." };

  return { quoteId, actor: { role, userId: null, name: `${ROLE_LABELS[role]} (via link)`, customerName: quote.customer_name } };
}

export async function createLinkChecklistUploadUrl(
  token: string,
  role: string,
  itemKey: string,
  fileId: string,
  fileName: string,
  contentType: string,
): Promise<{ ok: boolean; path?: string; uploadToken?: string; error?: string }> {
  const resolved = await resolveActor(token, role);
  if ("error" in resolved) return { ok: false, error: resolved.error };
  return createPhotoUploadUrl(resolved.quoteId, resolved.actor, itemKey, fileId, fileName, contentType);
}

export async function registerLinkChecklistPhoto(
  token: string,
  role: string,
  itemKey: string,
  fileId: string,
  path: string,
  fileName: string,
  contentType: string,
  sizeBytes: number,
): Promise<{ ok: boolean; photo?: ChecklistPhoto; error?: string }> {
  const resolved = await resolveActor(token, role);
  if ("error" in resolved) return { ok: false, error: resolved.error };
  return registerPhoto(resolved.quoteId, resolved.actor, itemKey, fileId, path, fileName, contentType, sizeBytes);
}

export async function removeLinkChecklistPhoto(token: string, role: string, photoId: string): Promise<ChecklistResult> {
  const resolved = await resolveActor(token, role);
  if ("error" in resolved) return { ok: false, error: resolved.error };
  return removePhoto(resolved.quoteId, resolved.actor, photoId);
}

export async function setLinkChecklistItemNotApplicable(token: string, role: string, itemKey: string, notApplicable: boolean): Promise<ChecklistResult> {
  const resolved = await resolveActor(token, role);
  if ("error" in resolved) return { ok: false, error: resolved.error };
  return setItemNotApplicable(resolved.quoteId, resolved.actor, itemKey, notApplicable);
}

export async function submitLinkChecklistStage(token: string, role: string, stage: ChecklistStage): Promise<ChecklistResult> {
  const resolved = await resolveActor(token, role);
  if ("error" in resolved) return { ok: false, error: resolved.error };
  return submitStage(resolved.quoteId, resolved.actor, stage);
}
