import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Table2 } from "lucide-react";
import { getCurrentUser } from "@/data/current-user";
import { getAllInstallersAvailability } from "@/data/installer-availability-service";
import { getUnassignedInstallJobs } from "@/data/quotes-service";
import { addDays, getMonthGridDays, parseISODate, startOfWeek, toISODate } from "@/lib/date-utils";
import { formatDateRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ViewControls, type AvailabilityView } from "@/components/availability/ViewControls";
import { InstallerAvailabilityGrid } from "@/components/availability/InstallerAvailabilityGrid";
import {
  InstallerCalendarView,
  type InstallerCalendarViewMode,
} from "@/components/availability/InstallerCalendarView";

type Layout = "table" | "calendar";

const VIEW_LENGTHS: Record<AvailabilityView, number> = { week: 7, "2weeks": 14, month: 28 };
const MAX_OFFSET_WEEKS = 52;

function firstValue(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

function parseLayout(raw: string | string[] | undefined): Layout {
  return firstValue(raw) === "calendar" ? "calendar" : "table";
}

function parseView(raw: string | string[] | undefined): AvailabilityView {
  const value = firstValue(raw);
  return value === "week" || value === "month" ? value : "2weeks";
}

function parseCalendarView(raw: string | string[] | undefined): InstallerCalendarViewMode {
  return firstValue(raw) === "week" ? "week" : "month";
}

function parseOffset(raw: string | string[] | undefined): number {
  const value = Number(firstValue(raw));
  if (!Number.isFinite(value)) return 0;
  return Math.max(-MAX_OFFSET_WEEKS, Math.min(MAX_OFFSET_WEEKS, Math.trunc(value)));
}

function parseAnchor(raw: string | string[] | undefined): Date {
  const value = firstValue(raw);
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = parseISODate(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

const LAYOUT_OPTIONS: { value: Layout; label: string; href: string; icon: typeof Table2 }[] = [
  { value: "table", label: "Table", href: "/appointments/installer-availability", icon: Table2 },
  {
    value: "calendar",
    label: "Calendar",
    href: "/appointments/installer-availability?layout=calendar",
    icon: CalendarDays,
  },
];

/**
 * Admin page for every installer's availability and the jobs booked on top
 * of it, in two layouts over the same data: "Table" (installers as rows,
 * dates as columns — best for "who's free on Thursday?") and "Calendar"
 * (a month/week calendar colour-coded per installer — best for seeing an
 * installer's month at a glance). Both assign/unassign jobs the same way.
 * Each layout keeps its own `?view=` params, read here so only the visible
 * range is ever fetched.
 */
export default async function AdminInstallerAvailabilityPage({
  searchParams,
}: PageProps<"/appointments/installer-availability">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  const params = await searchParams;
  const layout = parseLayout(params.layout);
  const today = new Date();
  const todayISO = toISODate(today);

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Installer Availability</h2>
        <p className="mt-1 text-sm text-slate-500">
          Assign a job by clicking an available day, or see who&rsquo;s already booked in.
        </p>
      </div>
      <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
        {LAYOUT_OPTIONS.map(({ value, label, href, icon: Icon }) => (
          <Link
            key={value}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              layout === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );

  if (layout === "calendar") {
    const calendarView = parseCalendarView(params.view);
    const anchor = parseAnchor(params.date);
    const days =
      calendarView === "month"
        ? getMonthGridDays(anchor)
        : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i));

    const [rows, unassignedJobs] = await Promise.all([
      getAllInstallersAvailability(toISODate(days[0]), toISODate(days[days.length - 1])),
      getUnassignedInstallJobs(),
    ]);

    return (
      <div className="flex flex-col gap-4">
        {header}
        <InstallerCalendarView
          view={calendarView}
          anchorISO={toISODate(anchor)}
          dayISOs={days.map(toISODate)}
          todayISO={todayISO}
          rows={rows}
          unassignedJobs={unassignedJobs}
        />
      </div>
    );
  }

  const view = parseView(params.view);
  const offset = parseOffset(params.offset);

  const dayCount = VIEW_LENGTHS[view];
  const rangeStart = addDays(today, offset * 7);
  const rangeEnd = addDays(rangeStart, dayCount - 1);
  const startDate = toISODate(rangeStart);
  const endDate = toISODate(rangeEnd);

  const [rows, unassignedJobs] = await Promise.all([
    getAllInstallersAvailability(startDate, endDate),
    getUnassignedInstallJobs(),
  ]);

  const dateHeaders = rows[0]?.days.map((day) => day.date) ?? [];
  const todayInRange = todayISO >= startDate && todayISO <= endDate;
  const availableToday = rows.filter((row) =>
    row.days.some((day) => day.date === todayISO && day.status === "available" && !day.assignedJob),
  ).length;

  return (
    <div className="flex flex-col gap-4">
      {header}

      <div className="flex justify-end">
        <ViewControls view={view} offset={offset} />
      </div>

      <div className="flex flex-wrap items-center gap-5 rounded-xl border border-slate-200 bg-white px-5 py-3">
        <span className="text-sm font-medium text-slate-700">{formatDateRange(startDate, endDate)}</span>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-green-mid" />
          Available
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-600" />
          Unavailable
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-300" />
          Not entered
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-600" />
          Booked (in the installer&rsquo;s colour)
        </div>
        {todayInRange && (
          <span className="ml-auto rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-semibold text-brand-blue">
            {availableToday} of {rows.length} available today
          </span>
        )}
      </div>

      <InstallerAvailabilityGrid
        rows={rows}
        dateHeaders={dateHeaders}
        unassignedJobs={unassignedJobs}
        todayISO={todayISO}
      />
    </div>
  );
}
