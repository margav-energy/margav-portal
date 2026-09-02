"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { syncUnallocatedAppointmentReps } from "@/components/quotes/actions";

/**
 * One-off (and re-runnable) fix for appointments that fell out of sync
 * before `assignQuoteRepresentative` started keeping a quote's assigned rep
 * and its appointment's rep in step — those still show "Unallocated" on the
 * calendar even though their quote clearly has someone assigned. See that
 * function's doc comment in `src/components/quotes/actions.ts`.
 */
export function SyncAppointmentRepsCard() {
  const [result, setResult] = useState<{ ok: boolean; syncedCount: number; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSync() {
    setResult(null);
    startTransition(async () => {
      const outcome = await syncUnallocatedAppointmentReps();
      setResult(outcome);
    });
  }

  return (
    <Card className="flex items-center justify-between gap-4 p-5">
      <div>
        <h3 className="font-semibold text-slate-900">Sync appointment reps</h3>
        <p className="mt-1 text-sm text-slate-500">
          Fixes appointments still showing &ldquo;Unallocated&rdquo; on the calendar despite their quote having a rep
          assigned. Safe to run any time — never overwrites an appointment that already has a rep.
        </p>
        {result?.ok && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-brand-green-mid">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {result.syncedCount === 0
              ? "Nothing to fix — everything's already in sync."
              : `Synced ${result.syncedCount} appointment${result.syncedCount === 1 ? "" : "s"}.`}
          </p>
        )}
        {result && !result.ok && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
            <XCircle className="h-4 w-4 shrink-0" />
            {result.error ?? "Something went wrong — please try again."}
          </p>
        )}
      </div>
      <Button variant="secondary" onClick={handleSync} disabled={isPending}>
        {isPending ? "Syncing…" : "Sync now"}
      </Button>
    </Card>
  );
}
