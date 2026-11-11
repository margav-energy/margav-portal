"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/data/current-user";
import { logActivity } from "@/lib/activity";
import {
  createEasyPvProject,
  EasyPvError,
  fetchEasyPvSummary,
  isEasyPvConfigured,
  listEasyPvProjects,
} from "@/data/easypv-service";
import { applyNewestDesignPhoto, clearEasyPvFiles, getEasyPvFiles, setQuotePhotoFromEasyPvFile, syncEasyPvFiles } from "@/data/easypv-files-service";
import { parseSkipPages } from "@/lib/proposal-pages";
import type { EasyPvFile, EasyPvProjectOption, EasyPvSummary } from "@/types/easypv";

/**
 * Server Actions behind the solar quote's "Easy PV" card. Staff only: admins
 * for any quote, reps for their own (same rule as the quote pages). The
 * Easy PV key never leaves the server — see src/data/easypv-service.ts.
 */

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

interface QuoteRow {
  id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  address: string | null;
  postcode: string | null;
  reference: string | null;
  product_type: string;
  representative_id: string | null;
  easypv_project_id: number | null;
}

/** Loads the quote and checks the caller may act on it. */
async function authorise(quoteId: string): Promise<{ quote: QuoteRow; userId: string } | { error: string }> {
  if (!isEasyPvConfigured()) return { error: "Easy PV isn't set up on this server yet." };
  const user = await getCurrentUser();
  if (!user || user.role === "installer") return { error: "Not allowed." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select(
      "id, customer_name, customer_email, customer_phone, address, postcode, reference, product_type, representative_id, easypv_project_id",
    )
    .eq("id", quoteId)
    .maybeSingle();
  const quote = data as QuoteRow | null;
  // Same answer for "doesn't exist" and "not yours".
  if (!quote || quote.product_type !== "solar") return { error: "Quote not found." };
  if (user.role === "rep" && quote.representative_id !== user.id) return { error: "Quote not found." };
  return { quote, userId: user.id };
}

/** Pulls the design images + proposal PDF. Never fails the caller (the summary is the main result) — a failure just leaves the previous copies. */
async function syncFiles(quoteId: string, projectId: number): Promise<EasyPvFile[]> {
  try {
    await syncEasyPvFiles(quoteId, projectId);
    await applyNewestDesignPhoto(quoteId);
    revalidatePath(`/quotes/${quoteId}`);
  } catch (error) {
    console.error("easypv syncFiles failed", error);
  }
  return getEasyPvFiles(quoteId);
}

function message(error: unknown): string {
  return error instanceof EasyPvError ? error.message : "Something went wrong talking to Easy PV.";
}

async function saveLink(quoteId: string, projectId: number | null, summary: EasyPvSummary | null): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes")
    .update({
      easypv_project_id: projectId,
      easypv_summary: summary,
      easypv_synced_at: summary ? new Date().toISOString() : null,
    })
    .eq("id", quoteId);
  if (error) {
    console.error("easypv saveLink failed", error);
    return false;
  }
  revalidatePath(`/quotes/${quoteId}`);
  return true;
}

async function record(quoteId: string, userId: string, customerName: string, description: string): Promise<void> {
  const supabase = await createClient();
  await Promise.all([
    supabase.from("quote_history").insert({ quote_id: quoteId, actor_id: userId, is_system: false, description }),
    logActivity({
      actorId: userId,
      customerName,
      description: `${description} — ${customerName}`,
      status: "allocated",
      entityType: "quote_easypv",
      entityId: quoteId,
    }),
  ]);
}

