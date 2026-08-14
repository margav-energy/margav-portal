"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { NotificationBanner } from "@/components/layout/NotificationBanner";
import type { CurrentUser } from "@/data/current-user";

export function AppShellClient({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} onMenuClick={() => setIsSidebarOpen((open) => !open)} />
        <NotificationBanner />
        <main className="flex-1 bg-slate-50 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
