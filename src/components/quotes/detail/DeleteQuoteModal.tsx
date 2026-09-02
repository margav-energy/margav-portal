"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { deleteQuoteAction } from "@/components/quotes/actions";

/**
 * Shared confirm-and-delete flow for a quote — used from the quote detail
 * page's header (`QuoteHeader.tsx`) and the calendar's click-to-view
 * overview (`AppointmentOverviewModal.tsx`), so both entry points stay in
 * sync. What happens after a successful delete differs by context (leaving
 * the now-gone quote's own page vs. staying on the calendar), so that's left
 * to the caller via `onDeleted`.
 */
export function DeleteQuoteModal({
  quoteId,
  customerName,
  reference,
  onClose,
  onDeleted,
}: {
  quoteId: string;
  customerName: string;
  reference: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteQuoteAction(quoteId, customerName);
      if (!result.ok) {
        setError(result.error ?? "Could not delete the quote. Please try again.");
        return;
      }
      onDeleted();
    });
  }

  return (
    <Modal title={`Delete ${reference}?`} onClose={onClose}>
      <div className="flex flex-col gap-4 p-5">
        <p className="text-sm text-slate-600">
          This permanently deletes <span className="font-medium text-slate-900">{customerName}</span>&rsquo;s quote —
          property details, units, line items, notes, history, documents and signature requests all go with it. This
          can&rsquo;t be undone. Any linked appointment is kept, not deleted.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Deleting…" : "Delete quote"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
