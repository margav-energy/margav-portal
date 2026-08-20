"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

// Well-known marker row used to persist this banner's dismissal per user.
// A partial unique index on (user_id, title) for this exact title (see
// supabase/migrations/0009_notifications_unique_release_announcement.sql)
// keeps concurrent "insert if not exists" calls from creating duplicates.
// Bump the date in the title (and add a matching migration) each time this
// copy changes for a new release — reusing the old title would just reuse
// already-dismissed users' rows and the banner would never show again.
const ANNOUNCEMENT_TITLE = "Product update — August 2026";
const ANNOUNCEMENT_BODY =
  "You can now send quotes for e-signature and email customers directly from a quote — see the Send Quote and Communications buttons.";

export function NotificationBanner({ userId }: { userId: string }) {
  const [notificationId, setNotificationId] = useState<string | null>(null);
  // Hidden until we've confirmed (read or created) the announcement row, so
  // it doesn't flash on screen for users who already dismissed it.
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function ensureAnnouncement() {
      // Supabase env vars may not be available in this client bundle yet
      // (e.g. a dev server started before .env existed) — skip quietly
      // rather than let createClient() throw; a restart picks up real values.
      if (!isSupabaseConfigured()) return;
      const supabase = createClient();

      const { data: existing, error: selectError } = await supabase
        .from("notifications")
        .select("id, is_read")
        .eq("user_id", userId)
        .eq("title", ANNOUNCEMENT_TITLE)
        .maybeSingle();

      if (!isMounted) return;

      if (selectError) {
        console.error("Failed to load announcement notification", selectError);
        return;
      }

      if (existing) {
        setNotificationId(existing.id);
        setIsDismissed(existing.is_read);
        return;
      }

      const { data: inserted, error: insertError } = await supabase
        .from("notifications")
        .insert({ user_id: userId, title: ANNOUNCEMENT_TITLE, body: ANNOUNCEMENT_BODY })
        .select("id")
        .single();

      if (!isMounted) return;

      if (insertError) {
        // Likely a race with another tab/request that inserted it first —
        // the unique index rejected ours, so just re-fetch the real row.
        const { data: retry } = await supabase
          .from("notifications")
          .select("id, is_read")
          .eq("user_id", userId)
          .eq("title", ANNOUNCEMENT_TITLE)
          .maybeSingle();
        if (!isMounted) return;
        if (retry) {
          setNotificationId(retry.id);
          setIsDismissed(retry.is_read);
        }
        return;
      }

      if (inserted) {
        setNotificationId(inserted.id);
        setIsDismissed(false);
      }
    }

    ensureAnnouncement();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (isDismissed || !notificationId) return null;

  async function dismiss() {
    setIsDismissed(true);
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);
    if (error) console.error("Failed to dismiss announcement notification", error);
  }

  return (
    <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-green-mid" />
      <p className="flex-1 text-sm text-slate-700">{ANNOUNCEMENT_BODY}</p>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={dismiss}
        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
