"use client";

import { useEffect, useRef, useState } from "react";

const DEBOUNCE_MS = 600;

/**
 * Debounce-persists `value` to localStorage under `key` so an in-progress
 * form survives an accidental tab close, browser crash, or OS restart.
 *
 * Usage pattern in a form component:
 *   const [form, setForm] = useState<FormValues>(emptyForm); // NOT loadDraft(...) — see useDraftRestore
 *   const draftRestored = useDraftRestore<FormValues>(draftKey, setForm);
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

/**
 * Restores a previously autosaved draft, if any — strictly AFTER mount, never
 * during the initial render. A Client Component that's server-rendered gets
 * hydrated against exactly the HTML the server sent; the server has no
 * localStorage, so if a component instead read a draft inside a
 * `useState(() => loadDraft(...))` initializer, the server's render (no
 * draft, always the plain default) and the client's very first render
 * (whatever's actually in storage) would disagree the moment a draft
 * exists — a hydration mismatch. Doing it here, in a `useEffect`, means the
 * first paint always matches the server; the draft (if any) is applied a
 * moment later — a harmless flash rather than an error.
 *
 * Returns whether a draft was found and applied — use it to show a "draft
 * restored" notice. `onRestore` only needs to be stable across the initial
 * mount; a fresh inline function each render is fine (only `key` re-triggers
 * the effect).
 */
export function useDraftRestore<T>(key: string | null, onRestore: (draft: T) => void): boolean {
  const [restored, setRestored] = useState(false);
  const onRestoreRef = useRef(onRestore);

  // Keeps the ref current without writing to it during render.
  useEffect(() => {
    onRestoreRef.current = onRestore;
  });

  useEffect(() => {
    if (!key) return;
    // Deferred a tick (rather than read synchronously in the effect body) so this
    // is unambiguously "after commit, not part of it" — restoring is inherently a
    // side effect on external state, not something the render itself depends on.
    queueMicrotask(() => {
      const draft = loadDraft<T>(key);
      if (draft !== null) {
        onRestoreRef.current(draft);
        setRestored(true);
      }
    });
  }, [key]);

  return restored;
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
