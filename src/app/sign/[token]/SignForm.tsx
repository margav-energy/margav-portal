"use client";

import { useState } from "react";
import { CheckCircle2, Download, FileText, XCircle } from "lucide-react";
import { submitSignatureAction, declineSignatureAction } from "@/app/sign/[token]/actions";
import { SignaturePad } from "@/components/esignature/SignaturePad";
import { QuoteDocumentPreview } from "@/components/esignature/QuoteDocumentPreview";
import { RelatedDocumentsCard, type RelatedDocumentLink } from "@/components/esignature/RelatedDocumentsCard";
import type { PublicRelatedDocument, PublicSignatureRequest } from "@/data/signature-service";
import type { DocumentSnapshot } from "@/lib/esignature/document";

const inputClassName =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-blue focus:bg-white focus:ring-1 focus:ring-brand-blue";

function AgreementDocumentPreview({ reference }: { reference: string }) {
  return (
    <div className="mx-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-slate-500 uppercase">
        Boiler Installation Agreement
      </h2>
      <p className="text-sm text-slate-600">
        This is the Terms &amp; Conditions of Installation for quote {reference}. Please read the full agreement
        before signing.
      </p>
      <a
        href="/api/agreement-templates/boiler-installation"
        target="_blank"
        rel="noreferrer"
        className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-brand-blue hover:bg-slate-100"
      >
        <FileText className="h-4 w-4" />
        View the full agreement (PDF)
      </a>
      <p className="mt-4 text-xs text-slate-400">
        A statutory 14-day cooling-off period applies from the date you sign, during which you may cancel without
        penalty (see clause 3 of the agreement).
      </p>
    </div>
  );
}

export function SignForm({
  token,
  request,
  relatedDocument,
  surveyDocumentUrl,
}: {
  token: string;
  request: PublicSignatureRequest;
  relatedDocument?: PublicRelatedDocument;
  surveyDocumentUrl?: string;
}) {
  const isAgreement = request.documentType === "boiler_installation_agreement";
  const documentLabel = isAgreement ? "installation agreement" : "quote";
  const [typedName, setTypedName] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<"form" | "submitting" | "signed" | "declined" | "declining">("form");
  const [error, setError] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  if (request.status === "signed" || status === "signed") {
    return (
      <StatusScreen
        icon={<CheckCircle2 className="h-10 w-10 text-brand-green-mid" />}
        title="Signed — thank you"
        body={`This ${documentLabel} has been signed and Margav Heating has been notified. You'll receive a copy for your records.`}
      />
    );
  }

  if (request.status === "declined" || status === "declined") {
    return (
      <StatusScreen
        icon={<XCircle className="h-10 w-10 text-slate-400" />}
        title="Signature declined"
        body={`You've declined to sign this ${documentLabel}. Margav Heating has been notified — get in touch if you'd like to discuss it further.`}
      />
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!typedName.trim() || !signatureDataUrl || !agreed) return;

    setStatus("submitting");
    setError(null);
    const result = await submitSignatureAction(token, typedName, signatureDataUrl);
    if (result.ok) {
      setStatus("signed");
    } else {
      setError(result.error ?? "Something went wrong. Please try again.");
      setStatus("form");
    }
  }

  async function handleDecline() {
    setStatus("submitting");
    const result = await declineSignatureAction(token, declineReason);
    if (result.ok) {
      setStatus("declined");
    } else {
      setError(result.error ?? "Something went wrong. Please try again.");
      setStatus("form");
    }
  }

  const canSubmit = typedName.trim().length > 0 && Boolean(signatureDataUrl) && agreed && status !== "submitting";

  function scrollToSignForm() {
    document.getElementById("sign-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const relatedDocuments: RelatedDocumentLink[] = [];
  if (surveyDocumentUrl) {
    relatedDocuments.push({ label: "Boiler survey", href: surveyDocumentUrl, statusLabel: "Submitted" });
  }
  if (relatedDocument) {
    const label = relatedDocument.documentType === "boiler_installation_agreement" ? "Installation Agreement" : "Quote";
    relatedDocuments.push({
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
          <p className="text-lg font-bold text-slate-900">Margav Heating</p>
          <p className="text-sm text-slate-500">
            {isAgreement ? "Boiler Installation Agreement" : `Quote ${request.snapshot.reference}`}
            {!isAgreement && " — " + (request.snapshot as DocumentSnapshot).productTypeLabel}
          </p>
        </div>

        {isAgreement ? (
          <AgreementDocumentPreview reference={request.snapshot.reference} />
        ) : (
          <QuoteDocumentPreview
            snapshot={request.snapshot as DocumentSnapshot}
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

        <RelatedDocumentsCard documents={relatedDocuments} />

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

          <SignaturePad onChange={setSignatureDataUrl} />

          <label className="flex items-start gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
            />
            I have read and agree to the {documentLabel} above, including the statutory 14-day cooling-off period.
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-blue/90 disabled:opacity-50"
            >
              {status === "submitting" ? "Submitting…" : "Sign & submit"}
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

function StatusScreen({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
      {icon}
      <p className="text-lg font-semibold text-slate-900">{title}</p>
      <p className="max-w-sm text-sm text-slate-500">{body}</p>
    </div>
  );
}
