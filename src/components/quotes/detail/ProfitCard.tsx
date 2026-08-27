"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Collapsible } from "@/components/quotes/detail/Collapsible";
import { KeyDetailField } from "@/components/quotes/detail/KeyDetailField";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { formatCurrency } from "@/lib/format";
import { updateQuoteCostPrice } from "@/components/quotes/actions";
import { VISIBLE_COST_LINE_ITEM_NAMES } from "@/lib/boiler-install-cost";
import type { ProfitBreakdown } from "@/types/quote-detail-shared";

/** `profit`/`marginPercent` always derive from `costPrice` + the Pricing card total. */
function deriveProfit(costPrice: number, sellPrice: number): { profit: number; marginPercent: number } {
  const profit = sellPrice - costPrice;
  return { profit, marginPercent: sellPrice > 0 ? Math.round((profit / sellPrice) * 1000) / 10 : 0 };
}

function EditCostPriceModal({
  costPrice,
  onClose,
  onSave,
}: {
  costPrice: number;
  onClose: () => void;
  onSave: (costPrice: number) => void;
}) {
  const [value, setValue] = useState(String(costPrice));

  function handleSave() {
    onSave(Number(value) || 0);
    onClose();
  }

  return (
    <Modal title="Edit cost price" onClose={onClose}>
      <div className="flex flex-col gap-4 px-5 py-5">
        <FormField label="Cost price (£)" htmlFor="cost-price" required>
          <input
            id="cost-price"
            type="number"
            min="0"
            step="0.01"
            autoFocus
            className={inputClassName}
            value={value}
            onChange={(event) => setValue(event.target.value)}
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

export function ProfitCard({
  quoteId,
  customerName,
  profit,
  onUpdated,
  editable = true,
}: {
  quoteId: string;
  customerName: string;
  profit: ProfitBreakdown;
  onUpdated: (profit: ProfitBreakdown) => void;
  /**
   * Boiler quotes pass `false` — their cost price is Margav's real install
   * cost (see `src/lib/boiler-install-cost.ts`, admin-editable at
   * Settings → Boiler Install Costs), not a per-quote estimate, so there's
   * nothing to override here. Solar has no cost model yet and defaults to
   * `true` (a rep enters it manually).
   */
  editable?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);

  function handleSave(costPrice: number) {
    onUpdated({ ...profit, costPrice, ...deriveProfit(costPrice, profit.sellPrice) });
    void updateQuoteCostPrice(quoteId, costPrice, customerName);
  }

  // Cost price is still the full sum of everything (boiler unit, flue,
  // Fernox Filter, Gateway, Installer Cost, Rep Comms, extras — see
  // `boilerCostBreakdown` in src/lib/boiler-install-cost.ts) — just not
  // broken out line by line here. Installer Cost and Rep Comms are the two
  // exceptions kept visible.
  const visibleCostLineItems =
    profit.costLineItems?.filter((item) => VISIBLE_COST_LINE_ITEM_NAMES.includes(item.name)) ?? [];
  const hasCostLineItems = visibleCostLineItems.length > 0;

  return (
    <Collapsible title="Profit">
      <div className="flex flex-col gap-2">
        {/* Red throughout, same as Discount elsewhere in this app — these
            are outgoing costs, unlike Profit/Margin below which are the
            result and are shown in green. */}
        {visibleCostLineItems.map((item, index) => (
          <div key={index} className="flex items-baseline justify-between">
            <span className="text-sm text-slate-500">{item.name}</span>
            <span className="text-sm font-medium text-red-600">-{formatCurrency(item.amount)}</span>
          </div>
        ))}
        <div
          className={`flex items-baseline justify-between ${hasCostLineItems ? "border-t border-slate-100 pt-2" : ""}`}
        >
          <span className="text-sm text-slate-500">Cost price</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-red-600">{formatCurrency(profit.costPrice)}</span>
            {editable && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                aria-label="Edit cost price"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <KeyDetailField label="Sell price" value={formatCurrency(profit.sellPrice)} />
        <KeyDetailField label="Profit" value={formatCurrency(profit.profit)} valueClassName="text-brand-green-mid" />
        <KeyDetailField label="Margin" value={`${profit.marginPercent}%`} valueClassName="text-brand-green-mid" />
      </div>

      {editable && isEditing && (
        <EditCostPriceModal costPrice={profit.costPrice} onClose={() => setIsEditing(false)} onSave={handleSave} />
      )}
    </Collapsible>
  );
}
