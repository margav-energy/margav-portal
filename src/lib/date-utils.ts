const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** e.g. 1 -> "1st", 2 -> "2nd", 11 -> "11th", 21 -> "21st" */
export function ordinal(day: number): string {
  const remainder100 = day % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

/** Monday-based start of the week containing `date`. */
export function startOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay(); // 0 (Sun) – 6 (Sat)
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  return result;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date: Date, amount: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + amount);
  return result;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** e.g. "Monday 10th" */
export function formatDayHeader(date: Date): string {
  return `${WEEKDAY_LONG[date.getDay()]} ${ordinal(date.getDate())}`;
}

/** e.g. "Monday 10th August, 2026" */
export function formatDayLabel(date: Date): string {
  return `${WEEKDAY_LONG[date.getDay()]} ${ordinal(date.getDate())} ${MONTH_LONG[date.getMonth()]}, ${date.getFullYear()}`;
}

/** e.g. "August 2026" */
export function formatMonthLabel(date: Date): string {
  return `${MONTH_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

/** e.g. "10th - 16th August, 2026" (or spans the month/year boundary gracefully) */
export function formatWeekRangeLabel(start: Date, end: Date): string {
  const startOrdinal = ordinal(start.getDate());
  const endOrdinal = ordinal(end.getDate());

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${startOrdinal} - ${endOrdinal} ${MONTH_LONG[end.getMonth()]}, ${end.getFullYear()}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${startOrdinal} ${MONTH_LONG[start.getMonth()]} - ${endOrdinal} ${MONTH_LONG[end.getMonth()]}, ${end.getFullYear()}`;
  }
  return `${startOrdinal} ${MONTH_LONG[start.getMonth()]} ${start.getFullYear()} - ${endOrdinal} ${MONTH_LONG[end.getMonth()]} ${end.getFullYear()}`;
}

/** 42 days (6 full weeks, Monday-based) spanning the month containing `date`. */
export function getMonthGridDays(date: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(date));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}
