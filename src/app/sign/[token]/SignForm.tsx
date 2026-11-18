"use client";

import { useState } from "react";
import { CheckCircle2, Download, FileText, XCircle } from "lucide-react";
import { submitSignatureAction, declineSignatureAction } from "@/app/sign/[token]/actions";
import { SignaturePad } from "@/components/esignature/SignaturePad";
import { QuoteDocumentPreview } from "@/components/esignature/QuoteDocumentPreview";
import { RelatedDocumentsCard, type RelatedDocumentLink } from "@/components/esignature/RelatedDocumentsCard";
import type { PublicRelatedDocument, PublicSignatureRequest } from "@/data/signature-service";
import type { DocumentSnapshot } from "@/lib/esignature/document";
import { brandNameForProduct } from "@/lib/brand";
import type { WaiverSnapshot } from "@/lib/esignature/waiver-document";

const inputClassName =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-blue focus:bg-white focus:ring-1 focus:ring-brand-blue";

/** One place mapping `documentType` to how each fixed-template document reads on this page — the "quote" case's banner is built separately below since it needs the snapshot's reference/product type, not a fixed title. */
const DOCUMENT_META = {
  boiler_installation_agreement: { label: "installation agreement", bannerTitle: "Boiler Installation Agreement", relatedLabel: "Installation Agreement" },
  cooling_off_waiver: { label: "cooling-off waiver", bannerTitle: "Cooling-Off Waiver", relatedLabel: "Cooling-Off Waiver" },
  solar_installation_agreement: { label: "installation agreement", bannerTitle: "Solar PV Installation Agreement", relatedLabel: "Installation Agreement" },
  solar_cooling_off_waiver: { label: "cooling-off waiver", bannerTitle: "Cooling-Off Waiver", relatedLabel: "Cooling-Off Waiver" },
} as const;

function isStaticTemplateType(
  documentType: PublicSignatureRequest["documentType"],
): documentType is keyof typeof DOCUMENT_META {
  return documentType in DOCUMENT_META;
}

/** Shared by the Boiler Installation Agreement and Cooling-Off Waiver — both are fixed T&Cs templates with nothing customer-specific to render inline, so this just links out to the static PDF (see /api/agreement-templates/[...]) instead of rendering the document itself. */
function StaticDocumentPreview({
  title,
  description,
  pdfHref,
  linkLabel,
  footnote,
}: {
  title: string;
  description: string;
  pdfHref: string;
  linkLabel: string;
  footnote?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-slate-500 uppercase">{title}</h2>
      <p className="text-sm text-slate-600">{description}</p>
      <a
        href={pdfHref}
        target="_blank"
        rel="noreferrer"
        className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-brand-blue hover:bg-slate-100"
      >
        <FileText className="h-4 w-4" />
        {linkLabel}
      </a>
      {footnote && <p className="mt-4 text-xs text-slate-400">{footnote}</p>}
    </div>
  );
}

type StaticDocumentType = keyof typeof DOCUMENT_META;

/** The preview card for one of the fixed-template documents - shared by the single-document page and the combined agreement + waiver page, where each is read on its own. */
function StaticPreviewFor({ documentType, reference }: { documentType: StaticDocumentType; reference: string }) {
  switch (documentType) {
    case "boiler_installation_agreement":
      return (
        <StaticDocumentPreview
          title="Boiler Installation Agreement"
          description={`This is the Terms & Conditions of Installation for quote ${reference}. Please read the full agreement before signing.`}
          pdfHref="/api/agreement-templates/boiler-installation"
          linkLabel="View the full agreement (PDF)"
          footnote="A statutory 14-day cooling-off period applies from the date you sign, during which you may cancel without penalty (see clause 3 of the agreement)."
        />
      );
    case "solar_installation_agreement":
      return (
        <StaticDocumentPreview
          title="Solar PV Installation Agreement"
          description={`These are the terms of your solar PV installation for quote ${reference}. Please read the full agreement before signing.`}
          pdfHref="/api/agreement-templates/solar-installation"
          linkLabel="View the full agreement (PDF)"
          footnote="A statutory 14-day cooling-off period applies from the date you sign (see clause 3 of the agreement). Payment terms are in clause 10."
        />
      );
    case "solar_cooling_off_waiver":
      return (
        <StaticDocumentPreview
          title="Cooling-Off Waiver"
          description={`This waiver lets your solar PV installation for quote ${reference} begin before your statutory 14-day cancellation period ends. Please read it in full before signing — you're under no obligation to sign it.`}
          pdfHref="/api/agreement-templates/solar-cooling-off-waiver"
          linkLabel="View the full waiver (PDF)"
        />
      );
    case "cooling_off_waiver":
      return (
        <StaticDocumentPreview
          title="Cooling-Off Waiver"
          description={`This waiver lets your boiler installation for quote ${reference} begin before your statutory 14-day cancellation period ends. Please read it in full before signing — you're under no obligation to sign it.`}
          pdfHref="/api/agreement-templates/cooling-off-waiver"
          linkLabel="View the full waiver (PDF)"
        />
      );
  }
}

