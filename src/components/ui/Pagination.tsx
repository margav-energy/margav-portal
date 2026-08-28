"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const ELLIPSIS = "…";

/**
 * Which page-number buttons to show for `total` pages around `current` —
 * always the first and last page, `current` itself plus one neighbour on
 * each side, and an "…" filling any gap. Caps the button count at 7
 * regardless of how many pages there are (see `Pagination` below — without
 * this, a large `rows` array rendered one button per page, which both
 * looked absurd and overflowed its card on any screen, see the bug this
 * fixed). Below 8 pages there's no gap to collapse, so every page just
 * shows.
 */
function pageWindow(current: number, total: number): (number | typeof ELLIPSIS)[] {
  const siblingCount = 1;
  const totalVisible = siblingCount * 2 + 5; // first + last + current + 2 siblings + 2 ellipses' worth of slack
  if (totalVisible >= total) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < total - 1;

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftRange = Array.from({ length: 3 + siblingCount * 2 }, (_, i) => i + 1);
    return [...leftRange, ELLIPSIS, total];
  }
  if (showLeftEllipsis && !showRightEllipsis) {
    const rightCount = 3 + siblingCount * 2;
    const rightRange = Array.from({ length: rightCount }, (_, i) => total - rightCount + 1 + i);
    return [1, ELLIPSIS, ...rightRange];
  }
  const middleRange = Array.from({ length: rightSibling - leftSibling + 1 }, (_, i) => leftSibling + i);
  return [1, ELLIPSIS, ...middleRange, ELLIPSIS, total];
}

/**
 * Client-side paginated list. Takes already-rendered (keyed) row elements —
 * not a render-prop — since a Server Component can't pass a function down
 * to a Client Component like this one. Slices `rows` into pages and shows a
 * "Showing X to Y of Z entries" footer with prev/page/next controls. Fine at
 * mock-data scale; a real backend would eventually want server-side
 * pagination instead.
 */
export function Pagination({
  rows,
  pageSize,
  emptyMessage = "No entries yet.",
}: {
  rows: React.ReactNode[];
  pageSize: number;
  emptyMessage?: string;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, rows.length);
  const pageRows = rows.slice(start, end);

  if (rows.length === 0) {
    return <p className="px-5 py-16 text-center text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div>
      <div className="divide-y divide-slate-100">{pageRows}</div>
      <div className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Showing {start + 1} to {end} of {rows.length} entries
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={currentPage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40 hover:enabled:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {pageWindow(currentPage, totalPages).map((p, i) =>
            p === ELLIPSIS ? (
              <span
                // Only ever two ellipses (left/right), so their position is a stable key.
                key={`ellipsis-${i}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center text-sm text-slate-400"
              >
                {ELLIPSIS}
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-medium",
                  p === currentPage
                    ? "bg-brand-blue text-white"
                    : "text-slate-500 hover:bg-slate-50",
                )}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            aria-label="Next page"
            disabled={currentPage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40 hover:enabled:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
