"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { NotificationBanner } from "@/components/layout/NotificationBanner";
import type { CurrentUser } from "@/data/current-user";

// Routes that manage their own full-screen layout (no persistent sidebar/topbar).
const FULL_BLEED_ROUTES = ["/appointments/calendar", "/login"];

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

  // `user` is only ever null on /login (src/proxy.ts redirects every other
  // route there when signed out), which is already full-bleed above — this
  // is just a defensive fallback so Topbar never renders without one.
  if (isFullBleedRoute(pathname) || !user) {
    return <div className="min-h-screen bg-slate-50">{children}</div>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} onMenuClick={() => setIsSidebarOpen((open) => !open)} />
        <NotificationBanner userId={user.id} />
        <main className="flex-1 bg-slate-50 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
