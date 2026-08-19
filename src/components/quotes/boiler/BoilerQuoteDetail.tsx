"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QuoteHeader } from "@/components/quotes/detail/QuoteHeader";
import { ActionButtonGrid } from "@/components/quotes/detail/ActionButtonGrid";
import { buildActionButtons } from "@/components/quotes/detail/build-action-buttons";
import { CustomerCard } from "@/components/quotes/detail/CustomerCard";
import { PropertyImagePlaceholder } from "@/components/quotes/detail/PropertyImagePlaceholder";
import { LineItemsSection } from "@/components/quotes/detail/LineItemsSection";
import { PaymentMethodCard } from "@/components/quotes/detail/PaymentMethodCard";
import { PricingCard } from "@/components/quotes/detail/PricingCard";
import { ProfitCard } from "@/components/quotes/detail/ProfitCard";
import { NotesPanel } from "@/components/quotes/detail/NotesPanel";
import { HistoryModal } from "@/components/quotes/detail/HistoryModal";
import { SendForSignatureModal } from "@/components/quotes/detail/SendForSignatureModal";
import { BoilerPropertyCard } from "@/components/quotes/boiler/BoilerPropertyCard";
import { BoilerUnitsSection } from "@/components/quotes/boiler/BoilerUnitsSection";
import { BoilerKeyDetailsCard } from "@/components/quotes/boiler/BoilerKeyDetailsCard";
import { BoilerSurveyCard } from "@/components/quotes/boiler/BoilerSurveyCard";
import { BoilerSurveyLaunchModal } from "@/components/quotes/boiler/BoilerSurveyLaunchModal";
import { EXTRAS_CATALOG } from "@/lib/extras-catalog";
import {
  cancelQuoteAppointment,
  logWarrantyRegistration,
  recordPitchOutcome,
  updateSelectedPaymentMethod,
} from "@/components/quotes/actions";
import type { BoilerQuoteDetail as BoilerQuoteDetailData } from "@/types/boiler-quote";
import type { BoilerSurveyDetail } from "@/types/boiler-survey";
import type {
  CustomerDetails,
  LineItem,
  PaymentMethodOption,
  ProfitBreakdown,
  QuoteNote,
} from "@/types/quote-detail-shared";
import type { RepProfile } from "@/data/profiles-service";

export function BoilerQuoteDetail({
  detail,
  reps,
  survey,
}: {
  detail: BoilerQuoteDetailData;
  reps: RepProfile[];
  survey: BoilerSurveyDetail | undefined;
}) {
  const [locked, setLocked] = useState(detail.locked);
  const [favorite, setFavorite] = useState(detail.isFavourite);
  const [assignedRep, setAssignedRep] = useState(detail.assignedRep);
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const router = useRouter();

  const totalCost = detail.pricingBreakdown.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

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
    onSecondaryPortalAction: () => void logWarrantyRegistration(detail.quoteId, customer.name),
    onCancelApp: () => void cancelQuoteAppointment(detail.quoteId, customer.name),
    onSurvey: () => setIsSurveyModalOpen(true),
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
            <PropertyImagePlaceholder />
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
            totalCost={totalCost}
            onSelect={handleSelectPaymentMethod}
            onChangeTermYears={handleChangeTermYears}
          />
          {primaryUnit && <BoilerKeyDetailsCard unit={primaryUnit} keyDetails={detail.keyDetails} profit={profit} />}
          <PricingCard items={detail.pricingBreakdown} />
          <ProfitCard
            quoteId={detail.quoteId}
            customerName={customer.name}
            profit={profit}
            onUpdated={setProfit}
          />
          <BoilerSurveyCard survey={survey} />
        </div>
      </div>

      {isHistoryOpen && <HistoryModal history={detail.history} onClose={() => setIsHistoryOpen(false)} />}
      {isSurveyModalOpen && (
        <BoilerSurveyLaunchModal
          quoteId={detail.quoteId}
          customerName={customer.name}
          survey={survey}
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
    </div>
  );
}
