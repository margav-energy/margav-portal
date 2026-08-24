/** Thin progress bar showing how much of the rolling 2-week window an
 *  installer has filled in — same window the nudge banner checks. */
export function AvailabilityProgress({ filled, total }: { filled: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((filled / total) * 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs font-medium text-slate-500">
        <span>Next 2 weeks</span>
        <span>
          {filled} of {total} set
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-brand-green-gradient transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
