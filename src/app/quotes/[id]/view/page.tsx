import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Info } from "lucide-react";
import { getQuoteDetail } from "@/data/quotes-service";
import { requireStaffUser } from "@/data/current-user";
import { buildDocumentSnapshot } from "@/lib/esignature/document";
import { getBoilerSurveyForQuote, getSurveyDocumentUrl } from "@/data/boiler-survey-service";
import { getLatestSignatureRequest, getSignedDocumentUrl } from "@/data/signature-service";
import { getQuoteDocuments } from "@/data/quote-documents-service";
import { QuoteDocumentPreview } from "@/components/esignature/QuoteDocumentPreview";
import { QuoteSummarySidebarCard } from "@/components/esignature/QuoteSummarySidebarCard";
import { RelatedDocumentsCard, type RelatedDocumentLink } from "@/components/esignature/RelatedDocumentsCard";
import { UploadedDocumentViewer } from "@/components/quotes/detail/UploadedDocumentViewer";

/**
 * The internal "View Quote" button's destination. If an admin's uploaded
 * an actual document for this quote (see QuoteDocumentsCard), that
 * document — not our own generated hero/detail layout — is the main
 * content (it already has everything: pricing, terms, guarantee, ...), with
 * a compact quote summary + actions alongside it (QuoteSummarySidebarCard).
 * Only without an uploaded document does this fall back to
 * `buildDocumentSnapshot` + `QuoteDocumentPreview`, the exact same renderer
 * the customer's `/sign/[token]` page uses, so it looks identical to what
 * "Send Quote" would actually send. Unlike the sign page, this re-fetches
 * live (it's not locked to a snapshot), works before a quote's ever been
 * sent, and never expires.
 */
export default async function ViewQuotePage({
  params,
}: PageProps<"/quotes/[id]/view">) {
  await requireStaffUser();

  const { id } = await params;
  const result = await getQuoteDetail(id);

  if (!result) notFound();

  const { quote, detail } = result;
  const isBoiler = quote.productType === "boiler";

  const [snapshot, survey, surveyDocumentUrl, agreementRequest, agreementSignedDocumentUrl, documents] =
    await Promise.all([
      buildDocumentSnapshot(quote, detail),
      isBoiler ? getBoilerSurveyForQuote(id) : Promise.resolve(undefined),
      isBoiler ? getSurveyDocumentUrl(id) : Promise.resolve(undefined),
      isBoiler ? getLatestSignatureRequest(id, "boiler_installation_agreement") : Promise.resolve(undefined),
      isBoiler ? getSignedDocumentUrl(id, "boiler_installation_agreement") : Promise.resolve(undefined),
      getQuoteDocuments(id),
    ]);

  // Only boiler jobs have a survey step or an Installation Agreement at
  // all (see BoilerSurveyCard / "Send Installation Agreement" — neither
  // exists for solar) — nothing to cross-link for a solar quote.
  const otherDocuments: RelatedDocumentLink[] = isBoiler
    ? [
        {
          label: "Boiler survey",
          href: survey?.status === "submitted" ? surveyDocumentUrl : undefined,
          statusLabel: !survey ? "Not started" : survey.status === "submitted" ? "Submitted" : "Awaiting survey",
        },
        {
          label: "Installation agreement",
          // Always readable, even before it's ever been sent — the
          // agreement's body is a fixed template with nothing
          // customer-specific in it (see agreement-document.ts), so there's
          // no reason to wait until sign-time to let someone read it. Once
          // actually signed, this points at that signed copy instead (the
          // one with the real signature/audit trail on it), not the blank
          // template.
          href:
            agreementRequest?.status === "signed"
              ? agreementSignedDocumentUrl
              : "/api/agreement-templates/boiler-installation",
          statusLabel: !agreementRequest
            ? "Not sent yet"
            : agreementRequest.status === "signed"
              ? "Signed"
              : agreementRequest.status === "declined"
                ? "Declined"
                : agreementRequest.status === "expired"
                  ? "Link expired"
                  : "Awaiting signature",
        },
      ]
    : [];

  // Once an admin's uploaded an actual document for this quote (see
  // QuoteDocumentsCard on the quote detail page), *that* — not our own
  // generated layout — is what's worth showing: it already has everything
  // (pricing, terms, guarantee, ...), so it replaces the generated preview
  // entirely rather than sitting alongside it. The most recently uploaded
  // one wins; any others still show as links below.
  const [primaryDocument, ...remainingDocuments] = documents;
  otherDocuments.push(
    ...remainingDocuments.map((doc) => ({
      label: doc.filename,
      href: doc.url,
      statusLabel: `Uploaded${doc.uploadedByName ? ` by ${doc.uploadedByName}` : ""}`,
    })),
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Link
        href={`/quotes/${id}`}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to quote
      </Link>

      {primaryDocument ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <UploadedDocumentViewer document={primaryDocument} />
          </div>
          <div className="flex flex-col gap-4">
            <QuoteSummarySidebarCard snapshot={snapshot} pdfHref={`/api/quotes/${id}/pdf`} />
            <RelatedDocumentsCard documents={otherDocuments} />
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-lg bg-brand-blue/5 px-4 py-2.5 text-sm text-brand-blue">
            <Info className="h-4 w-4 shrink-0" />
            This is a live preview of the quote&rsquo;s current details — it may differ from what was actually sent
            if changes were made afterward.
          </div>

          <QuoteDocumentPreview
            snapshot={snapshot}
            actionsSlot={
              <a
                href={`/api/quotes/${id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </a>
            }
          />

          <RelatedDocumentsCard documents={otherDocuments} />
        </>
      )}
    </div>
  );
}
