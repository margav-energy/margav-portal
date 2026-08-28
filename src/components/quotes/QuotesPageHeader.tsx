"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { NewQuoteModal } from "@/components/quotes/NewQuoteModal";

/**
 * The page-level favourite star that used to live here was purely local
 * state with no quote to attach to (this header isn't per-quote — see
 * `QuoteHeader.tsx` for the real per-quote favourite toggle backed by
 * `quotes.is_favourite`). Removed rather than wired to nothing.
 */
export function QuotesPageHeader({ isAdmin }: { isAdmin: boolean }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-semibold tracking-wide text-slate-900 uppercase">Quotes</h2>
      {/* Reps work quotes an admin has already created and assigned to
       *  them — quote creation itself is admin-only (see `createQuote`'s
       *  role check in src/components/quotes/actions.ts). */}
      {isAdmin && (
        <Button variant="primary" className="gap-1.5" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New quote
        </Button>
      )}
      {isCreateOpen && <NewQuoteModal onClose={() => setIsCreateOpen(false)} />}
    </div>
  );
}
