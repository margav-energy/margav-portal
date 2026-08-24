"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/format";
import { unassignInstallerFromJobAction } from "@/app/appointments/installer-availability/actions";

/** Opened from a "booked" cell on the Installer Availability grid — lets
 *  the admin free the day back up if plans change. */
export function UnassignJobModal({
  quoteId,
  installerName,
  customerName,
  date,
  onClose,
}: {
  quoteId: string;
  installerName: string;
  customerName: string;
  date: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUnassign() {
    setError(null);
    startTransition(async () => {
      const result = await unassignInstallerFromJobAction(quoteId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal title="Unassign this job?" onClose={onClose}>
      <div className="flex flex-col gap-4 p-5">
        <p className="text-sm text-slate-600">
          {installerName} is booked for <span className="font-medium text-slate-900">{customerName}</span>&rsquo;s job
          on {formatDate(date)}. Unassigning frees up the day and puts the job back in the unassigned list.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleUnassign} disabled={isPending}>
            {isPending ? "Unassigning…" : "Unassign"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
