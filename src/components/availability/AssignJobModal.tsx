"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { PRODUCT_TYPE_LABELS } from "@/lib/status-colors";
import { formatDate } from "@/lib/format";
import { assignInstallerToJobAction } from "@/app/appointments/installer-availability/actions";
import type { UnassignedInstallJob } from "@/types/quote";

/** Opened from an "available" cell on the Installer Availability grid —
 *  lists jobs with nobody booked yet so the admin can pick one for this
 *  installer, on this day. */
export function AssignJobModal({
  installerId,
  installerName,
  date,
  jobs,
  onClose,
}: {
  installerId: string;
  installerName: string;
  date: string;
  jobs: UnassignedInstallJob[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAssign(job: UnassignedInstallJob) {
    setError(null);
    setPendingId(job.id);
    startTransition(async () => {
      const result = await assignInstallerToJobAction(job.id, installerId, date, job.customerName);
      if (result.error) {
        setError(result.error);
        setPendingId(null);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal title={`Assign a job — ${installerName}, ${formatDate(date)}`} onClose={onClose}>
      <div className="flex flex-col gap-3 p-5">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {jobs.length === 0 ? (
          <p className="text-sm text-slate-500">No unassigned jobs right now.</p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {jobs.map((job) => {
              const busy = isPending && pendingId === job.id;
              return (
                <div key={job.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{job.customerName}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                      <span>{job.postcode}</span>
                      <Pill
                        label={PRODUCT_TYPE_LABELS[job.productType]}
                        className="bg-slate-100 text-slate-600"
                      />
                      {job.reference && <span>#{job.reference}</span>}
                    </p>
                  </div>
                  <Button variant="primary" disabled={busy} onClick={() => handleAssign(job)}>
                    {busy ? "Assigning…" : "Assign"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
