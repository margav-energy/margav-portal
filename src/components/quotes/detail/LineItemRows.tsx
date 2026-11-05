"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { LineItem } from "@/types/quote-detail-shared";

/**
 * Priced line items as three aligned columns — name (right-aligned), "× qty", price.
 * With `foldable`, the first line is bold with a chevron that hides the rest (the solar array's panel line).
 */
export function LineItemRows({
  items,
  foldable = false,
  priceFor,
}: {
  items: LineItem[];
  foldable?: boolean;
  /** Replaces the default price text for an item, e.g. "Included — £0.00". */
  priceFor?: (item: LineItem) => ReactNode | undefined;
}) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;
  const rows = foldable && !open ? items.slice(0, 1) : items;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_7rem] items-center gap-x-4 gap-y-3 px-5 py-5 text-sm text-slate-700 sm:mx-auto sm:w-fit sm:min-w-[32rem] sm:grid-cols-[minmax(14rem,1fr)_3.5rem_7rem]">
      {rows.map((item, index) => {
        const lead = foldable && index === 0;
        return (
          <div key={item.id} className="contents">
            <span className={lead ? "flex items-center justify-end gap-2 font-bold text-slate-900" : "text-right"}>
              {lead && (
                <button
                  type="button"
                  onClick={() => setOpen((current) => !current)}
                  aria-label={open ? "Hide the other items" : "Show the other items"}
                  aria-expanded={open}
                  className="text-slate-500 hover:text-slate-900"
                >
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              )}
              {item.name}
            </span>
            <span className="text-slate-500">&times; {item.quantity}</span>
            <span className="text-right text-slate-900">
              {priceFor?.(item) ?? formatCurrency(item.unitPrice * item.quantity)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
