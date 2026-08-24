import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type AvailabilityView = "week" | "2weeks" | "month";

const VIEW_OPTIONS: { value: AvailabilityView; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "2weeks", label: "2 Weeks" },
  { value: "month", label: "Month" },
];

function hrefFor(view: AvailabilityView, offset: number): string {
  return `/appointments/installer-availability?view=${view}&offset=${offset}`;
}

/**
 * Week/2 Weeks/Month toggle + Prev/Today/Next — plain server-renderable
 * links, no client JS. Navigating is just requesting a new `?view=&offset=`
 * URL, which `page.tsx` reads to compute the date range server-side.
 */
export function ViewControls({ view, offset }: { view: AvailabilityView; offset: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
        <Link
          href={hrefFor(view, offset - 1)}
          aria-label="Previous"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <Link
          href={hrefFor(view, 0)}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Today
        </Link>
        <Link
          href={hrefFor(view, offset + 1)}
          aria-label="Next"
          className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
        {VIEW_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={hrefFor(option.value, offset)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              view === option.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
            )}
          >
            {option.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
