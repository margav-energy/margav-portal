"use client";

import { useState } from "react";
import { NotesPanel } from "@/components/quotes/detail/NotesPanel";
import type { QuoteNote } from "@/types/quote-detail-shared";

/**
 * Thin client wrapper around the admin/rep `NotesPanel` — reused as-is
 * (it calls `addQuoteNote`, which has no role restriction) so installers
 * get the same two-way notes timeline. Only exists because /jobs/[id] is a
 * server component and needs somewhere to hold the optimistic local state
 * after a note is added, same as `BoilerQuoteDetail`/`SolarQuoteDetail` do
 * for the admin/rep page.
 */
export function InstallerNotesPanel({
  quoteId,
  customerName,
  notes,
}: {
  quoteId: string;
  customerName: string;
  notes: QuoteNote[];
}) {
  const [currentNotes, setCurrentNotes] = useState<QuoteNote[]>(notes);

  return (
    <NotesPanel
      quoteId={quoteId}
      customerName={customerName}
      notes={currentNotes}
      onNoteAdded={(note) => setCurrentNotes((current) => [note, ...current])}
    />
  );
}
