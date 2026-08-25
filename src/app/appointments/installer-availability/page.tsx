import { redirect } from "next/navigation";
import { getCurrentUser } from "@/data/current-user";
import { getAllInstallersAvailability } from "@/data/installer-availability-service";
import { getUnassignedInstallJobs } from "@/data/quotes-service";
import { addDays, toISODate } from "@/lib/date-utils";
import { formatDateRange } from "@/lib/format";
import { ViewControls, type AvailabilityView } from "@/components/availability/ViewControls";
import { InstallerAvailabilityGrid } from "@/components/availability/InstallerAvailabilityGrid";

const VIEW_LENGTHS: Record<AvailabilityView, number> = { week: 7, "2weeks": 14, month: 28 };
const MAX_OFFSET_WEEKS = 52;

function firstValue(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

function parseView(raw: string | string[] | undefined): AvailabilityView {
  const value = firstValue(raw);
  return value === "week" || value === "month" ? value : "2weeks";
}

function parseOffset(raw: string | string[] | undefined): number {
  const value = Number(firstValue(raw));
  if (!Number.isFinite(value)) return 0;
  return Math.max(-MAX_OFFSET_WEEKS, Math.min(MAX_OFFSET_WEEKS, Math.trunc(value)));
}

export default async function AdminInstallerAvailabilityPage({
  searchParams,
}: PageProps<"/appointments/installer-availability">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/");

  const params = await searchParams;
  const view = parseView(params.view);
  const offset = parseOffset(params.offset);

  const today = new Date();
  const todayISO = toISODate(today);
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Installer Availability</h2>
          <p className="mt-1 text-sm text-slate-500">
            Assign a job by clicking an available day, or see who&rsquo;s already booked in.
          </p>
        </div>
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
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-blue" />
          Booked
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
