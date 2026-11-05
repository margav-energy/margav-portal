"use client";

import { useEffect, useState } from "react";

/**
 * A boolean kept in localStorage, so a panel stays open or closed across quotes and reloads.
 * Starts at `initial` (what the server rendered) and applies the saved value after mount, which
 * avoids a hydration mismatch. Storage can be blocked or unavailable, so every access is guarded.
 */
export function usePersistedToggle(key: string, initial: boolean): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(initial);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- applied after mount on purpose, see above
      if (saved === "true" || saved === "false") setValue(saved === "true");
    } catch {
      // Storage unavailable — keep the default.
    }
  }, [key]);

  function update(next: boolean) {
    setValue(next);
    try {
      window.localStorage.setItem(key, String(next));
    } catch {
      // Not persisted this time; the toggle still works.
    }
  }

  return [value, update];
}
