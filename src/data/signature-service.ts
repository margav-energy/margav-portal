import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getCurrentUser } from "@/data/current-user";
import { getQuoteDetail } from "@/data/quotes-service";
import { getRepSignatureImageBytes } from "@/data/profile-signature-service";
import { notifyUser } from "@/lib/notify";
import { isResendConfigured, sendEmail } from "@/lib/resend";
import { formatDateTime } from "@/lib/format";
import { buildDocumentSnapshot, hashDocument, type DocumentSnapshot } from "@/lib/esignature/document";
import { renderSignedDocumentPdf, type RepSignature } from "@/lib/esignature/pdf";
import { buildAgreementSnapshot, type AgreementSnapshot } from "@/lib/esignature/agreement-document";
import { buildSignedAgreementPdf } from "@/lib/esignature/agreement-pdf";
import { signedConfirmationEmailHtml } from "@/lib/esignature/email-templates";
import type { BoilerQuoteDetail } from "@/types/boiler-quote";

/**
 * Self-hosted e-signature data layer — replaces the Dropbox Sign +
 * webhook combo, and also covers the fixed "Boiler Installation
 * Agreement" document (see `document_type` below) with the same table and
 * public route. `create*SignatureRequest` runs in an authenticated context
 * (called from `src/components/quotes/actions.ts`); everything else runs
 * unauthenticated from the public `/sign/[token]` route via the
 * service-role client, mirroring `src/data/boiler-survey-service.ts`'s split.
 */

export const SIGNATURE_IMAGES_BUCKET = "signature-images";
export const SIGNED_DOCUMENTS_BUCKET = "signed-documents";

export type SignatureStatus = "pending" | "viewed" | "signed" | "declined" | "expired";
export type SignatureDocumentType = "quote" | "boiler_installation_agreement";

type AnySnapshot = DocumentSnapshot | AgreementSnapshot;

export interface SignatureRequestSummary {
  id: string;
  accessToken: string;
  status: SignatureStatus;
  signerName: string;
  signerEmail: string;
  sentAt: string;
  signedAt?: string;
  declinedAt?: string;
  declineReason?: string;
  hasSignedPdf: boolean;
}

interface SignatureRequestRow {
  id: string;
  quote_id: string;
  access_token: string;
  document_type: SignatureDocumentType;
  signer_name: string;
  signer_email: string;
  document_snapshot: AnySnapshot;
  document_hash: string;
  status: SignatureStatus;
  sent_at: string;
  expires_at: string;
  viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  signature_image_path: string | null;
  signed_pdf_path: string | null;
}

const SUMMARY_COLUMNS =
  "id, access_token, status, signer_name, signer_email, sent_at, signed_at, declined_at, decline_reason, signed_pdf_path";

const FULL_ROW_COLUMNS =
  "id, quote_id, access_token, document_type, signer_name, signer_email, document_snapshot, document_hash, status, sent_at, expires_at, viewed_at, signed_at, declined_at, decline_reason, signature_image_path, signed_pdf_path";

// ─────────────────────────────────────────────────────────────────────────
// Portal side (authenticated)
// ─────────────────────────────────────────────────────────────────────────

/** For the "Signature"/"Installation Agreement" cards on the quote detail page — the latest request of that type only, not the full history. */
export async function getLatestSignatureRequest(
  quoteId: string,
  documentType: SignatureDocumentType = "quote",
): Promise<SignatureRequestSummary | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("signature_requests")
    .select(SUMMARY_COLUMNS)
    .eq("quote_id", quoteId)
    .eq("document_type", documentType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getLatestSignatureRequest failed", error);
    return undefined;
  }
  if (!data) return undefined;

  return {
    id: data.id,
    accessToken: data.access_token,
    status: data.status as SignatureStatus,
    signerName: data.signer_name,
    signerEmail: data.signer_email,
    sentAt: data.sent_at,
    signedAt: data.signed_at ?? undefined,
    declinedAt: data.declined_at ?? undefined,
    declineReason: data.decline_reason ?? undefined,
    hasSignedPdf: Boolean(data.signed_pdf_path),
  };
}

/** A short-lived signed URL to view/download the final PDF from the portal. */
export async function getSignedDocumentUrl(
  quoteId: string,
  documentType: SignatureDocumentType = "quote",
): Promise<string | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("signature_requests")
    .select("signed_pdf_path")
    .eq("quote_id", quoteId)
    .eq("document_type", documentType)
    .eq("status", "signed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.signed_pdf_path) return undefined;

  const { data: signed, error } = await supabase.storage
    .from(SIGNED_DOCUMENTS_BUCKET)
    .createSignedUrl(data.signed_pdf_path, 60 * 60);

  if (error || !signed) {
    console.error("getSignedDocumentUrl: createSignedUrl failed", error);
    return undefined;
  }
  return signed.signedUrl;
}

