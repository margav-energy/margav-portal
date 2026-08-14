"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
      <div className="flex items-center justify-between px-5 py-3">
        <p className="text-sm text-slate-500">
          Showing {start + 1} to {end} of {rows.length} entries
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous page"
            disabled={currentPage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40 hover:enabled:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium",
                p === currentPage
                  ? "bg-brand-blue text-white"
                  : "text-slate-500 hover:bg-slate-50",
              )}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            aria-label="Next page"
            disabled={currentPage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 disabled:opacity-40 hover:enabled:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
