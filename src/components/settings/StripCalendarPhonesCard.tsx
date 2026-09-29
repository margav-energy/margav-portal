"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { stripPhoneFromCalendarAction } from "@/app/settings/actions";

/**
 * One-off (and re-runnable) cleanup for Google Calendar events created
 * before customer phone numbers stopped going onto the calendar — see
 * `stripPhoneFromCalendarEvents` in src/lib/google-calendar.ts.
 */
export function StripCalendarPhonesCard() {
  const [result, setResult] = useState<{ ok: boolean; updatedCount: number; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleStrip() {
    setResult(null);
    startTransition(async () => {
      const outcome = await stripPhoneFromCalendarAction();
      setResult(outcome);
    });
  }

  return (
    <Card className="flex items-center justify-between gap-4 p-5">
      <div>
        <h3 className="font-semibold text-slate-900">Remove phone numbers from Google Calendar</h3>
        <p className="mt-1 text-sm text-slate-500">
          Strips the customer&rsquo;s phone number from appointment events the portal created before numbers stopped
          being added. Only touches portal-created events — safe to run any time.
        </p>
        {result?.ok && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-brand-green-mid">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {result.updatedCount === 0
              ? "Nothing to remove — no events have a phone number on them."
              : `Removed the phone number from ${result.updatedCount} event${result.updatedCount === 1 ? "" : "s"}.`}
          </p>
        )}
        {result && !result.ok && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
            <XCircle className="h-4 w-4 shrink-0" />
            {result.error ?? "Something went wrong — please try again."}
            {result.updatedCount > 0 && ` (${result.updatedCount} updated before it stopped.)`}
          </p>
        )}
      </div>
      <Button variant="secondary" onClick={handleStrip} disabled={isPending}>
        {isPending ? "Removing…" : "Run now"}
      </Button>
    </Card>
  );
}
