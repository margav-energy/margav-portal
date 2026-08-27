import { Collapsible } from "@/components/quotes/detail/Collapsible";
import { KeyDetailField } from "@/components/quotes/detail/KeyDetailField";
import { formatCurrency } from "@/lib/format";
import type { LineItem } from "@/types/quote-detail-shared";

/**
 * `items` (`detail.pricingBreakdown`) lumps every extra into one "Extras"
 * bucket row — fine for the e-signature document and presenter slides,
 * which itemize extras their own way (see `document.ts`'s
 * `AGGREGATED_SECTION_NAMES`), but a rep looking at this card needs to see
 * what each extra actually is, not a generic total. When `extras` is
 * given, this swaps that one "Extras" row for its individual entries in
 * place — same total either way, since it's the same underlying amounts.
 */
export function PricingCard({ items, extras }: { items: LineItem[]; extras?: LineItem[] }) {
  const displayItems =
    extras && extras.length > 0 ? items.flatMap((item) => (item.name === "Extras" ? extras : [item])) : items;
  const total = displayItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return (
    <Collapsible title="Pricing">
      <div className="flex flex-col gap-2">
        {displayItems.map((item) => (
          <KeyDetailField key={item.id} label={item.name} value={formatCurrency(item.unitPrice * item.quantity)} />
        ))}
        <div className="mt-1 flex items-baseline justify-between border-t border-slate-100 pt-2">
          <span className="text-sm font-semibold text-slate-700">Total</span>
          <span className="text-sm font-semibold text-slate-900">{formatCurrency(total)}</span>
        </div>
      </div>
    </Collapsible>
  );
}
