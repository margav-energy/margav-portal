"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuoteHeader } from "@/components/quotes/detail/QuoteHeader";
import { ActionButtonGrid } from "@/components/quotes/detail/ActionButtonGrid";
import { buildActionButtons } from "@/components/quotes/detail/build-action-buttons";
import { CustomerCard } from "@/components/quotes/detail/CustomerCard";
import { PropertyPhotoCard } from "@/components/quotes/detail/PropertyPhotoCard";
import { LineItemsSection } from "@/components/quotes/detail/LineItemsSection";
import { PaymentMethodCard } from "@/components/quotes/detail/PaymentMethodCard";
import { PricingCard } from "@/components/quotes/detail/PricingCard";
import { PricingAdjustmentsCard } from "@/components/quotes/detail/PricingAdjustmentsCard";
import type { PricingAdjustments } from "@/components/quotes/actions";
import { ProfitCard } from "@/components/quotes/detail/ProfitCard";
import { NotesPanel } from "@/components/quotes/detail/NotesPanel";
import { HistoryModal } from "@/components/quotes/detail/HistoryModal";
import { SendForSignatureModal } from "@/components/quotes/detail/SendForSignatureModal";
import { BoilerPropertyCard } from "@/components/quotes/boiler/BoilerPropertyCard";
import { BoilerUnitsSection } from "@/components/quotes/boiler/BoilerUnitsSection";
import { BoilerKeyDetailsCard } from "@/components/quotes/boiler/BoilerKeyDetailsCard";
import { BoilerSurveyCard } from "@/components/quotes/boiler/BoilerSurveyCard";
import { BoilerSurveyLaunchModal } from "@/components/quotes/boiler/BoilerSurveyLaunchModal";
import { SignatureStatusCard } from "@/components/quotes/detail/SignatureStatusCard";
import { InstallerAssignmentCard } from "@/components/quotes/detail/InstallerAssignmentCard";
import { QuoteDocumentsCard } from "@/components/quotes/detail/QuoteDocumentsCard";
import { EXTRAS_CATALOG } from "@/lib/extras-catalog";
import {
  cancelQuoteAppointment,
  logWarrantyRegistration,
  recordPitchOutcome,
  sendInstallationAgreement,
  updateSelectedPaymentMethod,
} from "@/components/quotes/actions";
import type { BoilerQuoteDetail as BoilerQuoteDetailData } from "@/types/boiler-quote";
import type { BoilerSurveyDetail } from "@/types/boiler-survey";
import type { SignatureRequestSummary } from "@/data/signature-service";
import type {
  CustomerDetails,
  LineItem,
  PaymentMethodOption,
  ProfitBreakdown,
  QuoteNote,
} from "@/types/quote-detail-shared";
import type { RepProfile } from "@/data/profiles-service";
import type { QuoteDocument } from "@/data/quote-documents-service";

