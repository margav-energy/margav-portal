/**
 * Shared finance helpers for the "Monthly Plan" payment method — used by
 * `PaymentMethodCard` (quote detail) and the boiler Presenter's Quotation /
 * Monthly Cost slides, so the term/APR/repayment rules only live in one
 * place.
 */

export const MONTHLY_PLAN_TERM_YEARS = [1, 2, 3, 4, 5, 10] as const;
export type MonthlyPlanTermYears = (typeof MONTHLY_PLAN_TERM_YEARS)[number];

export function isMonthlyPlanTermYears(value: number): value is MonthlyPlanTermYears {
  return (MONTHLY_PLAN_TERM_YEARS as readonly number[]).includes(value);
}

/** 1 year is interest-free; every other available term (2-10yr) carries the same rate. */
export function aprForTermYears(termYears: number): number {
  return termYears <= 1 ? 0 : 9.9;
}

/**
 * Standard amortizing-loan monthly payment for a fixed-rate loan. Falls
 * back to a flat division at 0% APR (avoids a divide-by-zero in the
 * amortization formula).
 */
export function monthlyRepayment(principal: number, termYears: number): number {
  const months = Math.max(1, Math.round(termYears * 12));
  const apr = aprForTermYears(termYears);

  if (apr <= 0) return principal / months;

  const monthlyRate = apr / 100 / 12;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}
