import { Collapsible } from "@/components/quotes/detail/Collapsible";
import { KeyDetailField } from "@/components/quotes/detail/KeyDetailField";
import { formatCurrency } from "@/lib/format";
import type { ProfitBreakdown } from "@/types/quote-detail-shared";

export function ProfitCard({ profit }: { profit: ProfitBreakdown }) {
  return (
    <Collapsible title="Profit">
      <div className="flex flex-col gap-2">
        <KeyDetailField label="Cost price" value={formatCurrency(profit.costPrice)} />
        <KeyDetailField label="Sell price" value={formatCurrency(profit.sellPrice)} />
        <KeyDetailField label="Profit" value={formatCurrency(profit.profit)} />
        <KeyDetailField label="Margin" value={`${profit.marginPercent}%`} />
      </div>
    </Collapsible>
  );
}
