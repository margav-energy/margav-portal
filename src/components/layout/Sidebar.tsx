"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { NAV_ITEMS } from "@/lib/nav-config";
import { APP_NAME, APP_VERSION } from "@/lib/constants";
import { SidebarNavItem } from "@/components/layout/SidebarNavItem";
import { SidebarNavGroup } from "@/components/layout/SidebarNavGroup";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/data/current-user";

export function Sidebar({
  role,
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapsed,
}: {
  role: CurrentUser["role"];
  isOpen: boolean;
  onClose: () => void;
  /** Desktop-only icon rail mode — see `AppShellClient`. Mobile always
   *  renders the full-width drawer regardless of this, via the `lg:`-scoped
   *  classes below, so a stale collapsed preference never breaks the
   *  mobile nav. */
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  // Opt-in restrictive: an item (or group child) with no `roles` stays
  // visible to everyone, so existing nav items are unaffected by this
  // filter. Group children need their own pass — filtering only the group
  // itself would still render every child, roles and all, once open.
  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role))
    .map((item) =>
      item.type === "group"
        ? { ...item, children: item.children.filter((child) => !child.roles || child.roles.includes(role)) }
        : item,
    )
    .filter((item) => item.type !== "group" || item.children.length > 0);

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
          "fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-slate-950 px-3 py-5 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:transition-[width]",
          isOpen ? "translate-x-0" : "-translate-x-full",
          isCollapsed && "lg:w-16",
        )}
      >
        <div className={cn("flex items-center gap-2 px-3 pb-6", isCollapsed && "lg:justify-center lg:px-0")}>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-green-gradient" />
          <span className={cn("text-lg font-semibold tracking-tight text-white", isCollapsed && "lg:hidden")}>
            {APP_NAME}
          </span>
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
            className={cn(
              "ml-auto hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white lg:flex",
              isCollapsed && "lg:ml-0",
            )}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden">
          {visibleItems.map((item) =>
            item.type === "link" ? (
              <SidebarNavItem key={item.label} {...item} isCollapsed={isCollapsed} />
            ) : (
              <SidebarNavGroup
                key={item.label}
                {...item}
                isCollapsed={isCollapsed}
                onExpandSidebar={isCollapsed ? onToggleCollapsed : undefined}
              />
            ),
          )}
        </nav>
        <p className={cn("px-3 pt-4 text-xs text-slate-500", isCollapsed && "lg:hidden")}>v{APP_VERSION}</p>
      </aside>
    </>
  );
}
