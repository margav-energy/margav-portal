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
import { SolarPropertyCard } from "@/components/quotes/solar/SolarPropertyCard";
import { SolarArraySection } from "@/components/quotes/solar/SolarArraySection";
import { SolarKeyDetailsCard } from "@/components/quotes/solar/SolarKeyDetailsCard";
import { SignatureStatusCard } from "@/components/quotes/detail/SignatureStatusCard";
import { InstallerAssignmentCard } from "@/components/quotes/detail/InstallerAssignmentCard";
import { QuoteDocumentsCard } from "@/components/quotes/detail/QuoteDocumentsCard";
import {
  cancelQuoteAppointment,
  logStaxPortalAction,
  logSurveyAction,
  recordPitchOutcome,
  updateSelectedPaymentMethod,
} from "@/components/quotes/actions";
import type { SolarQuoteDetail as SolarQuoteDetailData } from "@/types/solar-quote";
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

export function SolarQuoteDetail({
  detail,
  reps,
  todayISO,
  signatureRequest,
  signedDocumentUrl,
  documents,
  isAdmin,
  propertyPhotoUrl,
}: {
  detail: SolarQuoteDetailData;
  reps: RepProfile[];
  todayISO: string;
  signatureRequest: SignatureRequestSummary | undefined;
  signedDocumentUrl: string | undefined;
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
  const [solarArrays, setSolarArrays] = useState(detail.solarArrays);
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
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [isAppointmentCancelled, setIsAppointmentCancelled] = useState(detail.installStatus === "cancelled");
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

  /**
   * Optimistic, same pattern as `handleToggleFavorite`/`handleToggleLocked`
   * in QuoteHeader — without this, the click had no visible effect anywhere
   * on this page (see the "Cancelled" pill this now drives), which read as
   * "the button doesn't work".
   */
  async function handleCancelApp() {
    setIsAppointmentCancelled(true);
    const ok = await cancelQuoteAppointment(detail.quoteId, customer.name);
    if (!ok) setIsAppointmentCancelled(false);
  }

  const actionButtons = buildActionButtons({
    quoteId: detail.quoteId,
    customerName: customer.name,
    appointmentId: detail.appointmentId,
    secondaryPortalLabel: "STAX Portal",
    onSendQuote: () => setIsSendModalOpen(true),
    onSecondaryPortalAction: () => void logStaxPortalAction(detail.quoteId, customer.name),
    onCancelApp: () => void handleCancelApp(),
    onSurvey: () => void logSurveyAction(detail.quoteId, customer.name),
    onSelectPitchOutcome: handleSelectPitchOutcome,
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
        appointmentCancelled={isAppointmentCancelled}
        appointmentDate={detail.appointmentDate}
        appointmentStartTime={detail.appointmentStartTime}
        appointmentEndTime={detail.appointmentEndTime}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col gap-6 md:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PropertyPhotoCard
              quoteId={detail.quoteId}
              customerName={customer.name}
              address={customer.addressLines.join(", ")}
              photoUrl={propertyPhotoUrl}
            />
            <CustomerCard quoteId={detail.quoteId} customer={customer} onUpdated={setCustomer} />
          </div>
          <SolarPropertyCard
            quoteId={detail.quoteId}
            customerName={customer.name}
            property={property}
            onUpdated={setProperty}
          />

          <SolarArraySection
            quoteId={detail.quoteId}
            customerName={customer.name}
            arrays={solarArrays}
            onArraysChange={setSolarArrays}
          />

          <LineItemsSection
            quoteId={detail.quoteId}
            customerName={customer.name}
            section="extra"
            title="Extras"
            items={extras}
            addLabel="Add extra"
            onItemsChange={setExtras}
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
          <SolarKeyDetailsCard keyDetails={detail.keyDetails} />
          <PricingCard items={detail.pricingBreakdown} extras={extras} />
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
          />
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
          <QuoteDocumentsCard quoteId={detail.quoteId} customerName={customer.name} documents={documents} />
        </div>
      </div>

      {isHistoryOpen && <HistoryModal history={detail.history} onClose={() => setIsHistoryOpen(false)} />}
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
    </div>
  );
}
