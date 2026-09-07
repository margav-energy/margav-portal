"use client";

import { useEffect, useState } from "react";

/**
 * Tracks browser connectivity so a form can react to losing/regaining a
 * network connection (see the offline photo/submit queueing in
 * `src/app/survey/[token]/SurveyForm.tsx`). Defaults to `true` — the value
 * only matters once mounted in the browser; `navigator` doesn't exist during
 * SSR, and starting `true` avoids a false "you're offline" flash before the
 * first effect runs.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Deferred a tick, same pattern as `useDraftRestore` in useAutosaveDraft.ts —
    // keeps the first paint matching the server-rendered "online" default instead
    // of setState-ing synchronously inside the effect body.
    queueMicrotask(() => setIsOnline(navigator.onLine));
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}
