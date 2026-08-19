"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

// The banner's own "have you seen the announcement" row is surfaced here too
// (see NotificationBanner) — it's a real notification, so it belongs in the
// same list.
export function NotificationBell({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadNotifications() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, is_read, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!isMounted) return;
      if (error) {
        console.error("Failed to load notifications", error);
      } else {
        setNotifications((data ?? []) as NotificationRow[]);
      }
      setIsLoading(false);
    }

    loadNotifications();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  async function markAsRead(id: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, is_read: true } : notification,
      ),
    );
    const supabase = createClient();
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (error) console.error("Failed to mark notification as read", error);
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((notification) => !notification.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
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
        onClick={() => setIsOpen((open) => !open)}
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
