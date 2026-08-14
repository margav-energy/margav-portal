"use client";

import { NAV_ITEMS } from "@/lib/nav-config";
import { APP_NAME, APP_VERSION } from "@/lib/constants";
import { SidebarNavItem } from "@/components/layout/SidebarNavItem";
import { SidebarNavGroup } from "@/components/layout/SidebarNavGroup";
import { cn } from "@/lib/utils";

export function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-slate-950 px-3 py-5 transition-transform lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 px-3 pb-6">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-green-gradient" />
          <span className="text-lg font-semibold tracking-tight text-white">
            {APP_NAME}
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {NAV_ITEMS.map((item) =>
            item.type === "link" ? (
              <SidebarNavItem key={item.label} {...item} />
            ) : (
              <SidebarNavGroup key={item.label} {...item} />
            ),
          )}
        </nav>
        <p className="px-3 pt-4 text-xs text-slate-500">v{APP_VERSION}</p>
      </aside>
    </>
  );
}
