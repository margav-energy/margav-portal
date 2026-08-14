"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, type LucideIcon } from "lucide-react";
import type { NavLeaf } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

export function SidebarNavGroup({
  label,
  icon: Icon,
  children,
  comingSoon,
}: {
  label: string;
  icon: LucideIcon;
  children: NavLeaf[];
  comingSoon?: boolean;
}) {
  const pathname = usePathname();
  const isChildActive = children.some((child) => child.href === pathname);
  const [isOpen, setIsOpen] = useState(isChildActive);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isChildActive
            ? "bg-white/10 text-white"
            : "text-slate-300 hover:bg-white/5 hover:text-white",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        {comingSoon && (
          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-300 uppercase">
            Soon
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>
      {isOpen && (
        <div className="mt-1 ml-7 flex flex-col gap-0.5 border-l border-white/10 pl-3">
          {children.map((child) => {
            const isActive = pathname === child.href;
            return (
              <Link
                key={child.label}
                href={child.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-md px-2 py-1.5 text-sm transition-colors",
                  isActive
                    ? "text-white"
                    : "text-slate-400 hover:text-white",
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
