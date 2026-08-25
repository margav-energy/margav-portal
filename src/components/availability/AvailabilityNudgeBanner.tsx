import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";

/**
 * Rolling reminder shown on the installer's own page when the upcoming
 * 14-day window (see src/app/availability/page.tsx) has unanswered days.
 * Deliberately stateless — recomputed from real row-presence on every
 * load, not a persisted/dismissible notification, so it can't go stale or
 * get stuck: as today's date advances, the window and this count advance
 * with it automatically.
 */
export function AvailabilityNudgeBanner({ missingCount }: { missingCount: number }) {
  return (
    <Card className="flex items-start gap-3 border-amber-200 bg-amber-50 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <p className="text-sm text-amber-800">
        You haven&rsquo;t set your availability for {missingCount} day{missingCount === 1 ? "" : "s"} in the next two
        weeks. Please fill these in so the scheduling team knows when you&rsquo;re free.
      </p>
    </Card>
  );
}
