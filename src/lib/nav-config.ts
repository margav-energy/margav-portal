import {
  Activity,
  CalendarClock,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Link2,
  Plus,
  type LucideIcon,
} from "lucide-react";

export interface NavLeaf {
  label: string;
  href: string;
}

export type NavItem =
  | { type: "link"; label: string; href: string; icon: LucideIcon; comingSoon?: boolean }
  | {
      type: "group";
      label: string;
      icon: LucideIcon;
      children: NavLeaf[];
      comingSoon?: boolean;
    };

export const NAV_ITEMS: NavItem[] = [
  { type: "link", label: "Dashboard", href: "/", icon: LayoutDashboard },
  { type: "link", label: "Activity Feed", href: "/activity-feed", icon: Activity },
  { type: "link", label: "Holidays", href: "/holidays", icon: CalendarDays },
  { type: "link", label: "Quick Links", href: "/quick-links", icon: Link2 },
  {
    type: "link",
    label: "Create Appointment",
    href: "/appointments",
    icon: Plus,
    comingSoon: true,
  },
  {
    type: "group",
    label: "Appointments",
    icon: CalendarClock,
    comingSoon: true,
    children: [
      { label: "View calendar", href: "/appointments" },
      { label: "RTA due", href: "/appointments" },
      { label: "Ready to Confirm", href: "/appointments" },
      { label: "Unallocated", href: "/appointments" },
      { label: "Allocated, not accepted", href: "/appointments" },
      { label: "Outcome Missing", href: "/appointments" },
      { label: "Recently cancelled", href: "/appointments" },
    ],
  },
  {
    type: "group",
    label: "Quotes",
    icon: FileText,
    children: [{ label: "View all quotes", href: "/quotes" }],
  },
];

/** Resolves a route pathname to the page title shown in the topbar. */
export function getPageTitle(pathname: string): string {
  for (const item of NAV_ITEMS) {
    if (item.type === "link" && item.href === pathname) return item.label;
    if (item.type === "group") {
      if (item.children.some((child) => child.href === pathname)) {
        return item.label;
      }
    }
  }

  if (pathname.startsWith("/quotes/")) return "Quote Detail";

  const lastSegment = pathname.split("/").filter(Boolean).pop();
  if (!lastSegment) return "Dashboard";

  return lastSegment
    .split("-")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}
