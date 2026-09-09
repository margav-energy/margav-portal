"use client";

import { createContext, useContext, useState } from "react";

/**
 * Dashboard-wide "show figures" toggle. Quote counts/prices default to
 * hidden on the dashboard (customer might be looking over a rep's
 * shoulder), and this single eye-icon toggle (`RevealToggleButton`) reveals
 * them all at once, for as long as this page stays open. Prices/counts on
 * the `/quotes` list and detail pages are unaffected — this context only
 * wraps the dashboard.
 */
const RevealSensitiveContext = createContext<{ isRevealed: boolean; toggle: () => void } | null>(null);

export function RevealSensitiveProvider({ children }: { children: React.ReactNode }) {
  const [isRevealed, setIsRevealed] = useState(false);

  return (
    <RevealSensitiveContext.Provider value={{ isRevealed, toggle: () => setIsRevealed((value) => !value) }}>
      {children}
    </RevealSensitiveContext.Provider>
  );
}

export function useRevealSensitive() {
  const context = useContext(RevealSensitiveContext);
  if (!context) {
    throw new Error("useRevealSensitive must be used within a RevealSensitiveProvider");
  }
  return context;
}
