import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getQuoteDetail } from "@/data/quotes-service";
import { getAllProfiles } from "@/data/profiles-service";
import { getBoilerCostSettings } from "@/data/boiler-cost-settings-service";
import { assertQuoteOwnedByUser, requireStaffUser } from "@/data/current-user";
import { getBoilerSurveyForQuote, getSurveyDocumentUrl } from "@/data/boiler-survey-service";
import { getLatestSignatureRequest, getSignedDocumentUrl } from "@/data/signature-service";
import { getQuoteDocuments } from "@/data/quote-documents-service";
import { getPropertyPhotoUrl } from "@/data/property-photo-service";
import { toISODate } from "@/lib/date-utils";
import { BoilerQuoteDetail } from "@/components/quotes/boiler/BoilerQuoteDetail";
import { SolarQuoteDetail } from "@/components/quotes/solar/SolarQuoteDetail";
import type { BoilerQuoteDetail as BoilerQuoteDetailData } from "@/types/boiler-quote";
import type { SolarQuoteDetail as SolarQuoteDetailData } from "@/types/solar-quote";

export default async function QuoteDetailPage({
  params,
}: PageProps<"/quotes/[id]">) {
  const user = await requireStaffUser();

  const { id } = await params;
  const [result, reps] = await Promise.all([getQuoteDetail(id), getAllProfiles()]);

  if (!result) notFound();

  const { quote, detail } = result;
  assertQuoteOwnedByUser(user, detail.assignedRepId);

  const isBoiler = quote.productType === "boiler";
  const [
    survey,
    surveyDocumentUrl,
    signatureRequest,
    signedDocumentUrl,
    agreementSignatureRequest,
    agreementSignedDocumentUrl,
    waiverSignatureRequest,
    waiverSignedDocumentUrl,
    documents,
    propertyPhotoUrl,
    boilerCostSettings,
  ] = await Promise.all([
    isBoiler ? getBoilerSurveyForQuote(id) : Promise.resolve(undefined),
    isBoiler ? getSurveyDocumentUrl(id) : Promise.resolve(undefined),
    getLatestSignatureRequest(id),
    getSignedDocumentUrl(id),
    isBoiler ? getLatestSignatureRequest(id, "boiler_installation_agreement") : Promise.resolve(undefined),
    isBoiler ? getSignedDocumentUrl(id, "boiler_installation_agreement") : Promise.resolve(undefined),
    isBoiler ? getLatestSignatureRequest(id, "cooling_off_waiver") : Promise.resolve(undefined),
    isBoiler ? getSignedDocumentUrl(id, "cooling_off_waiver") : Promise.resolve(undefined),
    getQuoteDocuments(id),
    getPropertyPhotoUrl(id),
    // Only boiler's Profit card recomputes cost/profit live client-side as
    // boiler units/extras change (see BoilerQuoteDetail.tsx) — it needs
    // these figures to do that with the same formula the server uses.
    isBoiler ? getBoilerCostSettings() : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Link
        href="/quotes"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all quotes
      </Link>
      {isBoiler ? (
        <BoilerQuoteDetail
          detail={detail as BoilerQuoteDetailData}
          reps={reps}
          todayISO={toISODate(new Date())}
          survey={survey}
          surveyDocumentUrl={surveyDocumentUrl}
          signatureRequest={signatureRequest}
          signedDocumentUrl={signedDocumentUrl}
          agreementSignatureRequest={agreementSignatureRequest}
          agreementSignedDocumentUrl={agreementSignedDocumentUrl}
          waiverSignatureRequest={waiverSignatureRequest}
          waiverSignedDocumentUrl={waiverSignedDocumentUrl}
          documents={documents}
          isAdmin={user.role === "admin"}
          propertyPhotoUrl={propertyPhotoUrl}
          // Non-null whenever isBoiler is true (see the Promise.all above).
          boilerCostSettings={boilerCostSettings!}
        />
      ) : (
        <SolarQuoteDetail
          detail={detail as SolarQuoteDetailData}
          reps={reps}
          todayISO={toISODate(new Date())}
          signatureRequest={signatureRequest}
          signedDocumentUrl={signedDocumentUrl}
          documents={documents}
          isAdmin={user.role === "admin"}
          propertyPhotoUrl={propertyPhotoUrl}
        />
      )}
    </div>
  );
}
