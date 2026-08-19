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
import type { ProfitBreakdown } from "@/types/quote-detail-shared";

/** `sellPrice`/`profit`/`marginPercent` always derive from `costPrice` + the Pricing card total — only `costPrice` is edited here. */
function deriveProfit(costPrice: number, sellPrice: number): Omit<ProfitBreakdown, "costPrice" | "sellPrice"> {
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
}: {
  quoteId: string;
  customerName: string;
  profit: ProfitBreakdown;
  onUpdated: (profit: ProfitBreakdown) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  function handleSave(costPrice: number) {
    onUpdated({ costPrice, sellPrice: profit.sellPrice, ...deriveProfit(costPrice, profit.sellPrice) });
    void updateQuoteCostPrice(quoteId, costPrice, customerName);
  }

  return (
    <Collapsible title="Profit">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-slate-500">Cost price</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-slate-900">{formatCurrency(profit.costPrice)}</span>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              aria-label="Edit cost price"
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <KeyDetailField label="Sell price" value={formatCurrency(profit.sellPrice)} />
        <KeyDetailField label="Profit" value={formatCurrency(profit.profit)} />
        <KeyDetailField label="Margin" value={`${profit.marginPercent}%`} />
      </div>

      {isEditing && (
        <EditCostPriceModal costPrice={profit.costPrice} onClose={() => setIsEditing(false)} onSave={handleSave} />
      )}
    </Collapsible>
  );
}
