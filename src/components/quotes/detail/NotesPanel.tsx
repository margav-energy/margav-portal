"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { inputClassName } from "@/components/ui/FormField";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { QuoteNote } from "@/types/quote-detail-shared";

export function NotesPanel({
  notes,
  onAddNote,
}: {
  notes: QuoteNote[];
  onAddNote: (body: string) => void;
}) {
  const [isComposing, setIsComposing] = useState(false);
  const [draft, setDraft] = useState("");

  function handleSave() {
    if (!draft.trim()) return;
    onAddNote(draft.trim());
    setDraft("");
    setIsComposing(false);
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
              }}
            >
              Cancel
            </Button>
            <Button variant="success" onClick={handleSave}>
              Save note
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
