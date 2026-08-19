import { Card } from "@/components/ui/Card";
import { inputClassName } from "@/components/ui/FormField";
import { cn } from "@/lib/utils";
import { aprForTermYears, MONTHLY_PLAN_TERM_YEARS } from "@/lib/finance";
import type { PaymentMethodOption } from "@/types/quote-detail-shared";

const PAYMENT_OPTIONS: { value: PaymentMethodOption; heading: string; category: string }[] = [
  { value: "bacs", heading: "One-off", category: "Bacs" },
  { value: "monthly_plan", heading: "Choose a term", category: "Monthly Plan" },
];

export function PaymentMethodCard({
  selected,
  termYears,
  onSelect,
  onChangeTermYears,
}: {
  selected: PaymentMethodOption;
  /** Only meaningful when `selected === "monthly_plan"`. */
  termYears: number | undefined;
  onSelect: (option: PaymentMethodOption) => void;
  onChangeTermYears: (years: number) => void;
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

      {selected === "monthly_plan" && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <label htmlFor="monthly-plan-term" className="text-sm text-slate-600">
            Term
          </label>
          <div className="flex items-center gap-2">
            <select
              id="monthly-plan-term"
              className={cn(inputClassName, "w-auto py-1.5")}
              value={termYears ?? MONTHLY_PLAN_TERM_YEARS[MONTHLY_PLAN_TERM_YEARS.length - 1]}
              onChange={(event) => onChangeTermYears(Number(event.target.value))}
            >
              {MONTHLY_PLAN_TERM_YEARS.map((years) => (
                <option key={years} value={years}>
                  {years} year{years === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <span className="text-xs font-medium text-slate-400">
              {aprForTermYears(termYears ?? MONTHLY_PLAN_TERM_YEARS[MONTHLY_PLAN_TERM_YEARS.length - 1])}% APR
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
