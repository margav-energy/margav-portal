const currencyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/** @param isoDate an ISO date string, e.g. "2026-07-28" */
export function formatDate(isoDate: string): string {
  // Parse the date parts directly (rather than `new Date(isoDate)`, which
  // treats a bare "YYYY-MM-DD" as UTC midnight) so the displayed date can't
  // shift by a day in timezones behind UTC.
  const [year, month, day] = isoDate.split("-").map(Number);
  return dateFormatter.format(new Date(year, month - 1, day));
}
