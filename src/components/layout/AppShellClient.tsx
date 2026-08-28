"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import type { CurrentUser } from "@/data/current-user";

// Routes that manage their own full-screen layout (no persistent sidebar/topbar).
const FULL_BLEED_ROUTES = ["/appointments/calendar", "/login"];

// Desktop-only icon-rail collapse (separate from the mobile off-canvas
// open/close above) — remembered per-browser so it doesn't reset every
// page load. Starts `false` on every render (server and first client
// paint) and is synced from storage in an effect below, so there's no
// server/client markup mismatch — collapsed users see one brief flash of
// the expanded sidebar on load, which is the standard trade-off for this
// pattern.
const SIDEBAR_COLLAPSED_KEY = "margav-sidebar-collapsed";

// The quote Presenter (/quotes/[id]/presenter) needs the same treatment but
// is a dynamic route, so it's matched separately rather than added above.
function isFullBleedRoute(pathname: string): boolean {
  return FULL_BLEED_ROUTES.includes(pathname) || pathname.endsWith("/presenter");
}

export function AppShellClient({
  user,
  children,
}: {
  user: CurrentUser | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      // One-time sync from an external store (localStorage) on mount — the
      // deliberate case this lint rule's "cascading renders" warning isn't
      // about; there's nothing recurring here to cascade.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true") setIsSidebarCollapsed(true);
    } catch {
      // localStorage can throw (private browsing, disabled storage) — fall back to expanded.
    }
  }, []);

  function toggleSidebarCollapsed() {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore — see above
      }
      return next;
    });
  }

  // `user` is only ever null on /login (src/proxy.ts redirects every other
  // route there when signed out), which is already full-bleed above — this
  // is just a defensive fallback so Topbar never renders without one.
  if (isFullBleedRoute(pathname) || !user) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={user.role}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} onMenuClick={() => setIsSidebarOpen((open) => !open)} />
        <main className="flex-1 bg-slate-50 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
