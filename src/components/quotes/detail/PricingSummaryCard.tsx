"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible } from "@/components/quotes/detail/Collapsible";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DISCOUNT_REASONS } from "@/lib/discount-reasons";
import { aprForTermYears, monthlyRepayment, MONTHLY_PLAN_TERM_YEARS } from "@/lib/finance";
import { updatePricingAdjustments, type PricingAdjustments } from "@/components/quotes/actions";
import type { LineItem, PaymentMethodOption } from "@/types/quote-detail-shared";

const DEFAULT_TERM_YEARS = MONTHLY_PLAN_TERM_YEARS[MONTHLY_PLAN_TERM_YEARS.length - 1];

function EditAdjustmentsModal({
  adjustments,
  onClose,
  onSave,
}: {
  adjustments: PricingAdjustments;
  onClose: () => void;
  onSave: (adjustments: PricingAdjustments) => void;
}) {
  const [discount, setDiscount] = useState(String(adjustments.discountAmount));
  const [reason, setReason] = useState(adjustments.discountReason);
  const [deposit, setDeposit] = useState(String(adjustments.depositAmount));

  function handleSave() {
    const discountAmount = Number(discount) || 0;
    onSave({
      // VAT isn't editable — prices already include it — so whatever's stored passes through untouched.
      vatAmount: adjustments.vatAmount,
      discountAmount,
      discountReason: reason,
      depositAmount: Number(deposit) || 0,
    });
    onClose();
  }

  return (
    <Modal title="Edit pricing" onClose={onClose}>
      <div className="flex flex-col gap-4 px-5 py-5">
        <FormField label="Discount (£)" htmlFor="discount-amount">
          <input
            id="discount-amount"
            type="number"
            min="0"
            step="0.01"
            autoFocus
            className={inputClassName}
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
          />
        </FormField>
        <FormField label="Discount reason" htmlFor="discount-reason">
          <select id="discount-reason" className={inputClassName} value={reason} onChange={(event) => setReason(event.target.value)}>
            <option value="">None</option>
            {DISCOUNT_REASONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            {/* A reason saved before the list changed still shows rather than silently becoming "None". */}
            {reason && !(DISCOUNT_REASONS as readonly string[]).includes(reason) && <option value={reason}>{reason}</option>}
          </select>
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

function PriceTableModal({ amount, selectedTermYears, onClose }: { amount: number; selectedTermYears: number | undefined; onClose: () => void }) {
  return (
    <Modal title="Price table" onClose={onClose}>
      <div className="px-5 py-5">
        <table className="w-full text-center text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <th className="rounded-l-lg px-3 py-3">Years</th>
              <th className="px-3 py-3">Monthly plan</th>
              <th className="rounded-r-lg px-3 py-3">APR</th>
            </tr>
          </thead>
          <tbody>
            {MONTHLY_PLAN_TERM_YEARS.map((years) => (
              <tr key={years} className={cn("border-b border-slate-100 last:border-0", years === selectedTermYears && "bg-brand-blue/5 font-semibold")}>
                <td className="px-3 py-3">{years}</td>
                <td className="px-3 py-3">{formatCurrency(monthlyRepayment(amount, years))}</td>
                <td className="px-3 py-3 text-slate-500">{aprForTermYears(years)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-slate-500">Monthly payments on {formatCurrency(amount)}, the total after discount.</p>
      </div>
      <div className="flex justify-end border-t border-slate-100 px-5 py-4">
        <Button variant="success" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-900">{children}</span>
    </div>
  );
}

/**
 * The quote's price in one card. System Cost is every item added up; Net Total takes off the discount;
 * Gross Total is the same figure (this business quotes VAT-inclusive prices, so VAT is informational, never
 * added on top); Final Total takes off the deposit. Monthly Price uses the Net Total and the plan term chosen
 * on the Payment method card — the same figure the signed quote document shows. Discount, its reason and the
 * deposit open one edit form, and feed `buildDocumentSnapshot` (src/lib/esignature/document.ts).
 */
export function PricingSummaryCard({
  quoteId,
  customerName,
  items,
  extras,
  adjustments,
  onUpdated,
  selectedMethod,
  termYears,
  locked = false,
}: {
  quoteId: string;
  customerName: string;
  /** `detail.pricingBreakdown`. */
  items: LineItem[];
  /** When given, swaps the single "Extras" row for these individual entries in the itemised list. */
  extras?: LineItem[];
  adjustments: PricingAdjustments;
  onUpdated: (adjustments: PricingAdjustments) => void;
  selectedMethod: PaymentMethodOption;
  termYears: number | undefined;
  /** Mirrors the quote's Lock/Unlock toggle (QuoteHeader.tsx) — disables editing while locked. */
  locked?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isTableOpen, setIsTableOpen] = useState(false);
  const [showItems, setShowItems] = useState(false);

  const displayItems =
    extras && extras.length > 0 ? items.flatMap((item) => (item.name === "Extras" ? extras : [item])) : items;
  const systemCost = displayItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const netTotal = systemCost - adjustments.discountAmount;
  const grossTotal = netTotal;
  const finalTotal = grossTotal - adjustments.depositAmount;
  const term = termYears ?? DEFAULT_TERM_YEARS;
  const monthly = selectedMethod === "monthly_plan" ? monthlyRepayment(netTotal, term) : undefined;

  function handleSave(next: PricingAdjustments) {
    onUpdated(next);
    void updatePricingAdjustments(quoteId, next, customerName);
  }

  const editLink = (value: string) => (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      disabled={locked}
      title={locked ? "Unlock this quote to make changes" : "Edit"}
      className="text-brand-blue hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
    >
      {value}
    </button>
  );

  return (
    <Collapsible title="Pricing">
      <div className="grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
        <div className="flex flex-col gap-2.5">
          <Row label="System Cost">{formatCurrency(systemCost)}</Row>
          <Row label="Net Total">{formatCurrency(netTotal)}</Row>
          <Row label="Gross Total">{formatCurrency(grossTotal)}</Row>
          <Row label="Deposit">{editLink(formatCurrency(adjustments.depositAmount))}</Row>
          <Row label="Monthly Price">{monthly !== undefined ? formatCurrency(monthly) : "—"}</Row>
        </div>
        <div className="flex flex-col gap-2.5">
          <Row label="Discount">{editLink(formatCurrency(adjustments.discountAmount))}</Row>
          <Row label="Discount Reason">
            <select
              aria-label="Discount reason"
              value={adjustments.discountReason}
              onChange={(event) => handleSave({ ...adjustments, discountReason: event.target.value })}
              disabled={locked}
              title={locked ? "Unlock this quote to make changes" : undefined}
              className="max-w-[11rem] cursor-pointer rounded-md bg-transparent py-0.5 text-right text-brand-blue outline-none hover:underline focus:ring-1 focus:ring-brand-blue disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">Select reason</option>
              {DISCOUNT_REASONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
              {/* A reason saved before the list changed still shows rather than silently becoming blank. */}
              {adjustments.discountReason && !(DISCOUNT_REASONS as readonly string[]).includes(adjustments.discountReason) && (
                <option value={adjustments.discountReason}>{adjustments.discountReason}</option>
              )}
            </select>
          </Row>
          <Row label="VAT">{formatCurrency(adjustments.vatAmount)}</Row>
          <Row label="Final Total">{formatCurrency(finalTotal)}</Row>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <Button variant="secondary" className="text-xs" onClick={() => setIsTableOpen(true)}>
          View price table
        </Button>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setShowItems((open) => !open)}
          aria-expanded={showItems}
          className="flex w-full items-center justify-between text-xs font-semibold tracking-wide text-slate-500 uppercase"
        >
          What it&apos;s made up of
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", showItems && "rotate-180")} />
        </button>
        {showItems && (
          <div className="mt-3 flex flex-col gap-2">
            {displayItems.length === 0 && <p className="text-sm text-slate-400">Nothing has been added to this quote yet.</p>}
            {displayItems.map((item) => (
              <Row key={item.id} label={item.name}>
                {formatCurrency(item.unitPrice * item.quantity)}
              </Row>
            ))}
          </div>
        )}
      </div>

      {isEditing && <EditAdjustmentsModal adjustments={adjustments} onClose={() => setIsEditing(false)} onSave={handleSave} />}
      {isTableOpen && <PriceTableModal amount={netTotal} selectedTermYears={monthly !== undefined ? term : undefined} onClose={() => setIsTableOpen(false)} />}
    </Collapsible>
  );
}
