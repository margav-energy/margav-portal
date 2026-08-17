import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { PaymentMethodOption } from "@/types/quote-detail-shared";

const PAYMENT_OPTIONS: { value: PaymentMethodOption; heading: string; category: string }[] = [
  { value: "bacs", heading: "BACS", category: "Cash" },
  { value: "monthly_plan_15yr", heading: "15 years", category: "Monthly Plan" },
  { value: "interest_free_credit_3yr", heading: "3 years", category: "Interest Free Credit" },
  { value: "hometree_25yr", heading: "25 years", category: "HomeTree" },
  { value: "buy_now_pay_later", heading: "1yr / 10yr", category: "Buy Now Pay Later" },
];

export function PaymentMethodCard({
  selected,
  onSelect,
}: {
  selected: PaymentMethodOption;
  onSelect: (option: PaymentMethodOption) => void;
}) {
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Payment method</h3>
      <div className="grid grid-cols-2 gap-3">
        {PAYMENT_OPTIONS.map((option) => {
          const isSelected = option.value === selected;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-3 text-left transition-colors",
                isSelected
                  ? "border-brand-blue bg-brand-blue/5"
                  : "border-slate-200 hover:bg-slate-50",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0 rounded-full border-2",
                  isSelected ? "border-brand-blue bg-brand-blue" : "border-slate-300",
                )}
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-slate-900">{option.heading}</span>
                <span className="truncate text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                  {option.category}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
