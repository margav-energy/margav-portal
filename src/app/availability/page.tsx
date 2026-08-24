import { redirect } from "next/navigation";
import { getCurrentUser } from "@/data/current-user";
import { getInstallerAvailability, getMissingAvailabilityDates } from "@/data/installer-availability-service";
import { addDays, toISODate } from "@/lib/date-utils";
import { AvailabilityGrid } from "@/components/availability/AvailabilityGrid";
import { AvailabilityNudgeBanner } from "@/components/availability/AvailabilityNudgeBanner";
import { AvailabilityProgress } from "@/components/availability/AvailabilityProgress";

const NUDGE_WINDOW_DAYS = 14;
const PAST_CONTEXT_DAYS = 7;
const FORWARD_DAYS = 20;

export default async function AvailabilityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "installer") redirect("/");

  const today = new Date();
  const rangeStart = toISODate(addDays(today, -PAST_CONTEXT_DAYS));
  const rangeEnd = toISODate(addDays(today, FORWARD_DAYS));

  const [days, missingDates] = await Promise.all([
    getInstallerAvailability(user.id, rangeStart, rangeEnd),
    getMissingAvailabilityDates(user.id, NUDGE_WINDOW_DAYS),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">My Availability</h2>
        <p className="mt-1 text-sm text-slate-500">
          Mark each day as available or unavailable so the scheduling team knows when to book you in.
        </p>
      </div>
      <AvailabilityProgress filled={NUDGE_WINDOW_DAYS - missingDates.length} total={NUDGE_WINDOW_DAYS} />
      {missingDates.length > 0 && <AvailabilityNudgeBanner missingCount={missingDates.length} />}
      <AvailabilityGrid days={days} todayISO={toISODate(today)} />
    </div>
  );
}
