"use client";

import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 600;

/**
 * Debounce-persists `value` to localStorage under `key` so an in-progress
 * form survives an accidental tab close, browser crash, or OS restart.
 *
 * Usage pattern in a form component:
 *   const [form, setForm] = useState(() => loadDraft<FormValues>(draftKey) ?? emptyForm);
 *   useAutosaveDraft(draftKey, form);
 *   // on successful submit:
 *   clearDraft(draftKey);
 *
 * Pass `key: null` to disable (e.g. while an id the key depends on isn't known yet).
 * Never pass raw credentials (passwords, tokens) in `value` — localStorage is
 * unencrypted and persists past the session.
 */
export function useAutosaveDraft<T>(key: string | null, value: T, enabled = true) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || !key) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // localStorage unavailable (private browsing, quota exceeded) — nothing to autosave to, fail silently.
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-runs on every value change to debounce-save it
  }, [key, JSON.stringify(value), enabled]);
}

/** Reads a previously autosaved draft, if any. Returns null on first visit or if storage is unavailable/corrupt. */
export function loadDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Call after a successful submit so the next visit doesn't restore stale data. */
export function clearDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
