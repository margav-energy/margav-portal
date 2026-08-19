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
import { SolarPropertyCard } from "@/components/quotes/solar/SolarPropertyCard";
import { SolarArraySection } from "@/components/quotes/solar/SolarArraySection";
import { SolarKeyDetailsCard } from "@/components/quotes/solar/SolarKeyDetailsCard";
import {
  cancelQuoteAppointment,
  logStaxPortalAction,
  logSurveyAction,
  recordPitchOutcome,
  updateSelectedPaymentMethod,
} from "@/components/quotes/actions";
import type { SolarQuoteDetail as SolarQuoteDetailData } from "@/types/solar-quote";
import type {
  CustomerDetails,
  LineItem,
  PaymentMethodOption,
  ProfitBreakdown,
  QuoteNote,
} from "@/types/quote-detail-shared";
import type { RepProfile } from "@/data/profiles-service";

export function SolarQuoteDetail({ detail, reps }: { detail: SolarQuoteDetailData; reps: RepProfile[] }) {
  const [locked, setLocked] = useState(detail.locked);
  const [favorite, setFavorite] = useState(detail.isFavourite);
  const [assignedRep, setAssignedRep] = useState(detail.assignedRep);
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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
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

  const actionButtons = buildActionButtons({
    quoteId: detail.quoteId,
    customerName: customer.name,
    secondaryPortalLabel: "STAX Portal",
    onSendQuote: () => setIsSendModalOpen(true),
    onSecondaryPortalAction: () => void logStaxPortalAction(detail.quoteId, customer.name),
    onCancelApp: () => void cancelQuoteAppointment(detail.quoteId, customer.name),
    onSurvey: () => void logSurveyAction(detail.quoteId, customer.name),
    onSelectPitchOutcome: handleSelectPitchOutcome,
  });

  return (
    <div className="flex flex-col gap-6">
      <QuoteHeader
        quoteId={detail.quoteId}
        customerName={customer.name}
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
            totalCost={totalCost}
            onSelect={handleSelectPaymentMethod}
            onChangeTermYears={handleChangeTermYears}
          />
          <SolarKeyDetailsCard keyDetails={detail.keyDetails} />
          <PricingCard items={detail.pricingBreakdown} />
          <ProfitCard
            quoteId={detail.quoteId}
            customerName={customer.name}
            profit={profit}
            onUpdated={setProfit}
          />
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
