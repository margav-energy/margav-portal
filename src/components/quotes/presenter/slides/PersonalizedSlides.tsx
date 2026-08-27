"use client";

import { useState, useTransition } from "react";
import { Calendar } from "lucide-react";
import { inputClassName } from "@/components/ui/FormField";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { aprForTermYears, monthlyRepayment, MONTHLY_PLAN_TERM_YEARS } from "@/lib/finance";
import { updateSelectedPaymentMethod } from "@/components/quotes/actions";
import type { BoilerQuoteDetail } from "@/types/boiler-quote";

/**
 * The 3 "live" Presenter slides (see `presenter_slides.slide_type` in
 * `supabase/migrations/0005_presenter_decks.sql`) — the only slides in a
 * presentation that aren't just an uploaded image. These read the specific
 * quote's real `BoilerQuoteDetail` rather than replicating anything from
 * the uploaded deck.
 */

function hasSystemFilter(detail: BoilerQuoteDetail): boolean {
  return detail.extras.some((extra) => extra.name.toLowerCase().includes("system filter"));
}

export function totalCostFor(detail: BoilerQuoteDetail): number {
  return detail.pricingBreakdown.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

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
      <div
        className={cn(
          "px-4 py-2 text-sm font-semibold text-white",
          accent === "blue" ? "bg-brand-blue" : "bg-brand-green-mid",
        )}
      >
        {label}
      </div>
      <div className="bg-slate-50 px-4 py-3 font-semibold text-slate-900">{value}</div>
    </div>
  );
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
    <div className="mx-auto w-full max-w-4xl p-10">
      <h2 className="mb-1 text-3xl font-bold text-slate-900">Your System Summary</h2>
      <p className="mb-8 text-slate-500">The specifics for your home, confirmed by your engineer</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryField accent="green" label="Boiler Model" value={unit ? `${unit.make} ${unit.model}` : "—"} />
        <SummaryField accent="blue" label="Configuration" value={unit?.installType ?? "—"} />
        <SummaryField
          accent="green"
          label="Product & Service Warranty"
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
      <p className="mt-4 text-xs text-slate-400">
        Install date is set for this presentation only — there&rsquo;s nowhere on the quote to save it yet.
      </p>
    </div>
  );
}

export function PricingSlide({ detail }: { detail: BoilerQuoteDetail }) {
  const totalCost = totalCostFor(detail);

  const rows: { label: string; value: string }[] = [
    { label: "System & installation", value: formatCurrency(totalCost) },
    { label: "Intergas System Filter & Chemical Pack", value: hasSystemFilter(detail) ? "Included" : "Not selected" },
    { label: "Removal & disposal of old boiler", value: "Included" },
    { label: "Gas Safe cert. & Building Regs notification", value: "Included" },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl p-10">
      <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-xl sm:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col justify-center gap-2 bg-brand-blue p-10 text-white">
          <h3 className="text-2xl font-bold">Your Quotation</h3>
          <p className="text-white/70">Statutory 14-day cooling-off period applies from the date you sign.</p>
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
            <span className="text-xl font-bold text-white">{formatCurrency(totalCost)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MonthlyCostSlide({ detail }: { detail: BoilerQuoteDetail }) {
  const totalCost = totalCostFor(detail);
  // The monthly figure needs to match what the signed document actually
  // shows (see `buildDocumentSnapshot` in src/lib/esignature/document.ts),
  // which is post-discount — `totalCost` above stays pre-discount since
  // it's also what the "System & installation" row displays.
  const principalForMonthly = totalCost - detail.discountAmount;
  const [termYears, setTermYears] = useState(detail.monthlyPlanTermYears ?? 10);
  const [isPending, startTransition] = useTransition();
  const apr = aprForTermYears(termYears);
  const monthlyPayment = monthlyRepayment(principalForMonthly, termYears);

  function handleChangeTermYears(years: number) {
    setTermYears(years);
    // Switches the quote onto the Monthly Plan at this term — a rep
    // changing this while presenting is proposing/confirming that plan,
    // not just previewing a number.
    startTransition(() => {
      void updateSelectedPaymentMethod(detail.quoteId, "monthly_plan", years, detail.customer.name);
    });
  }

  return (
    <div className="mx-auto w-full max-w-4xl p-10">
      <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-xl sm:grid-cols-[1fr_1.4fr]">
        <div className="flex flex-col gap-3 bg-brand-blue p-10 text-white">
          <h3 className="text-2xl font-bold">Estimated Monthly Cost</h3>
          <p className="text-white/70">
            No fixed price is agreed until it&rsquo;s confirmed in writing after survey. Finance figures shown are
            illustrative only, not an offer of credit.
          </p>
        </div>
        <div className="flex flex-col divide-y divide-slate-200 bg-slate-100">
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-slate-700">System & installation</span>
            <span className="font-semibold text-slate-900">{formatCurrency(totalCost)}</span>
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-slate-700">Term</span>
            <select
              value={termYears}
              onChange={(event) => handleChangeTermYears(Number(event.target.value))}
              disabled={isPending}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-right outline-none focus:border-brand-blue disabled:opacity-60"
            >
              {MONTHLY_PLAN_TERM_YEARS.map((years) => (
                <option key={years} value={years}>
                  {years} year{years === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between px-6 py-4">
            <span className="text-slate-700">APR</span>
            <span className="font-semibold text-slate-900">{apr}%</span>
          </div>
          <div className="flex items-center justify-between bg-brand-green-mid px-6 py-5">
            <span className="font-semibold text-white">Estimated Monthly Payment</span>
            <span className="text-xl font-bold text-white">{formatCurrency(monthlyPayment)} / month</span>
          </div>
        </div>
      </div>
    </div>
  );
}