/**
 * Called from `sendQuote` (`src/components/quotes/actions.ts`). Builds and
 * locks the document snapshot, expires any still-pending prior request for
 * this quote (a fresh "Send Quote" supersedes it), and inserts the new row.
 */
export async function createSignatureRequest(
  quoteId: string,
): Promise<{ accessToken: string; snapshot: DocumentSnapshot; signerEmail: string } | { error: string }> {
  const result = await getQuoteDetail(quoteId);
  if (!result) return { error: "Quote not found." };
  const { quote, detail } = result;

  const email = detail.customer.email.trim();
  if (!email) {
    return { error: "This customer has no email address on file. Add one on the Customer card before sending for signature." };
  }

  const snapshot = buildDocumentSnapshot(quote, detail);
  const documentHash = hashDocument(snapshot);

  const supabase = await createClient();
  const user = await getCurrentUser();

  await supabase
    .from("signature_requests")
    .update({ status: "expired" })
    .eq("quote_id", quoteId)
    .eq("document_type", "quote")
    .eq("status", "pending");

  const { data, error } = await supabase
    .from("signature_requests")
    .insert({
      quote_id: quoteId,
      document_type: "quote",
      signer_name: detail.customer.name,
      signer_email: email,
      document_snapshot: snapshot,
      document_hash: documentHash,
      created_by: user?.id ?? null,
    })
    .select("access_token")
    .single();

  if (error || !data) {
    console.error("createSignatureRequest failed", error);
    return { error: "Could not create the signature request. Please try again." };
  }

  return { accessToken: data.access_token, snapshot, signerEmail: email };
}

/**
 * Called from `sendInstallationAgreement` (`src/components/quotes/actions.ts`)
 * — the fixed Boiler Installation Agreement T&Cs document. Boiler-only,
 * since the document itself is boiler-specific.
 */
export async function createAgreementSignatureRequest(
  quoteId: string,
): Promise<{ accessToken: string; snapshot: AgreementSnapshot; signerEmail: string } | { error: string }> {
  const result = await getQuoteDetail(quoteId);
  if (!result) return { error: "Quote not found." };
  const { quote, detail } = result;

  if (quote.productType !== "boiler") {
    return { error: "The installation agreement is only available for boiler quotes." };
  }

  const email = detail.customer.email.trim();
  if (!email) {
    return { error: "This customer has no email address on file. Add one on the Customer card before sending for signature." };
  }

  const snapshot = buildAgreementSnapshot(quote, detail as BoilerQuoteDetail);
  const documentHash = hashDocument(snapshot);

  const supabase = await createClient();
  const user = await getCurrentUser();

  await supabase
    .from("signature_requests")
    .update({ status: "expired" })
    .eq("quote_id", quoteId)
    .eq("document_type", "boiler_installation_agreement")
    .eq("status", "pending");

  const { data, error } = await supabase
    .from("signature_requests")
    .insert({
      quote_id: quoteId,
      document_type: "boiler_installation_agreement",
      signer_name: detail.customer.name,
      signer_email: email,
      document_snapshot: snapshot,
      document_hash: documentHash,
      created_by: user?.id ?? null,
    })
    .select("access_token")
    .single();

  if (error || !data) {
    console.error("createAgreementSignatureRequest failed", error);
    return { error: "Could not create the signature request. Please try again." };
  }

  return { accessToken: data.access_token, snapshot, signerEmail: email };
}

// ─────────────────────────────────────────────────────────────────────────
// Public side (unauthenticated, token-gated) — used by /sign/[token].
// ─────────────────────────────────────────────────────────────────────────

export interface PublicSignatureRequest {
  documentType: SignatureDocumentType;
  status: SignatureStatus;
  snapshot: AnySnapshot;
  signerName: string;
  expired: boolean;
}

async function findRequestByToken(token: string): Promise<SignatureRequestRow | null> {
  if (!token) return null;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("signature_requests")
    .select(FULL_ROW_COLUMNS)
    .eq("access_token", token)
    .maybeSingle();

  if (error) console.error("findRequestByToken failed", error);
  return (data as SignatureRequestRow) ?? null;
}

/** Returns `undefined` for an unknown token — the page renders a generic "link not valid" state, never a reason why. */
export async function getPublicSignatureRequest(token: string): Promise<PublicSignatureRequest | undefined> {
  const row = await findRequestByToken(token);
  if (!row) return undefined;

  const expired = row.status === "pending" && new Date(row.expires_at).getTime() < Date.now();
  if (expired) {
    const supabase = createServiceRoleClient();
    await supabase.from("signature_requests").update({ status: "expired" }).eq("id", row.id);
  }

  if (row.status === "pending" && !expired) {
    const supabase = createServiceRoleClient();
    await supabase.from("signature_requests").update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("id", row.id);
  }

  return {
    documentType: row.document_type,
    status: expired ? "expired" : row.status === "pending" ? "viewed" : row.status,
    snapshot: row.document_snapshot,
    signerName: row.signer_name,
    expired,
  };
}