export function SignForm({
  token,
  request,
  relatedDocuments = [],
  surveyDocumentUrl,
  companion,
}: {
  token: string;
  request: PublicSignatureRequest;
  relatedDocuments?: PublicRelatedDocument[];
  surveyDocumentUrl?: string;
  /** The other half of the installation agreement + cooling-off waiver pair, when it's still waiting - both are then read separately and signed together with one signature. */
  companion?: { accessToken: string; request: PublicSignatureRequest };
}) {
  const staticTemplate = isStaticTemplateType(request.documentType) ? DOCUMENT_META[request.documentType] : undefined;
  const documentLabel = staticTemplate?.label ?? "quote";
  const isWaiver = request.documentType === "cooling_off_waiver" || request.documentType === "solar_cooling_off_waiver";
  const bundle = staticTemplate !== undefined && companion !== undefined;
  const isSolarDocument = request.documentType.startsWith("solar_");
  // In the combined page the agreement is always listed first, whichever of the two links was opened.
  const agreementType = (isWaiver ? companion?.request.documentType : request.documentType) as StaticDocumentType;
  const waiverType = (isWaiver ? request.documentType : companion?.request.documentType) as StaticDocumentType;
  const waiverSnapshot = (isWaiver ? request.snapshot : companion?.request.snapshot) as WaiverSnapshot | undefined;
  // An agreement or waiver says its product through its document type; a quote is Solar or Boiler by its snapshot.
  const brand = staticTemplate
    ? brandNameForProduct(isSolarDocument ? "Solar" : "Boiler")
    : brandNameForProduct((request.snapshot as DocumentSnapshot).productTypeLabel);
  const [typedName, setTypedName] = useState("");
  // Pre-filled from whatever the quote already had (e.g. an installer's
  // already been assigned a date) but editable — whatever's in the box at
  // submit time is what gets recorded on the signed PDF (see
  // `WaiverSnapshot.agreedInstallDate`'s doc comment). Optional: left blank
  // prints as "—", same as before this existed.
  const [installDate, setInstallDate] = useState(waiverSnapshot?.agreedInstallDate ?? "");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  // Combined page only: the second tick-box (the waiver; `agreed` is the agreement's) - each document gets its own conscious yes.
  const [agreedWaiver, setAgreedWaiver] = useState(false);
  const [status, setStatus] = useState<"form" | "submitting" | "signed" | "declined" | "declining">("form");
  const [error, setError] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  // The agreement and the waiver go out together but are signed separately - once one is done, point at whichever is still waiting.
  const pendingRelated = relatedDocuments.filter(
    (relatedDocument) =>
      isStaticTemplateType(relatedDocument.documentType) &&
      // In the combined view the companion was just signed on this page too.
      !(bundle && relatedDocument.accessToken === companion?.accessToken) &&
      (relatedDocument.status === "pending" || relatedDocument.status === "viewed"),
  );

  if (request.status === "signed" || status === "signed") {
    return (
      <StatusScreen
        icon={<CheckCircle2 className="h-10 w-10 text-brand-green-mid" />}
        title="Signed — thank you"
        body={
          bundle
            ? `Your installation agreement and cooling-off waiver have been signed and ${brand} has been notified. You'll receive a copy of each for your records.`
            : `This ${documentLabel} has been signed and ${brand} has been notified. You'll receive a copy for your records.`
        }
        nextLinks={pendingRelated.map((relatedDocument) => ({
          label: `Next: sign the ${isStaticTemplateType(relatedDocument.documentType) ? DOCUMENT_META[relatedDocument.documentType].relatedLabel : "document"}`,
          href: `/sign/${relatedDocument.accessToken}`,
        }))}
      />
    );
  }

  if (request.status === "declined" || status === "declined") {
    return (
      <StatusScreen
        icon={<XCircle className="h-10 w-10 text-slate-400" />}
        title="Signature declined"
        body={`You've declined to sign ${bundle ? "these documents" : `this ${documentLabel}`}. ${brand} has been notified — get in touch if you'd like to discuss it further.`}
      />
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!typedName.trim() || !signatureDataUrl || !agreed || (bundle && !agreedWaiver)) return;

    setStatus("submitting");
    setError(null);
    const result = await submitSignatureAction(token, typedName, signatureDataUrl, isWaiver || bundle ? installDate : undefined, bundle);
    if (result.ok) {
      setStatus("signed");
    } else {
      setError(result.error ?? "Something went wrong. Please try again.");
      setStatus("form");
    }
  }

  async function handleDecline() {
    setStatus("submitting");
    const result = await declineSignatureAction(token, declineReason, bundle);
    if (result.ok) {
      setStatus("declined");
    } else {
      setError(result.error ?? "Something went wrong. Please try again.");
      setStatus("form");
    }
  }

  const canSubmit = typedName.trim().length > 0 && Boolean(signatureDataUrl) && agreed && (!bundle || agreedWaiver) && status !== "submitting";

  function scrollToSignForm() {
    document.getElementById("sign-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const relatedDocumentLinks: RelatedDocumentLink[] = [];
  if (surveyDocumentUrl) {
    relatedDocumentLinks.push({ label: "Boiler survey", href: surveyDocumentUrl, statusLabel: "Submitted" });
  }
  for (const relatedDocument of relatedDocuments) {
    // Signed on this very page in the combined view, so no separate link to it.
    if (bundle && relatedDocument.accessToken === companion?.accessToken) continue;
    const label = isStaticTemplateType(relatedDocument.documentType)
      ? DOCUMENT_META[relatedDocument.documentType].relatedLabel
      : "Quote";
    relatedDocumentLinks.push({
      label,
      href: `/sign/${relatedDocument.accessToken}`,
      statusLabel:
        relatedDocument.status === "signed"
          ? "Signed"
          : relatedDocument.status === "declined"
            ? "Declined"
            : "Needs your signature",
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="text-center">
          <p className="text-lg font-bold text-slate-900">{brand}</p>
          <p className="text-sm text-slate-500">
            {bundle
              ? `Installation Agreement & Cooling-Off Waiver — quote ${request.snapshot.reference}`
              : (staticTemplate?.bannerTitle ?? `Quote ${request.snapshot.reference}`)}
            {!staticTemplate && " — " + (request.snapshot as DocumentSnapshot).productTypeLabel}
          </p>
        </div>

        {bundle ? (
          <>
            <StaticPreviewFor documentType={agreementType} reference={request.snapshot.reference} />
            <StaticPreviewFor documentType={waiverType} reference={request.snapshot.reference} />
          </>
        ) : staticTemplate ? (
          <StaticPreviewFor documentType={request.documentType as StaticDocumentType} reference={request.snapshot.reference} />
        ) : (
          <QuoteDocumentPreview
            snapshot={request.snapshot as DocumentSnapshot}
            designImageUrl={(request.snapshot as DocumentSnapshot).designImage ? `/sign/${token}/design-image` : undefined}
            fullPdfUrl={(request.snapshot as DocumentSnapshot).proposalPdf ? `/sign/${token}/pdf` : undefined}
            actionsSlot={
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={scrollToSignForm}
                  className="flex-1 rounded-lg bg-brand-green-mid px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-green-mid/90"
                >
                  Accept &amp; Sign
                </button>
                <a
                  href={`/sign/${token}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </a>
              </div>
            }
          />
        )}

        <RelatedDocumentsCard documents={relatedDocumentLinks} />

        <form
          id="sign-form"
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">Sign</h2>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="typedName" className="text-sm font-medium text-slate-700">
              Full name
            </label>
            <input
              id="typedName"
              className={inputClassName}
              value={typedName}
              onChange={(event) => setTypedName(event.target.value)}
              placeholder="Type your full name"
            />
          </div>

          {(isWaiver || bundle) && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="installDate" className="text-sm font-medium text-slate-700">
                Agreed installation date <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                id="installDate"
                type="date"
                className={inputClassName}
                value={installDate}
                onChange={(event) => setInstallDate(event.target.value)}
              />
            </div>
          )}

          <SignaturePad onChange={setSignatureDataUrl} />

          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
            />
            {bundle
              ? "I have read and agree to the installation agreement above, including the statutory 14-day cooling-off period."
              : isWaiver
                ? `I have read and agree to the cooling-off waiver above, and I expressly request that ${brand} begin the installation works before my statutory 14-day cancellation period ends.`
                : `I have read and agree to the ${documentLabel} above, including the statutory 14-day cooling-off period.`}
          </label>
          {bundle && (
            <label className="flex items-start gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={agreedWaiver}
                onChange={(event) => setAgreedWaiver(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
              />
              {`I have read and agree to the cooling-off waiver above, and I expressly request that ${brand} begin the installation works before my statutory 14-day cancellation period ends.`}
            </label>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 rounded-lg bg-brand-green-gradient px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:brightness-95 disabled:opacity-50"
            >
              {status === "submitting" ? "Submitting…" : bundle ? "Sign both documents" : "Sign & submit"}
            </button>
          </div>

          <details className="mt-1">
            <summary className="cursor-pointer text-xs text-slate-400">Don&rsquo;t want to sign this?</summary>
            <div className="mt-2 flex flex-col gap-2">
              <textarea
                rows={2}
                className={inputClassName}
                placeholder="Optional — let us know why"
                value={declineReason}
                onChange={(event) => setDeclineReason(event.target.value)}
              />
              <button
                type="button"
                onClick={handleDecline}
                disabled={status === "submitting"}
                className="w-fit rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                Decline to sign
              </button>
            </div>
          </details>
        </form>
      </div>
    </div>
  );
}

function StatusScreen({
  icon,
  title,
  body,
  nextLinks = [],
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  nextLinks?: { label: string; href: string }[];
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
      {icon}
      <p className="text-lg font-semibold text-slate-900">{title}</p>
      <p className="max-w-sm text-sm text-slate-500">{body}</p>
      {nextLinks.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="mt-2 rounded-lg bg-brand-green-gradient px-5 py-2.5 text-sm font-semibold text-black hover:brightness-95"
        >
          {link.label} →
        </a>
      ))}
    </div>
  );
}
