"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SidebarNavItem({
  label,
  href,
  icon: Icon,
  comingSoon,
  isCollapsed,
}: {
  label: string;
  href: string;
  icon: LucideIcon;
  comingSoon?: boolean;
  isCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      title={isCollapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-white/10 text-white"
          : "text-slate-300 hover:bg-white/5 hover:text-white",
        isCollapsed && "lg:justify-center",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={cn("flex-1", isCollapsed && "lg:hidden")}>{label}</span>
      {comingSoon && (
        <span
          className={cn(
            "rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-300 uppercase",
            isCollapsed && "lg:hidden",
          )}
        >
          Soon
        </span>
      )}
    </Link>
  );
}