/** The rep's saved signature (Settings → "My signature") for the quote's assigned rep — shared by both document types below. Missing gracefully (rep hasn't set one up, or no assigned rep). */
async function lookupRepSignature(
  supabase: ReturnType<typeof createServiceRoleClient>,
  quoteId: string,
): Promise<RepSignature | null> {
  const { data: quoteForRep } = await supabase.from("quotes").select("representative_id").eq("id", quoteId).maybeSingle();
  const [repProfile, repSignatureImage] = await Promise.all([
    quoteForRep?.representative_id
      ? supabase.from("profiles").select("full_name").eq("id", quoteForRep.representative_id).maybeSingle()
      : Promise.resolve({ data: null }),
    getRepSignatureImageBytes(quoteForRep?.representative_id),
  ]);
  return repProfile?.data?.full_name && repSignatureImage
    ? { name: repProfile.data.full_name, image: repSignatureImage }
    : null;
}

async function performQuoteSignedSideEffects(row: SignatureRequestRow): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("customer_name, representative_id")
    .eq("id", row.quote_id)
    .maybeSingle();

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ stage: "signed", signed_date: new Date().toISOString().slice(0, 10) })
    .eq("id", row.quote_id);
  if (updateError) console.error("performQuoteSignedSideEffects: failed to update quote", updateError);

  const customerName = quote?.customer_name ?? row.signer_name;
  const description = "The customer signed the quote";
  await Promise.all([
    supabase.from("quote_history").insert({ quote_id: row.quote_id, is_system: true, description }),
    supabase.from("activities").insert({
      is_system: true,
      customer_name: customerName,
      description: `${description} — ${customerName}`,
      status: "allocated",
      entity_type: "quote",
      entity_id: row.quote_id,
    }),
    quote?.representative_id
      ? notifyUser({
          userId: quote.representative_id,
          title: "Quote signed",
          body: `${customerName}'s quote has been signed.`,
        })
      : Promise.resolve(),
  ]);

  revalidatePath(`/quotes/${row.quote_id}`);
  revalidatePath("/quotes");
}

/** Same shape as `performQuoteSignedSideEffects`, but never touches `quotes.stage`/`signed_date` — that transition belongs to the main quote-sign flow only. */
async function performAgreementSignedSideEffects(row: SignatureRequestRow): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("customer_name, representative_id")
    .eq("id", row.quote_id)
    .maybeSingle();

  const customerName = quote?.customer_name ?? row.signer_name;
  const description = "The customer signed the installation agreement";
  await Promise.all([
    supabase.from("quote_history").insert({ quote_id: row.quote_id, is_system: true, description }),
    supabase.from("activities").insert({
      is_system: true,
      customer_name: customerName,
      description: `${description} — ${customerName}`,
      status: "allocated",
      entity_type: "quote",
      entity_id: row.quote_id,
    }),
    quote?.representative_id
      ? notifyUser({
          userId: quote.representative_id,
          title: "Installation agreement signed",
          body: `${customerName} signed the installation agreement.`,
        })
      : Promise.resolve(),
  ]);

  revalidatePath(`/quotes/${row.quote_id}`);
  revalidatePath("/quotes");
}

export interface SubmitSignatureParams {
  token: string;
  typedName: string;
  /** `data:image/png;base64,...` from the signing canvas. */
  signatureImageDataUrl: string;
  ip: string;
  userAgent: string;
}