/** Creates a new Easy PV project from the quote's customer details and links it. */
export async function createEasyPvProjectForQuote(quoteId: string): Promise<ActionResult<{ projectId: number }>> {
  const auth = await authorise(quoteId);
  if ("error" in auth) return { ok: false, error: auth.error };
  const { quote, userId } = auth;
  if (quote.easypv_project_id) return { ok: false, error: "This quote is already linked to an Easy PV project." };

  try {
    const projectId = await createEasyPvProject({
      customerName: quote.customer_name,
      customerEmail: quote.customer_email ?? undefined,
      customerPhone: quote.customer_phone ?? undefined,
      address: quote.address ?? "",
      postcode: quote.postcode ?? "",
      crmReference: quote.reference || quote.id,
    });
    if (!(await saveLink(quoteId, projectId, null))) {
      return { ok: false, error: `Created in Easy PV (project ${projectId}) but couldn't save the link — link it manually.` };
    }
    await record(quoteId, userId, quote.customer_name, "Easy PV project created");
    return { ok: true, projectId };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/** Projects the portal's Easy PV account can see, filtered by a search string, for the "Link existing project" picker. */
export async function searchEasyPvProjects(
  quoteId: string,
  query: string,
): Promise<ActionResult<{ projects: EasyPvProjectOption[] }>> {
  const auth = await authorise(quoteId);
  if ("error" in auth) return { ok: false, error: auth.error };
  try {
    const needle = query.trim().toLowerCase();
    const all = await listEasyPvProjects();
    const projects = (
      needle
        ? all.filter((p) => [p.projectName, p.customerName, p.address, p.postcode].some((field) => field.toLowerCase().includes(needle)))
        : all
    ).slice(0, 20);
    return { ok: true, projects };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/** Links an existing Easy PV project and pulls its summary straight away. */
export async function linkEasyPvProject(
  quoteId: string,
  projectId: number,
): Promise<ActionResult<{ summary: EasyPvSummary; files: EasyPvFile[] }>> {
  const auth = await authorise(quoteId);
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!Number.isInteger(projectId) || projectId <= 0) return { ok: false, error: "Invalid project." };
  try {
    const summary = await fetchEasyPvSummary(projectId);
    if (!(await saveLink(quoteId, projectId, summary))) return { ok: false, error: "Couldn't save the link." };
    await record(quoteId, auth.userId, auth.quote.customer_name, `Easy PV project ${projectId} linked`);
    return { ok: true, summary, files: await syncFiles(quoteId, projectId) };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/** "Refresh from Easy PV" — re-reads the linked project's design. */
export async function refreshEasyPvSummary(
  quoteId: string,
): Promise<ActionResult<{ summary: EasyPvSummary; files: EasyPvFile[] }>> {
  const auth = await authorise(quoteId);
  if ("error" in auth) return { ok: false, error: auth.error };
  const projectId = auth.quote.easypv_project_id ? Number(auth.quote.easypv_project_id) : 0;
  if (!projectId) return { ok: false, error: "No Easy PV project is linked." };
  try {
    const summary = await fetchEasyPvSummary(projectId);
    if (!(await saveLink(quoteId, projectId, summary))) return { ok: false, error: "Couldn't save the refreshed design." };
    return { ok: true, summary, files: await syncFiles(quoteId, projectId) };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

export async function unlinkEasyPvProject(quoteId: string): Promise<ActionResult> {
  const auth = await authorise(quoteId);
  if ("error" in auth) return { ok: false, error: auth.error };
  // Drop the stored proposal/design copies first — otherwise the old project's proposal would still be locked into the next quote sent.
  if (!(await clearEasyPvFiles(quoteId))) return { ok: false, error: "Couldn't unlink." };
  const supabase = await createClient();
  const { error: resetError } = await supabase
    .from("quotes")
    .update({ easypv_proposal_skip_pages: null, easypv_photo_name: null, easypv_markup_pct: null, easypv_items_imported_at: null })
    .eq("id", quoteId);
  if (resetError) console.error("unlinkEasyPvProject reset failed", resetError);
  if (!(await saveLink(quoteId, null, null))) return { ok: false, error: "Couldn't unlink." };
  await record(quoteId, auth.userId, auth.quote.customer_name, "Easy PV project unlinked");
  return { ok: true };
}

/** "Use as quote image" on a design view — replaces the quote's solar design image. */
export async function setQuoteImageFromEasyPv(quoteId: string, fileId: string): Promise<ActionResult> {
  const auth = await authorise(quoteId);
  if ("error" in auth) return { ok: false, error: auth.error };
  if (!(await setQuotePhotoFromEasyPvFile(quoteId, fileId))) return { ok: false, error: "Couldn't use that image." };
  await record(quoteId, auth.userId, auth.quote.customer_name, "Solar design image set from Easy PV");
  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true };
}

/**
 * Which pages of the Easy PV proposal to leave out of the quote sent to the
 * customer — normally Easy PV's own "Quote" page (and anything else priced at
 * Midsummer's cost), which the portal's quote sheet replaces. Free text like
 * "9" or "9-11, 14"; stored as typed once it parses.
 */
export async function saveProposalSkipPages(quoteId: string, text: string): Promise<ActionResult<{ pages: number[] }>> {
  const auth = await authorise(quoteId);
  if ("error" in auth) return { ok: false, error: auth.error };

  const trimmed = text.trim();
  const pages = parseSkipPages(trimmed);
  if (trimmed && pages.length === 0) return { ok: false, error: "Enter page numbers like 9 or 9-11, 14." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes")
    .update({ easypv_proposal_skip_pages: trimmed || null })
    .eq("id", quoteId);
  if (error) {
    console.error("saveProposalSkipPages failed", error);
    return { ok: false, error: "Couldn't save that." };
  }
  await record(
    quoteId,
    auth.userId,
    auth.quote.customer_name,
    pages.length ? `Easy PV proposal pages left out of the quote: ${trimmed}` : "Easy PV proposal: no pages left out",
  );
  revalidatePath(`/quotes/${quoteId}`);
  return { ok: true, pages };
}
