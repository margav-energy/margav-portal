"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { signOutAction } from "@/lib/auth-actions";

export function UserMenu({
  firstName,
  initials,
  email,
}: {
  firstName: string;
  initials: string;
  email: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100"
      >
        <Avatar initials={initials} className="h-8 w-8 text-xs" />
        <span className="hidden text-sm font-medium text-slate-700 sm:inline">{firstName}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <div className="border-b border-slate-100 px-3.5 py-2.5">
            <p className="truncate text-sm font-medium text-slate-900">{firstName}</p>
            <p className="truncate text-xs text-slate-500">{email}</p>
          </div>
          <Link
            href="/settings"
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
