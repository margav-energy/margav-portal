import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/format";

interface DisplayItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Generic "Extras" style section — a titled list of priced line items, each
 * editable/removable, with a running total and an "Add ___" action. Shared
 * by Extras, Standard Additionals, and Free-text Extras across every
 * product vertical (the caller maps whichever underlying shape it has into
 * `DisplayItem`).
 */
export function LineItemsSection({
  title,
  items,
  addLabel,
}: {
  title: string;
  items: DisplayItem[];
  addLabel: string;
}) {
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {title} ({items.length})
      </p>

      {items.map((item, index) => (
        <Card key={item.id} className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
            <p className="text-sm font-semibold text-slate-900">
              {title.replace(/s$/, "")} #{index + 1}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="primary" className="px-3 py-1.5 text-xs">
                Edit
              </Button>
              <Button variant="danger" className="px-3 py-1.5 text-xs">
                Remove
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm text-slate-700">
            <span>
              {item.name} <span className="text-slate-400">&times; {item.quantity}</span>
            </span>
            <span className="font-medium text-slate-900">
              {formatCurrency(item.unitPrice * item.quantity)}
            </span>
          </div>
        </Card>
      ))}

      {items.length > 0 && (
        <div className="flex items-center justify-end gap-3 px-1 text-sm">
          <span className="text-slate-500">Total</span>
          <span className="font-semibold text-slate-900">{formatCurrency(total)}</span>
        </div>
      )}

      <Button variant="secondary" className="w-fit self-center">
        {addLabel}
      </Button>
    </div>
  );
}
