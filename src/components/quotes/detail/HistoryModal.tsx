"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ActivityAvatar } from "@/components/activity/ActivityAvatar";
import { inputClassName } from "@/components/ui/FormField";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { QuoteHistoryEntry } from "@/types/quote-detail-shared";

// Cycled by index purely as a visual accent on the timeline dots, matching
// the pattern used on the Activity Feed.
const DOT_COLORS = ["bg-brand-blue", "bg-brand-green-mid", "bg-amber-500"];

export function HistoryModal({
  history,
  onClose,
}: {
  history: QuoteHistoryEntry[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return history;
    return history.filter(
      (entry) =>
        entry.description.toLowerCase().includes(term) ||
        entry.actorName.toLowerCase().includes(term),
    );
  }, [history, query]);

  return (
    <Modal title="History" onClose={onClose}>
      <div className="border-b border-slate-100 px-5 py-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className={cn(inputClassName, "pl-9")}
            placeholder="Search..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="px-5 py-2">
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">No matching history entries.</p>
        )}
        {filtered.map((entry, index) => (
          <div key={entry.id} className="relative flex gap-3 py-4 pl-6">
            <span
              aria-hidden="true"
              className="absolute top-0 bottom-0 left-[15px] w-px bg-slate-200"
            />
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-6 left-[11px] h-2.5 w-2.5 rounded-full ring-4 ring-white",
                DOT_COLORS[index % DOT_COLORS.length],
              )}
            />
            <ActivityAvatar actorName={entry.actorName} initials={entry.actorName[0]} isSystem={entry.isSystem} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-900">
                <span className="font-semibold">{entry.actorName}</span>{" "}
                <span className="text-slate-500">updated the application</span>
              </p>
              <p className="mt-0.5 text-sm text-slate-600">{entry.description}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDateTime(entry.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
