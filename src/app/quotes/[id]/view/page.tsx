import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Info } from "lucide-react";
import { getQuoteDetail } from "@/data/quotes-service";
import { assertQuoteOwnedByUser, canViewCustomerPhone, requireStaffUser } from "@/data/current-user";
import { buildDocumentSnapshot } from "@/lib/esignature/document";
import { getBoilerSurveyForQuote, getSurveyDocumentUrl } from "@/data/boiler-survey-service";
import { getLatestSignatureRequest, getSignedDocumentUrl } from "@/data/signature-service";
import { getQuoteDocuments } from "@/data/quote-documents-service";
import { getPropertyPhotoUrl } from "@/data/property-photo-service";
import { hasEasyPvProposal } from "@/data/easypv-proposal-service";
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
  const user = await requireStaffUser();

  const { id } = await params;
  const result = await getQuoteDetail(id);

  if (!result) notFound();

  const { quote, detail } = result;
  assertQuoteOwnedByUser(user, detail.assignedRepId);
  // Only this internal preview — the copy actually sent to the customer is built separately.
  if (!canViewCustomerPhone(user)) detail.customer.phone = "";

  const isBoiler = quote.productType === "boiler";

  const agreementType = isBoiler ? "boiler_installation_agreement" : "solar_installation_agreement";
  const waiverType = isBoiler ? "cooling_off_waiver" : "solar_cooling_off_waiver";
  const agreementTemplateHref = isBoiler ? "/api/agreement-templates/boiler-installation" : "/api/agreement-templates/solar-installation";
  const waiverTemplateHref = isBoiler ? "/api/agreement-templates/cooling-off-waiver" : "/api/agreement-templates/solar-cooling-off-waiver";
  const [
    snapshot,
    survey,
    surveyDocumentUrl,
    agreementRequest,
    agreementSignedDocumentUrl,
    waiverRequest,
    waiverSignedDocumentUrl,
    documents,
    designImageUrl,
    hasProposal,
  ] = await Promise.all([
    buildDocumentSnapshot(quote, detail),
    isBoiler ? getBoilerSurveyForQuote(id) : Promise.resolve(undefined),
    isBoiler ? getSurveyDocumentUrl(id) : Promise.resolve(undefined),
    getLatestSignatureRequest(id, agreementType),
    getSignedDocumentUrl(id, agreementType),
    getLatestSignatureRequest(id, waiverType),
    getSignedDocumentUrl(id, waiverType),
    getQuoteDocuments(id),
    isBoiler ? Promise.resolve(undefined) : getPropertyPhotoUrl(id),
    isBoiler ? Promise.resolve(false) : hasEasyPvProposal(id),
  ]);

  // Boiler jobs also cross-link their survey; both products have an Installation Agreement and a Cooling-Off Waiver
  // (each product's own wording — see agreementType / waiverType above).
  const signatureStatusLabel = (request: typeof agreementRequest) =>
    !request
      ? "Not sent yet"
      : request.status === "signed"
        ? "Signed"
        : request.status === "declined"
          ? "Declined"
          : request.status === "expired"
            ? "Link expired"
            : "Awaiting signature";

  const otherDocuments: RelatedDocumentLink[] = [
    ...(isBoiler
      ? [
          {
            label: "Boiler survey",
            href: survey?.status === "submitted" ? surveyDocumentUrl : undefined,
            statusLabel: !survey ? "Not started" : survey.status === "submitted" ? "Submitted" : "Awaiting survey",
          },
        ]
      : []),
    {
      label: "Installation agreement",
      // Always readable, even before it's ever been sent — the wording is fixed with nothing customer-specific in it, so
      // there's no reason to wait until sign-time. Once signed, this points at the signed copy (with the real signature
      // and audit trail) instead of the blank template.
      href: agreementRequest?.status === "signed" ? agreementSignedDocumentUrl : agreementTemplateHref,
      statusLabel: signatureStatusLabel(agreementRequest),
    },
    {
      label: "Cooling-off waiver",
      // Same "always readable" reasoning as the agreement above.
      href: waiverRequest?.status === "signed" ? waiverSignedDocumentUrl : waiverTemplateHref,
      statusLabel: signatureStatusLabel(waiverRequest),
    },
  ];

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
            designImageUrl={hasProposal ? undefined : designImageUrl}
            fullPdfUrl={hasProposal ? `/api/quotes/${id}/pdf` : undefined}
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
