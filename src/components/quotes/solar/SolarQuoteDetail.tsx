"use client";

import { useState } from "react";
import { QuoteHeader } from "@/components/quotes/detail/QuoteHeader";
import { ActionButtonGrid, type HeaderActionButton } from "@/components/quotes/detail/ActionButtonGrid";
import { CustomerCard } from "@/components/quotes/detail/CustomerCard";
import { PropertyImagePlaceholder } from "@/components/quotes/detail/PropertyImagePlaceholder";
import { LineItemsSection } from "@/components/quotes/detail/LineItemsSection";
import { PaymentMethodCard } from "@/components/quotes/detail/PaymentMethodCard";
import { PricingCard } from "@/components/quotes/detail/PricingCard";
import { ProfitCard } from "@/components/quotes/detail/ProfitCard";
import { NotesPanel } from "@/components/quotes/detail/NotesPanel";
import { HistoryModal } from "@/components/quotes/detail/HistoryModal";
import { SolarPropertyCard } from "@/components/quotes/solar/SolarPropertyCard";
import { SolarArraySection } from "@/components/quotes/solar/SolarArraySection";
import { SolarKeyDetailsCard } from "@/components/quotes/solar/SolarKeyDetailsCard";
import type { SolarQuoteDetail as SolarQuoteDetailData } from "@/types/solar-quote";
import type { PaymentMethodOption, QuoteNote } from "@/types/quote-detail-shared";

const ACTION_BUTTONS: HeaderActionButton[] = [
  { label: "Presenter", variant: "primary" },
  { label: "View Quote", variant: "primary" },
  { label: "Send Quote", variant: "primary" },
  { label: "STAX Portal", variant: "primary" },
  { label: "Cancel App", variant: "primary" },
  { label: "Pitch Outcome", variant: "primary" },
  { label: "Rebook App", variant: "primary" },
  { label: "Survey", variant: "primary" },
  { label: "Archive", variant: "danger" },
];

let noteIdCounter = 0;

export function SolarQuoteDetail({ detail }: { detail: SolarQuoteDetailData }) {
  const [locked, setLocked] = useState(detail.locked);
  const [favorite, setFavorite] = useState(false);
  const [assignedRep, setAssignedRep] = useState(detail.assignedRep);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodOption>(
    detail.selectedPaymentMethod,
  );
  const [notes, setNotes] = useState<QuoteNote[]>(detail.notes);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  function handleAddNote(body: string) {
    const note: QuoteNote = {
      id: `local-note-${noteIdCounter++}`,
      authorName: "You",
      authorInitials: "Y",
      timestamp: new Date().toISOString(),
      body,
    };
    setNotes((current) => [note, ...current]);
  }

  return (
    <div className="flex flex-col gap-6">
      <QuoteHeader
        reference={detail.reference}
        version={detail.version}
        statusLabel={detail.statusLabel}
        locked={locked}
        onToggleLocked={setLocked}
        favorite={favorite}
        onToggleFavorite={() => setFavorite((current) => !current)}
        assignedRep={assignedRep}
        onChangeRep={setAssignedRep}
        onOpenHistory={() => setIsHistoryOpen(true)}
        noteCount={notes.length}
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col gap-6 md:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PropertyImagePlaceholder />
            <CustomerCard customer={detail.customer} />
          </div>
          <SolarPropertyCard property={detail.property} />

          <SolarArraySection arrays={detail.solarArrays} />

          <LineItemsSection title="Extras" items={detail.extras} addLabel="Add extra" />
          <LineItemsSection
            title="Standard Additionals"
            items={detail.standardAdditionals}
            addLabel="Add standard additional"
          />
          <LineItemsSection
            title="Free-text Extras"
            items={detail.freeTextExtras.map((extra) => ({
              id: extra.id,
              name: extra.description,
              quantity: extra.quantity,
              unitPrice: extra.unitPrice,
            }))}
            addLabel="Add a free-text extra"
          />

          <NotesPanel notes={notes} onAddNote={handleAddNote} />
        </div>

        <div className="flex flex-col gap-4">
          <ActionButtonGrid buttons={ACTION_BUTTONS} />
          <PaymentMethodCard selected={selectedPaymentMethod} onSelect={setSelectedPaymentMethod} />
          <SolarKeyDetailsCard keyDetails={detail.keyDetails} />
          <PricingCard items={detail.pricingBreakdown} />
          <ProfitCard profit={detail.profitBreakdown} />
        </div>
      </div>

      {isHistoryOpen && <HistoryModal history={detail.history} onClose={() => setIsHistoryOpen(false)} />}
    </div>
  );
}
