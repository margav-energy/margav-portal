"use client";

import { useEffect } from "react";

/**
 * Catches a crash in `layout.tsx` itself (e.g. `getCurrentUser()` throwing)
 * — the one place `src/app/error.tsx` can't reach, since that boundary
 * wraps everything layout.tsx renders, not layout.tsx's own body. This
 * has to render its own <html>/<body> because it replaces the root layout
 * entirely, so there's no Sidebar/Topbar to fall back on here — just a
 * plain reload, which re-runs the layout from scratch.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: "24rem", padding: "1rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#0f172a" }}>Something went wrong</h2>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
            Margav Portal couldn&apos;t load. Try again, or reload the page.
          </p>
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem", justifyContent: "center" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                background: "#2563eb",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/login"
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                background: "#f1f5f9",
                color: "#334155",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Go to login
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
