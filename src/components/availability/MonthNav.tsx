import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Prev/Today/Next month switcher for /availability — plain server-renderable
 * links (same idiom as the admin grid's ViewControls, src/components/availability/ViewControls.tsx),
 * so paging months is just requesting a new `?month=` URL that page.tsx reads.
 */
export function MonthNav({
  monthLabel,
  prevHref,
  todayHref,
  nextHref,
}: {
  monthLabel: string;
  prevHref: string;
  todayHref: string;
  nextHref: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
        <Link
          href={prevHref}
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <Link
          href={todayHref}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Today
        </Link>
        <Link
          href={nextHref}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <span className="text-sm font-semibold text-slate-700">{monthLabel}</span>
    </div>
  );
}
