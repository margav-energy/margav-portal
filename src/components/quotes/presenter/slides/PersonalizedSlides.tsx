import { FileText, Calendar } from "lucide-react";
import { SlideHeading } from "@/components/quotes/presenter/slides/primitives";
import { inputClassName } from "@/components/ui/FormField";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BoilerQuoteDetail } from "@/types/boiler-quote";

function SummaryField({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent: "blue" | "green";
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className={cn("px-4 py-2 text-sm font-semibold text-white", accent === "blue" ? "bg-brand-blue" : "bg-brand-green-mid")}>
        {label}
      </div>
      <div className="bg-slate-50 px-4 py-3 font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function hasSystemFilter(detail: BoilerQuoteDetail): boolean {
  return detail.extras.some((extra) => extra.name.toLowerCase().includes("system filter"));
}

export function SystemSummarySlide({
  detail,
  installDate,
  onChangeInstallDate,
}: {
  detail: BoilerQuoteDetail;
  installDate: string;
  onChangeInstallDate: (value: string) => void;
}) {
  const unit = detail.boilerUnits[0];

  return (
    <div>
      <SlideHeading title="Your System Summary" subtitle="The specifics for your home, confirmed by your engineer" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryField accent="green" label="Boiler Model" value={unit ? `${unit.make} ${unit.model}` : "—"} />
        <SummaryField accent="blue" label="Configuration" value={unit?.installType ?? "—"} />
        <SummaryField
          accent="green"
          label="Manufacturer Warranty"
          value={unit ? `${unit.warrantyYears} years, parts & labour (Intergas)` : "—"}
        />
        <SummaryField accent="blue" label="Warranty Registered By" value="Margav Heating, on your behalf" />
        <SummaryField accent="green" label="System Filter Fitted" value={hasSystemFilter(detail) ? "Yes" : "No"} />
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center gap-1.5 bg-brand-blue px-4 py-2 text-sm font-semibold text-white">
            <Calendar className="h-3.5 w-3.5" />
            Proposed Install Date
          </div>
          <div className="bg-slate-50 px-4 py-2.5">
            <input
              type="date"
              value={installDate}
              onChange={(event) => onChangeInstallDate(event.target.value)}
              className={inputClassName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function QuotationSlide({ detail }: { detail: BoilerQuoteDetail }) {
  const boilerLine = detail.pricingBreakdown.find((item) => item.name.toLowerCase().includes("boiler"));
  const systemAndInstallation = boilerLine ? boilerLine.unitPrice * boilerLine.quantity : detail.keyDetails.price;

  const rows: { label: string; value: string }[] = [
    { label: "System & installation", value: formatCurrency(systemAndInstallation) },
    { label: "Intergas System Filter & Chemical Pack", value: hasSystemFilter(detail) ? "Included" : "Not selected" },
    { label: "Removal & disposal of old boiler", value: "Included" },
    { label: "Gas Safe cert. & Building Regs notification", value: "Included" },
  ];

  return (
    <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-xl sm:grid-cols-[1fr_1.4fr]">
      <div className="flex flex-col justify-between gap-6 bg-brand-blue p-10 text-white">
        <div>
          <h3 className="text-2xl font-bold">Your Quotation</h3>
          <p className="mt-2 text-white/70">Statutory 14-day cooling-off period applies from the date you sign.</p>
        </div>
        <FileText className="h-16 w-16 self-center text-white/60" />
      </div>
      <div className="flex flex-col bg-slate-100">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <span className="text-slate-700">{row.label}</span>
            <span className="font-semibold text-slate-900">{row.value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between bg-brand-green-mid px-6 py-5">
          <span className="font-semibold text-white">Your Total Price</span>
          <span className="text-xl font-bold text-white">{formatCurrency(detail.keyDetails.price)}</span>
        </div>
      </div>
    </div>
  );
}

const PAYMENT_METHOD_DEFAULT_TERM_MONTHS: Record<string, number> = {
  bacs: 1,
  monthly_plan_15yr: 180,
  interest_free_credit_3yr: 36,
  hometree_25yr: 300,
  buy_now_pay_later: 12,
};

export function defaultTermMonthsFor(paymentMethod: string): number {
  return PAYMENT_METHOD_DEFAULT_TERM_MONTHS[paymentMethod] ?? 180;
}

export function MonthlyCostSlide({
  examplePrice,
  termMonths,
  monthlyPayment,
  onChangeExamplePrice,
  onChangeTermMonths,
  onChangeMonthlyPayment,
}: {
  examplePrice: number;
  termMonths: number;
  monthlyPayment: number;
  onChangeExamplePrice: (value: number) => void;
  onChangeTermMonths: (value: number) => void;
  onChangeMonthlyPayment: (value: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-xl sm:grid-cols-[1fr_1.4fr]">
      <div className="flex flex-col gap-3 bg-brand-blue p-10 text-white">
        <h3 className="text-2xl font-bold">Estimated Monthly Cost</h3>
        <p className="text-white/70">
          No fixed price is agreed until it&rsquo;s confirmed in writing after survey. Finance figures shown are
          illustrative only, not an offer of credit.
        </p>
      </div>
      <div className="flex flex-col divide-y divide-slate-200 bg-slate-100">
        <label className="flex items-center justify-between gap-4 px-6 py-4">
          <span className="text-slate-700">System & installation (example)</span>
          <span className="flex items-center gap-1 font-semibold text-slate-900">
            £
            <input
              type="number"
              value={examplePrice}
              onChange={(event) => onChangeExamplePrice(Number(event.target.value))}
              className="w-28 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right outline-none focus:border-brand-blue"
            />
          </span>
        </label>
        <label className="flex items-center justify-between gap-4 px-6 py-4">
          <span className="text-slate-700">Term (example)</span>
          <span className="flex items-center gap-1 font-semibold text-slate-900">
            <input
              type="number"
              value={termMonths}
              onChange={(event) => onChangeTermMonths(Number(event.target.value))}
              className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right outline-none focus:border-brand-blue"
            />
            months
          </span>
        </label>
        <div className="flex items-center justify-between bg-brand-green-mid px-6 py-5">
          <span className="font-semibold text-white">Estimated Monthly Payment</span>
          <span className="flex items-center gap-1 text-xl font-bold text-white">
            £
            <input
              type="number"
              value={monthlyPayment}
              onChange={(event) => onChangeMonthlyPayment(Number(event.target.value))}
              className="w-24 rounded-lg border border-white/30 bg-white/10 px-2 py-1 text-right text-white outline-none focus:border-white"
            />
            / month
          </span>
        </div>
      </div>
    </div>
  );
}
