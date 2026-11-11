import "server-only";
import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { SOLAR_SURVEY_BUCKET } from "@/lib/solar-survey-bucket";
import { parseSkipPages } from "@/lib/proposal-pages";

/**
 * The Easy PV customer proposal that goes out as the quote — see
 * supabase/migrations/0046_easypv_files.sql for where the PDF is stored and
 * src/lib/esignature/compose-proposal.ts for how the portal's own quote sheet
 * replaces its Quote page. Uses the service-role client, so callers MUST have
 * authorised the request for this quote first (a staff user who can open it,
 * or a valid signing token for `readLockedProposal`).
 */

/** The signed-documents bucket name (kept here, not imported from signature-service, to avoid a circular import). */
const SIGNED_DOCUMENTS_BUCKET = "signed-documents";

interface ProposalRow {
  source_name: string;
  storage_path: string;
}

/** The newest proposal PDF Easy PV has for this quote, if any. */
async function latestProposalRow(quoteId: string): Promise<ProposalRow | undefined> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("easypv_files")
    .select("source_name, storage_path")
    .eq("quote_id", quoteId)
    .eq("category", "uploads")
    .eq("group_name", "quotation")
    .eq("content_type", "application/pdf")
    .order("source_modified_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? undefined;
}

export async function hasEasyPvProposal(quoteId: string): Promise<boolean> {
  return Boolean(await latestProposalRow(quoteId));
}

/** Pages (1-based) to leave out of the proposal for this quote. */
export async function getProposalSkipPages(quoteId: string): Promise<number[]> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase.from("quotes").select("easypv_proposal_skip_pages").eq("id", quoteId).maybeSingle();
  return parseSkipPages(data?.easypv_proposal_skip_pages);
}

/** The current proposal's bytes — for the internal View Quote page and "Download PDF". */
export async function readLiveProposal(quoteId: string): Promise<{ bytes: Buffer; fileName: string } | undefined> {
  const row = await latestProposalRow(quoteId);
  if (!row) return undefined;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage.from(SOLAR_SURVEY_BUCKET).download(row.storage_path);
  if (error || !data) {
    console.error("readLiveProposal failed", error);
    return undefined;
  }
  return { bytes: Buffer.from(await data.arrayBuffer()), fileName: row.source_name };
}

/**
 * At send-time: copies the current proposal into the signed-documents bucket
 * under a content-addressed path and returns what the snapshot needs, so
 * re-saving the proposal in Easy PV afterwards can't change what was sent.
 */
export async function lockEasyPvProposal(
  quoteId: string,
): Promise<{ storagePath: string; fileName: string; sha256: string; skipPages: number[] } | undefined> {
  const live = await readLiveProposal(quoteId);
  if (!live) return undefined;

  const sha256 = createHash("sha256").update(live.bytes).digest("hex");
  const storagePath = `proposals/${quoteId}/${sha256}.pdf`;
  const supabase = createServiceRoleClient();
  const { error } = await supabase.storage
    .from(SIGNED_DOCUMENTS_BUCKET)
    .upload(storagePath, live.bytes, { contentType: "application/pdf", upsert: true });
  if (error) {
    console.error("lockEasyPvProposal: upload failed", error);
    return undefined;
  }
  return { storagePath, fileName: live.fileName, sha256, skipPages: await getProposalSkipPages(quoteId) };
}

/** A locked copy's bytes, checked against its recorded hash. */
export async function readLockedProposal(proposal: { storagePath: string; sha256: string }): Promise<Buffer | undefined> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage.from(SIGNED_DOCUMENTS_BUCKET).download(proposal.storagePath);
  if (error || !data) {
    console.error("readLockedProposal failed", error);
    return undefined;
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== proposal.sha256) {
    console.error("readLockedProposal: hash mismatch", proposal.storagePath);
    return undefined;
  }
  return bytes;
}
