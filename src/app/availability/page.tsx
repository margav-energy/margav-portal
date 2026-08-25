import { requireInstallerUser } from "@/data/current-user";
import { getInstallerAvailability } from "@/data/installer-availability-service";
import { addDays, addMonths, formatMonthLabel, getMonthGridDays, startOfMonth, toISODate } from "@/lib/date-utils";
import { AvailabilityCalendar } from "@/components/availability/AvailabilityCalendar";
import { MonthNav } from "@/components/availability/MonthNav";
import { AvailabilityNudgeBanner } from "@/components/availability/AvailabilityNudgeBanner";
import { AvailabilityProgress } from "@/components/availability/AvailabilityProgress";

const NUDGE_WINDOW_DAYS = 14;

function monthParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function hrefFor(monthDate: Date): string {
  return `/availability?month=${monthParam(monthDate)}`;
}

function parseMonth(raw: string | string[] | undefined): Date {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return startOfMonth(new Date());
}

export default async function AvailabilityPage({
  searchParams,
}: PageProps<"/availability">) {
  const user = await requireInstallerUser();

  const { month } = await searchParams;
  const monthDate = parseMonth(month);
  const today = new Date();
  const todayISO = toISODate(today);

  // The calendar shows whatever month is being viewed; the nudge banner
  // and progress bar always mean "the next 14 days from today" regardless
  // of that — two different windows that only sometimes overlap once
  // month navigation exists, so each gets its own fetch.
  const gridDays = getMonthGridDays(monthDate);
  const [calendarDays, nudgeWindowDays] = await Promise.all([
    getInstallerAvailability(user.id, toISODate(gridDays[0]), toISODate(gridDays[gridDays.length - 1])),
    getInstallerAvailability(user.id, todayISO, toISODate(addDays(today, NUDGE_WINDOW_DAYS - 1))),
  ]);

  const missingCount = nudgeWindowDays.filter((day) => day.status === null).length;
  // The progress bar counts days actually marked *available* — "8 of 14
  // set" (available+unavailable combined) told the scheduling team nothing
  // about whether those 8 days were any use to them.
  const availableCount = nudgeWindowDays.filter((day) => day.status === "available").length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">My Availability</h2>
        <p className="mt-1 text-sm text-slate-500">
          Mark each day as available or unavailable so the scheduling team knows when to book you in.
        </p>
      </div>
      <AvailabilityProgress available={availableCount} total={NUDGE_WINDOW_DAYS} />
      {missingCount > 0 && <AvailabilityNudgeBanner missingCount={missingCount} />}
      <MonthNav
        monthLabel={formatMonthLabel(monthDate)}
        prevHref={hrefFor(addMonths(monthDate, -1))}
        todayHref={hrefFor(startOfMonth(today))}
        nextHref={hrefFor(addMonths(monthDate, 1))}
      />
      <AvailabilityCalendar key={monthParam(monthDate)} monthDate={monthDate} days={calendarDays} todayISO={todayISO} />
    </div>
  );
}
