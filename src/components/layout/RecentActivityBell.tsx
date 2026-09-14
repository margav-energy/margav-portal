"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArchiveRestore, Clock, Search, X } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/Pagination";

interface RecentActivityRow {
  id: string;
  customer_name: string;
  description: string;
  created_at: string;
  archived_at: string | null;
}

const POLL_INTERVAL_MS = 60_000;
// This is "fetch, then search/paginate client-side" scale (see Pagination's
// own doc comment) — a personal footprint of one user's own actions, not
// the whole company's, so a generous cap is still a small payload.
const RECENT_ACTIVITY_FETCH_LIMIT = 200;
// Deliberately its own constant rather than the shared `PAGE_SIZE`
// (src/lib/constants.ts, used by e.g. the Activity Feed page) — this is a
// narrow side panel showing short rows, not a full-width table, so it reads
// fine with more per page.
const ACTIVITY_PAGE_SIZE = 10;

type ActivityView = "active" | "archived";

/**
 * Replaces the old people-icon `TeamMembersBadge` — a clock icon that opens
 * a slide-over of the signed-in user's own recent activity (not the whole
 * team's, that's the Activity Feed page, staff-only). Reads `activities`
 * filtered to `actor_id = userId`, which naturally excludes system-generated
 * rows (those carry a null `actor_id` — see `logActivity`,
 * src/lib/activity.ts) — every row here is something *this* user actually
 * did. Same client-side-polling pattern as `NotificationBell`, since
 * `activities` has the same permissive RLS and there's no server push to
 * react to instead.
 *
 * Archiving (`activities.archived_at`, see
 * supabase/migrations/0037_activities_archived_at.sql) only ever affects
 * what shows up *here* — the shared Activity Feed (`getAllActivities`,
 * src/data/activities-service.ts) ignores the column entirely, so an
 * admin's audit trail is untouched by a teammate tidying up their own panel.
 */
export function RecentActivityBell({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activities, setActivities] = useState<RecentActivityRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<ActivityView>("active");
  const [search, setSearch] = useState("");
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  // Tracked independently of `activities` (which only ever holds whichever
  // tab is currently open) so the red badge on the Archived tab stays
  // accurate while looking at Active.
  const [archivedCount, setArchivedCount] = useState(0);
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
    async (forView: ActivityView, options?: { showLoadingState?: boolean }) => {
      if (options?.showLoadingState) setIsLoading(true);

      // Same defensive skip as NotificationBell — env vars may not be
      // available in this client bundle yet.
      if (!isSupabaseConfigured()) {
        if (options?.showLoadingState) setIsLoading(false);
        return;
      }
      const supabase = createClient();

      let query = supabase
        .from("activities")
        .select("id, customer_name, description, created_at, archived_at")
        .eq("actor_id", userId);
      query = forView === "archived" ? query.not("archived_at", "is", null) : query.is("archived_at", null);

      const { data, error } = await query.order("created_at", { ascending: false }).limit(RECENT_ACTIVITY_FETCH_LIMIT);

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

  const loadArchivedCount = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const { count, error } = await supabase
      .from("activities")
      .select("id", { count: "exact", head: true })
      .eq("actor_id", userId)
      .not("archived_at", "is", null);

    if (!isMountedRef.current) return;
    if (error) console.error("Failed to load archived activity count", error);
    else setArchivedCount(count ?? 0);
  }, [userId]);

  // Re-fetches whenever the Active/Archived tab changes, not just on an
  // interval — flipping tabs should never show stale data from the other one.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadActivities(view, { showLoadingState: true });
      loadArchivedCount();
    }, 0);
    const intervalId = setInterval(() => {
      loadActivities(view);
      loadArchivedCount();
    }, POLL_INTERVAL_MS);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [loadActivities, loadArchivedCount, view]);

  async function setArchived(id: string, archived: boolean) {
    setPendingIds((current) => new Set(current).add(id));
    // Optimistic — the row belongs to whichever tab is currently open, so
    // archiving/restoring it always means "remove it from what I'm looking at".
    setActivities((current) => current.filter((activity) => activity.id !== id));
    setArchivedCount((current) => Math.max(0, current + (archived ? 1 : -1)));

    if (isSupabaseConfigured()) {
      const supabase = createClient();
      const { error } = await supabase
        .from("activities")
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) {
        console.error("Failed to update activity archive state", error);
        // Roll back by refetching rather than guessing the row's exact
        // prior shape back into local state.
        void loadActivities(view);
        void loadArchivedCount();
      }
    }

    setPendingIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return activities;
    return activities.filter(
      (activity) =>
        activity.customer_name.toLowerCase().includes(query) || activity.description.toLowerCase().includes(query),
    );
  }, [activities, search]);

  return (
    <>
      <button
        type="button"
        aria-label="Your recent activity"
        onClick={() => {
          // Refetch every time it's opened, same reasoning as NotificationBell.
          setIsOpen((open) => {
            const next = !open;
            if (next) {
              loadActivities(view);
              loadArchivedCount();
            }
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

        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your activity…"
              className="w-full rounded-lg border border-slate-200 py-1.5 pr-3 pl-8 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-blue focus:outline-none"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs font-medium">
            {(["active", "archived"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setView(tab)}
                className={cn(
                  "relative flex-1 rounded-md py-1.5 capitalize transition-colors",
                  view === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
                )}
              >
                {tab}
                {tab === "archived" && archivedCount > 0 && (
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {archivedCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Loading…</p>
          ) : (
            <Pagination
              key={`${view}-${search}`}
              pageSize={ACTIVITY_PAGE_SIZE}
              emptyMessage={
                search.trim()
                  ? "No activity matches your search."
                  : view === "archived"
                    ? "Nothing archived yet."
                    : "No recent activity yet."
              }
              rows={filtered.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start justify-between gap-2 px-4 py-3 text-left"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium text-slate-900">{activity.customer_name}</span>
                    <span className="text-xs whitespace-pre-line text-slate-500">{activity.description}</span>
                    <span className="text-[11px] text-slate-400">{formatDateTime(activity.created_at)}</span>
                  </div>
                  <button
                    type="button"
                    disabled={pendingIds.has(activity.id)}
                    onClick={() => setArchived(activity.id, view === "active")}
                    aria-label={view === "active" ? "Archive" : "Restore"}
                    className="mt-0.5 shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                  >
                    {view === "active" ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            />
          )}
        </div>
      </aside>
    </>
  );
}
