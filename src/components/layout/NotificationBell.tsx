"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

// Notifications are written server-side by other users' actions (an admin
// assigning you a quote, a customer declining confirmation, ...), so there's
// no client-side event to react to — polling plus a refetch on open is the
// simplest way to keep this from going stale. See POLL_INTERVAL_MS below.
const POLL_INTERVAL_MS = 60_000;

// The banner's own "have you seen the announcement" row is surfaced here too
// (see NotificationBanner) — it's a real notification, so it belongs in the
// same list.
export function NotificationBell({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadNotifications = useCallback(
    async (options?: { showLoadingState?: boolean }) => {
      if (options?.showLoadingState) setIsLoading(true);

      // Supabase env vars may not be available in this client bundle yet
      // (e.g. a dev server started before .env existed) — skip quietly
      // rather than let createClient() throw; a restart picks up real values.
      if (!isSupabaseConfigured()) {
        if (options?.showLoadingState) setIsLoading(false);
        return;
      }
      const supabase = createClient();

      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, is_read, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!isMountedRef.current) return;
      if (error) {
        console.error("Failed to load notifications", error);
      } else {
        setNotifications((data ?? []) as NotificationRow[]);
      }
      if (options?.showLoadingState) setIsLoading(false);
    },
    [userId],
  );

  // Initial load, plus a background poll so the unread badge doesn't go
  // stale on a tab left open for a while — nothing here pushes updates to
  // the client, so polling is the only way to notice a new row. The initial
  // fetch is deferred a tick (rather than called synchronously in the
  // effect body) so it reads the same way as the interval's own calls, all
  // of which run from a timer callback rather than the effect body itself.
  useEffect(() => {
    const timeoutId = setTimeout(() => loadNotifications({ showLoadingState: true }), 0);
    const intervalId = setInterval(() => loadNotifications(), POLL_INTERVAL_MS);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [loadNotifications]);

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  async function markAsRead(id: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, is_read: true } : notification,
      ),
    );
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) console.error("Failed to mark notification as read", error);
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((notification) => !notification.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds);
    if (error) console.error("Failed to mark all notifications as read", error);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => {
          // Refetch every time it's opened, so it never shows what was true
          // up to POLL_INTERVAL_MS ago instead of what's true right now.
          setIsOpen((open) => {
            const next = !open;
            if (next) loadNotifications();
            return next;
          });
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-green-gradient px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline"
              >
                <Check className="h-3.5 w-3.5" />
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <p className="px-3.5 py-6 text-center text-sm text-slate-400">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-sm text-slate-400">
                You&apos;re all caught up.
              </p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => markAsRead(notification.id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b border-slate-50 px-3.5 py-2.5 text-left last:border-b-0 hover:bg-slate-50",
                    !notification.is_read && "bg-brand-blue/5",
                  )}
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    {!notification.is_read && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue" />
                    )}
                    {notification.title}
                  </span>
                  {notification.body && (
                    <span className="text-xs text-slate-500">{notification.body}</span>
                  )}
                  <span className="text-[11px] text-slate-400">
                    {formatDateTime(notification.created_at)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
