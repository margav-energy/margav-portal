"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { getPageTitle } from "@/lib/nav-config";
import { SearchBar } from "@/components/layout/SearchBar";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { TeamMembersBadge } from "@/components/layout/TeamMembersBadge";
import { UserMenu } from "@/components/layout/UserMenu";
import type { CurrentUser } from "@/data/current-user";

export function Topbar({
  user,
  onMenuClick,
}: {
  user: CurrentUser;
  onMenuClick: () => void;
}) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <button
        type="button"
        aria-label="Toggle navigation"
        onClick={onMenuClick}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        <SearchBar />
        <NotificationBell userId={user.id} />
        <TeamMembersBadge count={user.teamMemberCount} />
        <UserMenu firstName={user.firstName} initials={user.initials} email={user.email} />
      </div>
    </header>
  );
}