export async function submitSignature(params: SubmitSignatureParams): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await findRequestByToken(params.token);
  if (!row) return { ok: false, error: "This signing link is no longer valid." };
  if (row.status === "signed") return { ok: true };
  if (row.status === "declined" || row.status === "expired") {
    return { ok: false, error: "This signing link is no longer valid." };
  }

  const base64 = params.signatureImageDataUrl.replace(/^data:image\/png;base64,/, "");
  const signatureImageBuffer = Buffer.from(base64, "base64");
  const signedAt = new Date();
  const signedAtLabel = formatDateTime(signedAt.toISOString());

  const supabase = createServiceRoleClient();
  const signaturePath = `${row.id}/signature.png`;

  const { error: signatureUploadError } = await supabase.storage
    .from(SIGNATURE_IMAGES_BUCKET)
    .upload(signaturePath, signatureImageBuffer, { contentType: "image/png", upsert: true });
  if (signatureUploadError) {
    console.error("submitSignature: signature upload failed", signatureUploadError);
    return { ok: false, error: "Could not save your signature. Please try again." };
  }

  const repSignature = await lookupRepSignature(supabase, row.quote_id);

  let pdfBuffer: Buffer;
  try {
    if (row.document_type === "boiler_installation_agreement") {
      pdfBuffer = await buildSignedAgreementPdf(
        row.document_snapshot as AgreementSnapshot,
        {
          typedName: params.typedName,
          signatureImage: signatureImageBuffer,
          signedAtLabel,
          ip: params.ip,
          userAgent: params.userAgent,
          documentHash: row.document_hash,
        },
        repSignature ? { name: repSignature.name, image: repSignature.image, signedAtLabel } : null,
      );
    } else {
      pdfBuffer = await renderSignedDocumentPdf(
        row.document_snapshot as DocumentSnapshot,
        {
          typedName: params.typedName,
          signatureImage: signatureImageBuffer,
          signedAtLabel,
          ip: params.ip,
          userAgent: params.userAgent,
          documentHash: row.document_hash,
        },
        repSignature,
      );
    }
  } catch (error) {
    console.error("submitSignature: PDF render failed", error);
    return { ok: false, error: "Could not finalize the signed document. Please try again." };
  }

  const pdfPath = `${row.id}/signed.pdf`;
  const { error: pdfUploadError } = await supabase.storage
    .from(SIGNED_DOCUMENTS_BUCKET)
    .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (pdfUploadError) {
    console.error("submitSignature: pdf upload failed", pdfUploadError);
    return { ok: false, error: "Could not save the signed document. Please try again." };
  }

  const { error: updateError } = await supabase
    .from("signature_requests")
    .update({
      status: "signed",
      signed_at: signedAt.toISOString(),
      signer_typed_name: params.typedName,
      signature_image_path: signaturePath,
      signed_pdf_path: pdfPath,
      signer_ip: params.ip,
      signer_user_agent: params.userAgent,
    })
    .eq("id", row.id);

  if (updateError) {
    console.error("submitSignature: failed to update signature_requests", updateError);
    return { ok: false, error: "Could not record your signature. Please try again." };
  }

  // Best-effort — the signature itself is already recorded above, so a
  // failed confirmation email shouldn't fail the signing.
  if (isResendConfigured()) {
    const documentLabel =
      row.document_type === "boiler_installation_agreement" ? "installation agreement" : "quote";
    try {
      await sendEmail({
        to: row.signer_email,
        subject: `Your signed Margav Energy ${documentLabel} (${row.document_snapshot.reference})`,
        text:
          `Hi ${row.signer_name},\n\nThanks for signing ${documentLabel} ${row.document_snapshot.reference}. ` +
          `Your signed copy is attached to this email for your records.\n\nMargav Energy`,
        html: signedConfirmationEmailHtml({
          customerName: row.signer_name,
          reference: row.document_snapshot.reference,
          documentLabel,
        }),
        attachments: [
          { filename: `Margav-Energy-${row.document_type}-${row.document_snapshot.reference}.pdf`, content: pdfBuffer },
        ],
      });
    } catch (error) {
      console.error("submitSignature: confirmation email failed", error);
    }
  }

  if (row.document_type === "boiler_installation_agreement") {
    await performAgreementSignedSideEffects(row);
  } else {
    await performQuoteSignedSideEffects(row);
  }
  return { ok: true };
}

export async function declineSignature(
  token: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await findRequestByToken(token);
  if (!row) return { ok: false, error: "This signing link is no longer valid." };
  if (row.status === "signed" || row.status === "declined") return { ok: true };

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("signature_requests")
    .update({ status: "declined", declined_at: new Date().toISOString(), decline_reason: reason || null })
    .eq("id", row.id);

  if (error) {
    console.error("declineSignature failed", error);
    return { ok: false, error: "Could not record the decline. Please try again." };
  }

  const documentLabel = row.document_type === "boiler_installation_agreement" ? "installation agreement" : "quote";
  const { data: quote } = await supabase
    .from("quotes")
    .select("customer_name, representative_id")
    .eq("id", row.quote_id)
    .maybeSingle();
  const customerName = quote?.customer_name ?? row.signer_name;
  const description = `The customer declined to sign the ${documentLabel}`;

  await Promise.all([
    supabase.from("quote_history").insert({ quote_id: row.quote_id, is_system: true, description }),
    supabase.from("activities").insert({
      is_system: true,
      customer_name: customerName,
      description: `${description} — ${customerName}`,
      status: "cancelled",
      entity_type: "quote",
      entity_id: row.quote_id,
    }),
    quote?.representative_id
      ? notifyUser({
          userId: quote.representative_id,
          title: `${row.document_type === "boiler_installation_agreement" ? "Installation agreement" : "Quote signature"} declined`,
          body: `${customerName} declined to sign the ${documentLabel}.`,
        })
      : Promise.resolve(),
  ]);

  revalidatePath(`/quotes/${row.quote_id}`);
  return { ok: true };
}
