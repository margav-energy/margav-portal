"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { inputClassName } from "@/components/ui/FormField";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addQuoteNote } from "@/components/quotes/actions";
import { clearDraft, loadDraft, useAutosaveDraft } from "@/hooks/useAutosaveDraft";
import type { QuoteNote } from "@/types/quote-detail-shared";

export function NotesPanel({
  quoteId,
  customerName,
  notes,
  onNoteAdded,
}: {
  quoteId: string;
  customerName: string;
  notes: QuoteNote[];
  onNoteAdded: (note: QuoteNote) => void;
}) {
  const draftKey = `quote-note-draft-${quoteId}`;
  const [draft, setDraft] = useState(() => loadDraft<string>(draftKey) ?? "");
  // A restored draft with something in it should reopen the composer instead of hiding the recovered text.
  const [isComposing, setIsComposing] = useState(() => loadDraft<string>(draftKey) !== null);
  const [isSaving, setIsSaving] = useState(false);

  useAutosaveDraft(draftKey, draft, isComposing);

  async function handleSave() {
    if (!draft.trim()) return;
    setIsSaving(true);
    const note = await addQuoteNote(quoteId, draft.trim(), customerName);
    setIsSaving(false);
    if (note) {
      onNoteAdded(note);
      setDraft("");
      setIsComposing(false);
      clearDraft(draftKey);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {notes.map((note) => (
        <Card key={note.id} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <InitialsAvatar name={note.authorName} initials={note.authorInitials} className="h-9 w-9 text-xs" />
              <div>
                <p className="text-sm font-semibold text-slate-900">{note.authorName}</p>
                <p className="text-xs text-slate-400">{formatDateTime(note.timestamp)}</p>
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm whitespace-pre-line text-slate-700">{note.body}</p>
        </Card>
      ))}

      {isComposing ? (
        <Card className="p-5">
          <textarea
            autoFocus
            rows={4}
            className={cn(inputClassName, "resize-y")}
            placeholder="Add a note against this quote…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsComposing(false);
                setDraft("");
                clearDraft(draftKey);
              }}
            >
              Cancel
            </Button>
            <Button variant="success" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save note"}
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="primary" className="w-fit" onClick={() => setIsComposing(true)}>
          Leave a note
        </Button>
      )}
    </div>
  );
}
