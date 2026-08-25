/** Thin progress bar showing how many of the next 2 weeks an installer has
 *  marked themselves *available* for — same window the nudge banner checks.
 *  Deliberately not "days answered" (available+unavailable combined): the
 *  scheduling team cares how many days they can actually book someone in
 *  on, not how many days got a response either way. */
export function AvailabilityProgress({ available, total }: { available: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((available / total) * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs font-medium text-slate-500">
        <span>Next 2 weeks</span>
        <span>
          {available} of {total} available
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-brand-green-gradient transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
