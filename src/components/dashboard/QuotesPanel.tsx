"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { QuoteListRow } from "@/components/dashboard/QuoteListRow";
import { useRevealSensitive } from "@/components/dashboard/RevealSensitiveContext";
import { PAGE_SIZE } from "@/lib/constants";
import type { Quote } from "@/types/quote";

type ProductFilter = "all" | "solar" | "boiler";

const FILTERS: { value: ProductFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "solar", label: "Solar" },
  { value: "boiler", label: "Boiler" },
];

/** Absent `productType` means "solar" — see the field's doc comment on `Quote`. */
function matches(quote: Quote, filter: ProductFilter) {
  return filter === "all" || (quote.productType ?? "solar") === filter;
}

export function QuotesPanel({
  title,
  viewAllHref,
  quotes,
  variant,
}: {
  title: string;
  viewAllHref: string;
  quotes: Quote[];
  variant: "sent" | "signed";
}) {
  const { isRevealed } = useRevealSensitive();
  const [filter, setFilter] = useState<ProductFilter>("all");
  const visible = quotes.filter((q) => matches(q, filter));

  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {isRevealed && <Badge>{visible.length}</Badge>}
        <Button href={viewAllHref} className="ml-auto px-3 py-1.5 text-xs">
          View all
        </Button>
      </div>
      <div className="flex gap-1 border-b border-slate-100 px-5 py-2" role="tablist" aria-label="Product type">
        {FILTERS.map((f) => {
          const selected = filter === f.value;
          const count = quotes.filter((q) => matches(q, f.value)).length;
          return (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setFilter(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selected
                  ? "bg-brand-blue text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {f.label}
              {isRevealed && <span className="ml-1 opacity-75">{count}</span>}
            </button>
          );
        })}
      </div>
      <Pagination
        key={filter}
        rows={visible.map((quote) => (
          <QuoteListRow key={quote.id} quote={quote} variant={variant} />
        ))}
        pageSize={PAGE_SIZE}
        emptyMessage={
          filter === "all"
            ? `No ${title.toLowerCase()} yet.`
            : `No ${filter} ${title.toLowerCase()} yet.`
        }
      />
    </Card>
  );
}
