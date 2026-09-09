"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { formatCurrency } from "@/lib/format";
import { aprForTermYears, monthlyRepayment, MONTHLY_PLAN_TERM_YEARS } from "@/lib/finance";
import { cn } from "@/lib/utils";

type RateGroupKey = "interest_free" | "standard";

const RATE_GROUPS: { key: RateGroupKey; label: string; terms: number[] }[] = [
  {
    key: "interest_free",
    label: "0.00% APR",
    terms: MONTHLY_PLAN_TERM_YEARS.filter((years) => aprForTermYears(years) === 0),
  },
  {
    key: "standard",
    label: "9.90% APR",
    terms: MONTHLY_PLAN_TERM_YEARS.filter((years) => aprForTermYears(years) > 0),
  },
];

/**
 * Mirrors the Ideal4Finance calculator widget's content so reps see a
 * familiar tool — uses the same term/APR rules as the Monthly Plan payment
 * method on a quote (see `src/lib/finance.ts`), kept as a standalone
 * sidebar tool since not every rep opens this from an existing quote.
 */
export function FinanceCalculatorModal({ onClose }: { onClose: () => void }) {
  const [rateGroupKey, setRateGroupKey] = useState<RateGroupKey>("interest_free");
  const [systemCost, setSystemCost] = useState("");
  const [deposit, setDeposit] = useState("");
  const [termYears, setTermYears] = useState<number>(RATE_GROUPS[0].terms[0]);

  const activeGroup = RATE_GROUPS.find((group) => group.key === rateGroupKey) ?? RATE_GROUPS[0];

  function handleSelectRateGroup(group: (typeof RATE_GROUPS)[number]) {
    setRateGroupKey(group.key);
    setTermYears(group.terms[0]);
  }

  const systemCostNumber = Number(systemCost) || 0;
  const depositNumber = Number(deposit) || 0;
  const amountOfCredit = Math.max(systemCostNumber - depositNumber, 0);
  const months = termYears * 12;
  const apr = aprForTermYears(termYears);
  const isInterestFree = apr === 0;
  const monthly = amountOfCredit > 0 ? monthlyRepayment(amountOfCredit, termYears) : 0;
  const totalRepayable = monthly * months;
  const interestPaid = Math.max(totalRepayable - amountOfCredit, 0);
  const aprLabel = `${apr.toFixed(2)}% APR`;

  const summaryStats = [
    { label: "Amount of credit", value: formatCurrency(amountOfCredit) },
    { label: "Total repayable", value: formatCurrency(totalRepayable) },
    { label: "Interest paid", value: formatCurrency(interestPaid) },
    { label: "APR", value: aprLabel },
  ];

  return (
    <Modal title="Finance Calculator" onClose={onClose}>
      <div className="flex flex-col gap-5 p-5">
        <p className="text-sm text-slate-500">
          Estimate monthly repayments for your installation. Figures are a guide only and final terms are confirmed
          during application.
        </p>

        <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
          {RATE_GROUPS.map((group) => (
            <button
              key={group.key}
              type="button"
              onClick={() => handleSelectRateGroup(group)}
              aria-pressed={rateGroupKey === group.key}
              className={cn(
                "flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
                rateGroupKey === group.key ? "bg-white text-brand-blue shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              {group.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Total system cost" htmlFor="finance-calc-cost">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-slate-400">
                £
              </span>
              <input
                id="finance-calc-cost"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="Enter total system cost"
                className={cn(inputClassName, "pl-6")}
                value={systemCost}
                onChange={(event) => setSystemCost(event.target.value)}
              />
            </div>
          </FormField>

          <FormField label="Deposit" htmlFor="finance-calc-deposit">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-slate-400">
                £
              </span>
              <input
                id="finance-calc-deposit"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="Enter deposit amount"
                className={cn(inputClassName, "pl-6")}
                value={deposit}
                onChange={(event) => setDeposit(event.target.value)}
              />
            </div>
          </FormField>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Select loan term</p>
          <div className="flex flex-wrap gap-2">
            {activeGroup.terms.map((years) => (
              <button
                key={years}
                type="button"
                onClick={() => setTermYears(years)}
                aria-pressed={termYears === years}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  termYears === years
                    ? "border-brand-blue bg-brand-blue text-white"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50",
                )}
              >
                {years * 12} months
              </button>
            ))}
          </div>
          {isInterestFree && <p className="mt-2 text-xs font-medium text-brand-green-mid">Interest free</p>}
        </div>

        <div className="rounded-xl bg-brand-blue px-5 py-4 text-white">
          <p className="text-xs font-medium tracking-wide text-white/70 uppercase">Estimated monthly repayment</p>
          <p className="mt-1 text-3xl font-semibold">
            {formatCurrency(monthly)}
            <span className="ml-1 text-base font-normal text-white/70">/mo</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
          {summaryStats.map((stat) => (
            <div key={stat.label} className="bg-white px-3 py-3 text-center">
              <p className="text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{stat.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2.5 rounded-lg bg-slate-50 p-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
          <div className="flex flex-col gap-2 text-xs text-slate-400">
            <p>
              Margav Renewables Ltd is an Introducer Appointed Representative of Ideal Sales Solutions Ltd, t/a
              Ideal4Finance. Ideal Sales Solutions Ltd is a credit broker and not a lender (FRN 703401). Finance
              available subject to status. The rate offered is always provisional and will depend upon your personal
              circumstances, the loan amount and the term.
            </p>
            <p>
              Representative example: {aprLabel} based on a loan of {formatCurrency(amountOfCredit)} repayable over{" "}
              {months} months at an interest rate of {aprLabel} pa (fixed), with monthly repayment of{" "}
              {formatCurrency(monthly)} and total amount payable {formatCurrency(totalRepayable)}.
            </p>
            <p>
              Please note: the finance calculator provides only a guide and the exact amounts will be confirmed
              during the application process.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
