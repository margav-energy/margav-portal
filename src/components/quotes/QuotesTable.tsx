"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { PageSizeSelect } from "@/components/ui/PageSizeSelect";
import { TableSearchInput } from "@/components/ui/TableSearchInput";
import { MultiSelectFilter } from "@/components/ui/MultiSelectFilter";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { QuotePipelineStatusPill } from "@/components/ui/QuotePipelineStatusPill";
import { PAYMENT_TYPE_LABELS, QUOTE_PIPELINE_STATUS_STYLES } from "@/lib/status-colors";
import { formatCurrency, formatDate } from "@/lib/format";
import { getInitials, cn } from "@/lib/utils";
import type { Quote } from "@/types/quote";

type SortKey = "customerName" | "pipelineStatus" | "representative" | "amount" | "sentDate";
type SortDirection = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const GRID_COLS = "grid-cols-[2fr_1fr_1fr_1fr_1fr]";
const STATUS_OPTIONS = Object.values(QUOTE_PIPELINE_STATUS_STYLES).map((style) => style.label);

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "customerName", label: "Customer" },
  { key: "pipelineStatus", label: "Status" },
  { key: "representative", label: "Representative" },
  { key: "amount", label: "Value" },
  { key: "sentDate", label: "Date" },
];

function repLabel(quote: Quote): string {
  return quote.representative ?? "None";
}

function statusLabel(quote: Quote): string {
  return QUOTE_PIPELINE_STATUS_STYLES[quote.pipelineStatus].label;
}

function compareQuotes(a: Quote, b: Quote, key: SortKey): number {
  switch (key) {
    case "amount":
      return a.amount - b.amount;
    case "pipelineStatus":
      return statusLabel(a).localeCompare(statusLabel(b));
    case "representative":
      return repLabel(a).localeCompare(repLabel(b));
    case "sentDate":
      return a.sentDate.localeCompare(b.sentDate);
    default:
      return a.customerName.localeCompare(b.customerName);
  }
}

// No manual "Archive" button here anymore — quotes drop off this list on
// their own once they're 5+ years old (see src/data/quotes-service.ts).
export function QuotesTable({ quotes }: { quotes: Quote[] }) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey | null>("sentDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const repOptions = useMemo(
    () => Array.from(new Set(quotes.map(repLabel))).sort(),
    [quotes],
  );

  function handleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection("asc");
      return;
    }
    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }
    setSortKey(null);
  }

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = quotes.filter((quote) => {
      if (selectedReps.length > 0 && !selectedReps.includes(repLabel(quote))) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(statusLabel(quote))) return false;
      if (
        query &&
        !quote.customerName.toLowerCase().includes(query) &&
        !quote.address.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });

    if (!sortKey) return filtered;

    return [...filtered].sort((a, b) => {
      const comparison = compareQuotes(a, b, sortKey);
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [quotes, search, selectedReps, selectedStatuses, sortKey, sortDirection]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <PageSizeSelect value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={setPageSize} />
        <TableSearchInput value={search} onChange={setSearch} />
        <MultiSelectFilter
          label="Representative"
          options={repOptions}
          selected={selectedReps}
          onChange={setSelectedReps}
        />
        <MultiSelectFilter
          label="Status"
          options={STATUS_OPTIONS}
          selected={selectedStatuses}
          onChange={setSelectedStatuses}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div
          className={cn(
            "grid items-center gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase",
            GRID_COLS,
          )}
        >
          {COLUMNS.map((column) => (
            <button
              key={column.key}
              type="button"
              onClick={() => handleSort(column.key)}
              className="flex items-center gap-1.5 text-left hover:text-slate-700"
            >
              {column.label}
              <ArrowUpDown
                className={cn("h-3.5 w-3.5", sortKey === column.key ? "text-brand-blue" : "text-slate-300")}
              />
            </button>
          ))}
        </div>

        <Pagination
          rows={rows.map((quote) => (
            <div key={quote.id} className={cn("grid items-center gap-4 px-5 py-4 hover:bg-slate-50", GRID_COLS)}>
              <Link href={`/quotes/${quote.id}`} className="flex min-w-0 items-center gap-3">
                <InitialsAvatar name={quote.customerName} initials={getInitials(quote.customerName)} className="rounded-full" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{quote.customerName}</p>
                  <p className="truncate text-sm text-slate-500">{quote.address}</p>
                </div>
              </Link>
              <div>
                <QuotePipelineStatusPill status={quote.pipelineStatus} />
              </div>
              <p className="truncate text-sm text-slate-600">{repLabel(quote)}</p>
              <div>
                <p className="text-sm font-semibold text-slate-900">{formatCurrency(quote.amount)}</p>
                <p className="text-sm text-slate-500">{PAYMENT_TYPE_LABELS[quote.paymentType]}</p>
              </div>
              <p className="text-sm text-slate-600">{formatDate(quote.sentDate)}</p>
            </div>
          ))}
          pageSize={pageSize}
          emptyMessage="No quotes match this view."
        />
      </div>
    </div>
  );
}
