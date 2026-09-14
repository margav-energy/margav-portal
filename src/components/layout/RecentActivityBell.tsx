"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock, X } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";

interface RecentActivityRow {
  id: string;
  customer_name: string;
  description: string;
  created_at: string;
}

const POLL_INTERVAL_MS = 60_000;
const RECENT_ACTIVITY_LIMIT = 15;

/**
 * Replaces the old people-icon `TeamMembersBadge` — a clock icon that opens
 * a dropdown of the signed-in user's own recent activity (not the whole
 * team's, that's the Activity Feed page, staff-only). Reads `activities`
 * filtered to `actor_id = userId`, which naturally excludes system-generated
 * rows (those carry a null `actor_id` — see `logActivity`,
 * src/lib/activity.ts) — every row here is something *this* user actually
 * did. Same client-side-polling pattern as `NotificationBell`, since
 * `activities` has the same permissive RLS and there's no server push to
 * react to instead.
 */
export function RecentActivityBell({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activities, setActivities] = useState<RecentActivityRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Closes on Escape, same as Modal — a click outside is handled by the
  // overlay's own onClick instead (see the panel markup below), since the
  // panel is a fixed slide-over rather than a dropdown anchored to the button.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const loadActivities = useCallback(
    async (options?: { showLoadingState?: boolean }) => {
      if (options?.showLoadingState) setIsLoading(true);

      // Same defensive skip as NotificationBell — env vars may not be
      // available in this client bundle yet.
      if (!isSupabaseConfigured()) {
        if (options?.showLoadingState) setIsLoading(false);
        return;
      }
      const supabase = createClient();

      const { data, error } = await supabase
        .from("activities")
        .select("id, customer_name, description, created_at")
        .eq("actor_id", userId)
        .order("created_at", { ascending: false })
        .limit(RECENT_ACTIVITY_LIMIT);

      if (!isMountedRef.current) return;
      if (error) {
        console.error("Failed to load recent activity", error);
      } else {
        setActivities((data ?? []) as RecentActivityRow[]);
      }
      if (options?.showLoadingState) setIsLoading(false);
    },
    [userId],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => loadActivities({ showLoadingState: true }), 0);
    const intervalId = setInterval(() => loadActivities(), POLL_INTERVAL_MS);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [loadActivities]);

  return (
    <>
      <button
        type="button"
        aria-label="Your recent activity"
        onClick={() => {
          // Refetch every time it's opened, same reasoning as NotificationBell.
          setIsOpen((open) => {
            const next = !open;
            if (next) loadActivities();
            return next;
          });
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
      >
        <Clock className="h-5 w-5" />
      </button>

      {/* Backdrop — blurs the app behind the panel. Only mounted while open
          (same as the mobile Sidebar's overlay); the panel below stays
          mounted always so its transform transition can animate both in
          and out. */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-lg transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Your recent activity"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
          <p className="text-sm font-semibold text-slate-900">Your recent activity</p>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Loading…</p>
          ) : activities.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No recent activity yet.</p>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className="flex flex-col gap-0.5 border-b border-slate-50 px-4 py-3 text-left last:border-b-0"
              >
                <span className="text-sm font-medium text-slate-900">{activity.customer_name}</span>
                <span className="text-xs whitespace-pre-line text-slate-500">{activity.description}</span>
                <span className="text-[11px] text-slate-400">{formatDateTime(activity.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
