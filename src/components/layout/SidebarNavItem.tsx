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
  external,
  onClick,
}: {
  label: string;
  /** Omit when `onClick` is provided — this item triggers an in-app action
   *  (e.g. opening a modal) instead of navigating anywhere. */
  href?: string;
  icon: LucideIcon;
  comingSoon?: boolean;
  isCollapsed?: boolean;
  /** Renders a plain `<a target="_blank">` instead of a Next `<Link>`, for
   *  off-site destinations. Ignored when `onClick` is provided. */
  external?: boolean;
  /** When set, renders a `<button>` that runs this instead of navigating —
   *  `href` is ignored. */
  onClick?: () => void;
}) {
  const pathname = usePathname();
  const isActive = !onClick && pathname === href;

  const className = cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-white/10 text-white"
      : "text-slate-300 hover:bg-white/5 hover:text-white",
    isCollapsed && "lg:justify-center",
  );

  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0" />
      <span className={cn("flex-1 text-left", isCollapsed && "lg:hidden")}>{label}</span>
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
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={isCollapsed ? label : undefined} className={className}>
        {content}
      </button>
    );
  }

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={isCollapsed ? label : undefined}
        className={className}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={href ?? "#"}
      aria-current={isActive ? "page" : undefined}
      title={isCollapsed ? label : undefined}
      className={className}
    >
      {content}
    </Link>
  );
}
