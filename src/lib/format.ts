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

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
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

/**
 * @param isoDateTime an ISO datetime string without a timezone offset, e.g.
 * "2026-08-14T09:12:00" — parsed as local time (unlike a bare date, a
 * date-time string like this is not treated as UTC).
 */
export function formatDateTime(isoDateTime: string): string {
  return dateTimeFormatter.format(new Date(isoDateTime)).replace(",", " at");
}
