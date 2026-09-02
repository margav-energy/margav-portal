"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { deleteAppointmentAction } from "@/components/appointments/actions";

/**
 * Shared confirm-and-delete flow for an appointment — used from the
 * Recently Cancelled table and the calendar's click-to-view overview, so
 * both stay in sync. Deliberately not "cancelled"-specific wording, since
 * the calendar entry point also covers still-unallocated appointments left
 * behind after their quote was deleted (deleting a quote never deletes its
 * appointment — see `DeleteQuoteModal`'s doc comment).
 */
export function DeleteAppointmentModal({
  appointmentId,
  customerName,
  dateTimeLabel,
  onClose,
  onDeleted,
}: {
  appointmentId: string;
  customerName: string;
  /** Pre-formatted, e.g. "3 September 2026 · 10:00–11:00". */
  dateTimeLabel: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAppointmentAction(appointmentId, customerName);
      if (!result.ok) {
        setError(result.error ?? "Could not delete the appointment. Please try again.");
        return;
      }
      onDeleted();
    });
  }

  return (
    <Modal title="Delete this appointment?" onClose={onClose}>
      <div className="flex flex-col gap-4 p-5">
        <p className="text-sm text-slate-600">
          This permanently removes <span className="font-medium text-slate-900">{customerName}</span>&rsquo;s
          appointment from {dateTimeLabel}. This can&rsquo;t be undone — any quote linked to it is kept, not deleted.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
