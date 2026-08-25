"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Collapsible } from "@/components/quotes/detail/Collapsible";
import { KeyDetailField } from "@/components/quotes/detail/KeyDetailField";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { formatCurrency } from "@/lib/format";
import { updatePricingAdjustments, type PricingAdjustments } from "@/components/quotes/actions";

function EditAdjustmentsModal({
  adjustments,
  onClose,
  onSave,
}: {
  adjustments: PricingAdjustments;
  onClose: () => void;
  onSave: (adjustments: PricingAdjustments) => void;
}) {
  const [vat, setVat] = useState(String(adjustments.vatAmount));
  const [discount, setDiscount] = useState(String(adjustments.discountAmount));
  const [deposit, setDeposit] = useState(String(adjustments.depositAmount));

  function handleSave() {
    onSave({
      vatAmount: Number(vat) || 0,
      discountAmount: Number(discount) || 0,
      depositAmount: Number(deposit) || 0,
    });
    onClose();
  }

  return (
    <Modal title="Edit pricing adjustments" onClose={onClose}>
      <div className="flex flex-col gap-4 px-5 py-5">
        <FormField label="Included VAT (£)" htmlFor="vat-amount">
          <input
            id="vat-amount"
            type="number"
            min="0"
            step="0.01"
            autoFocus
            className={inputClassName}
            value={vat}
            onChange={(event) => setVat(event.target.value)}
          />
        </FormField>
        <FormField label="Discount (£)" htmlFor="discount-amount">
          <input
            id="discount-amount"
            type="number"
            min="0"
            step="0.01"
            className={inputClassName}
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
          />
        </FormField>
        <FormField label="Deposit (£)" htmlFor="deposit-amount">
          <input
            id="deposit-amount"
            type="number"
            min="0"
            step="0.01"
            className={inputClassName}
            value={deposit}
            onChange={(event) => setDeposit(event.target.value)}
          />
        </FormField>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="success" onClick={handleSave}>
          Save
        </Button>
      </div>
    </Modal>
  );
}

/**
 * The "System Summary" figures a generated quote can't derive on its own —
 * VAT (informational: this business quotes VAT-inclusive, so it's never
 * added on top of the subtotal), a discount, and a deposit. Feeds
 * `buildDocumentSnapshot` (src/lib/esignature/document.ts), so editing here
 * changes what both the customer's /sign/[token] page and "View Quote"
 * show.
 */
export function PricingAdjustmentsCard({
  quoteId,
  customerName,
  subtotal,
  adjustments,
  onUpdated,
}: {
  quoteId: string;
  customerName: string;
  subtotal: number;
  adjustments: PricingAdjustments;
  onUpdated: (adjustments: PricingAdjustments) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const total = subtotal - adjustments.discountAmount;

  function handleSave(next: PricingAdjustments) {
    onUpdated(next);
    void updatePricingAdjustments(quoteId, next, customerName);
  }

  return (
    <Collapsible title="System Summary">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-slate-500">Subtotal incl. VAT</span>
          <span className="text-sm font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-slate-500">Included VAT</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-900">{formatCurrency(adjustments.vatAmount)}</span>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              aria-label="Edit pricing adjustments"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <KeyDetailField label="Discount" value={`-${formatCurrency(adjustments.discountAmount)}`} />
        <div className="mt-1 flex items-baseline justify-between border-t border-slate-100 pt-2">
          <span className="text-sm font-semibold text-slate-700">Total</span>
          <span className="text-sm font-semibold text-slate-900">{formatCurrency(total)}</span>
        </div>
        <KeyDetailField label="Deposit" value={formatCurrency(adjustments.depositAmount)} />
      </div>

      {isEditing && (
        <EditAdjustmentsModal adjustments={adjustments} onClose={() => setIsEditing(false)} onSave={handleSave} />
      )}
    </Collapsible>
  );
}