export function BoilerQuoteDetail({
  detail,
  reps,
  todayISO,
  survey,
  surveyDocumentUrl,
  signatureRequest,
  signedDocumentUrl,
  agreementSignatureRequest,
  agreementSignedDocumentUrl,
  documents,
  isAdmin,
  propertyPhotoUrl,
}: {
  detail: BoilerQuoteDetailData;
  reps: RepProfile[];
  todayISO: string;
  survey: BoilerSurveyDetail | undefined;
  surveyDocumentUrl: string | undefined;
  signatureRequest: SignatureRequestSummary | undefined;
  signedDocumentUrl: string | undefined;
  agreementSignatureRequest: SignatureRequestSummary | undefined;
  agreementSignedDocumentUrl: string | undefined;
  documents: QuoteDocument[];
  isAdmin: boolean;
  propertyPhotoUrl: string | undefined;
}) {
  const [locked, setLocked] = useState(detail.locked);
  const [favorite, setFavorite] = useState(detail.isFavourite);
  const [assignedRep, setAssignedRep] = useState(detail.assignedRep);
  const [installerName, setInstallerName] = useState(detail.installerName);
  const [installDate, setInstallDate] = useState(detail.installDate);
  const [acceptanceStatus, setAcceptanceStatus] = useState(detail.installAcceptanceStatus);
  const [customer, setCustomer] = useState<CustomerDetails>(detail.customer);
  const [property, setProperty] = useState(detail.property);
  const [boilerUnits, setBoilerUnits] = useState(detail.boilerUnits);
  const [extras, setExtras] = useState<LineItem[]>(detail.extras);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodOption>(
    detail.selectedPaymentMethod,
  );
  const [monthlyPlanTermYears, setMonthlyPlanTermYears] = useState<number | undefined>(
    detail.monthlyPlanTermYears,
  );
  const [notes, setNotes] = useState<QuoteNote[]>(detail.notes);
  const [profit, setProfit] = useState<ProfitBreakdown>(detail.profitBreakdown);
  const [pricingAdjustments, setPricingAdjustments] = useState<PricingAdjustments>({
    vatAmount: detail.vatAmount,
    discountAmount: detail.discountAmount,
    depositAmount: detail.depositAmount,
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isAgreementModalOpen, setIsAgreementModalOpen] = useState(false);
  const router = useRouter();

  const totalCost = detail.pricingBreakdown.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  // What the customer actually owes and what the signed document's monthly
  // plan figure is based on (see `buildDocumentSnapshot` in
  // src/lib/esignature/document.ts) — the Payment Method card's own preview
  // needs to match that, not the pre-discount subtotal above.
  const totalAfterDiscount = totalCost - pricingAdjustments.discountAmount;

  function handleSelectPaymentMethod(method: PaymentMethodOption) {
    setSelectedPaymentMethod(method);
    const termYears = method === "monthly_plan" ? (monthlyPlanTermYears ?? 10) : null;
    if (method === "monthly_plan") setMonthlyPlanTermYears(termYears ?? undefined);
    void updateSelectedPaymentMethod(detail.quoteId, method, termYears, customer.name);
  }

  function handleChangeTermYears(years: number) {
    setMonthlyPlanTermYears(years);
    void updateSelectedPaymentMethod(detail.quoteId, "monthly_plan", years, customer.name);
  }

  async function handleSelectPitchOutcome(outcome: string) {
    const note = await recordPitchOutcome(detail.quoteId, outcome, customer.name);
    if (note) setNotes((current) => [note, ...current]);
  }

  const primaryUnit = boilerUnits[0];

  const actionButtons = buildActionButtons({
    quoteId: detail.quoteId,
    customerName: customer.name,
    secondaryPortalLabel: "Warranty Registration",
    onSendQuote: () => setIsSendModalOpen(true),
    onSecondaryPortalAction: () => {
      window.open("https://www.myintergasregistration.co.uk/app/installer_login", "_blank", "noopener,noreferrer");
      void logWarrantyRegistration(detail.quoteId, customer.name);
    },
    onCancelApp: () => void cancelQuoteAppointment(detail.quoteId, customer.name),
    onSurvey: () => setIsSurveyModalOpen(true),
    onSelectPitchOutcome: handleSelectPitchOutcome,
    onInstallationAgreement: () => setIsAgreementModalOpen(true),
  });

  return (
    <div className="flex flex-col gap-6">
      <QuoteHeader
        quoteId={detail.quoteId}
        customerName={customer.name}
        customerEmail={customer.email}
        reference={detail.reference}
        version={detail.version}
        statusLabel={detail.statusLabel}
        pipelineStatus={detail.pipelineStatus}
        isAdmin={isAdmin}
        locked={locked}
        onToggleLocked={setLocked}
        favorite={favorite}
        onToggleFavorite={setFavorite}
        assignedRepName={assignedRep}
        reps={reps}
        onChangeRep={(_repId, repName) => setAssignedRep(repName)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        noteCount={notes.length}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col gap-6 md:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PropertyPhotoCard quoteId={detail.quoteId} customerName={customer.name} photoUrl={propertyPhotoUrl} />
            <CustomerCard quoteId={detail.quoteId} customer={customer} onUpdated={setCustomer} />
          </div>
          <BoilerPropertyCard
            quoteId={detail.quoteId}
            customerName={customer.name}
            property={property}
            onUpdated={setProperty}
          />

          <BoilerUnitsSection
            quoteId={detail.quoteId}
            customerName={customer.name}
            units={boilerUnits}
            onUnitsChange={setBoilerUnits}
          />

          <LineItemsSection
            quoteId={detail.quoteId}
            customerName={customer.name}
            section="extra"
            title="Extras"
            items={extras}
            addLabel="Add extra"
            onItemsChange={setExtras}
            catalog={EXTRAS_CATALOG}
          />
          <NotesPanel
            quoteId={detail.quoteId}
            customerName={customer.name}
            notes={notes}
            onNoteAdded={(note) => setNotes((current) => [note, ...current])}
          />
        </div>

        <div className="flex flex-col gap-4">
          <ActionButtonGrid buttons={actionButtons} />
          <PaymentMethodCard
            selected={selectedPaymentMethod}
            termYears={monthlyPlanTermYears}
            totalCost={totalAfterDiscount}
            onSelect={handleSelectPaymentMethod}
            onChangeTermYears={handleChangeTermYears}
          />
          {primaryUnit && <BoilerKeyDetailsCard unit={primaryUnit} keyDetails={detail.keyDetails} profit={profit} />}
          <PricingCard items={detail.pricingBreakdown} />
          <PricingAdjustmentsCard
            quoteId={detail.quoteId}
            customerName={customer.name}
            subtotal={totalCost}
            adjustments={pricingAdjustments}
            onUpdated={setPricingAdjustments}
          />
          <ProfitCard
            quoteId={detail.quoteId}
            customerName={customer.name}
            profit={profit}
            onUpdated={setProfit}
            editable={false}
          />
          <BoilerSurveyCard survey={survey} documentUrl={surveyDocumentUrl} />
          <InstallerAssignmentCard
            quoteId={detail.quoteId}
            customerName={customer.name}
            installerName={installerName}
            installDate={installDate}
            acceptanceStatus={acceptanceStatus}
            todayISO={todayISO}
            onAssigned={(nextInstallerName, nextInstallDate) => {
              setInstallerName(nextInstallerName);
              setInstallDate(nextInstallDate);
              setAcceptanceStatus("pending");
            }}
            onUnassigned={() => {
              setInstallerName(undefined);
              setAcceptanceStatus(undefined);
              setInstallDate(undefined);
            }}
          />
          <SignatureStatusCard
            request={signatureRequest}
            signedDocumentUrl={signedDocumentUrl}
            readHref={`/api/quotes/${detail.quoteId}/pdf`}
            readLabel="Read the quote"
          />
          <SignatureStatusCard
            title="Installation Agreement"
            emptyActionLabel="Installation Agreement"
            request={agreementSignatureRequest}
            signedDocumentUrl={agreementSignedDocumentUrl}
            readHref="/api/agreement-templates/boiler-installation"
            readLabel="Read the agreement"
          />
          <QuoteDocumentsCard quoteId={detail.quoteId} customerName={customer.name} documents={documents} />
        </div>
      </div>

      {isHistoryOpen && <HistoryModal history={detail.history} onClose={() => setIsHistoryOpen(false)} />}
      {isSurveyModalOpen && (
        <BoilerSurveyLaunchModal
          quoteId={detail.quoteId}
          customerName={customer.name}
          survey={survey}
          documentUrl={surveyDocumentUrl}
          onClose={() => {
            setIsSurveyModalOpen(false);
            router.refresh();
          }}
        />
      )}
      {isSendModalOpen && (
        <SendForSignatureModal
          quoteId={detail.quoteId}
          customerName={customer.name}
          customerEmail={customer.email}
          onClose={() => {
            setIsSendModalOpen(false);
            router.refresh();
          }}
        />
      )}
      {isAgreementModalOpen && (
        <SendForSignatureModal
          quoteId={detail.quoteId}
          customerName={customer.name}
          customerEmail={customer.email}
          title="Send Installation Agreement"
          documentLabel="installation agreement"
          sendAction={sendInstallationAgreement}
          onClose={() => {
            setIsAgreementModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
