import { Collapsible } from "@/components/quotes/detail/Collapsible";
import { KeyDetailField } from "@/components/quotes/detail/KeyDetailField";
import { formatCurrency } from "@/lib/format";
import type { LineItem } from "@/types/quote-detail-shared";

export function PricingCard({ items }: { items: LineItem[] }) {
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return (
    <Collapsible title="Pricing">
      <div className="flex flex-col gap-2">
        {items.map((item) => (
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
