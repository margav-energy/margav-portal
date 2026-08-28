import {
  Activity,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Link2,
  Plus,
  type LucideIcon,
} from "lucide-react";
import type { CurrentUser } from "@/data/current-user";

export interface NavLeaf {
  label: string;
  href: string;
  /** Restricts visibility to these roles. Omit to show to everyone —
   *  this is opt-in restrictive, not opt-in permissive, so existing
   *  leaves without `roles` keep showing for every role. */
  roles?: CurrentUser["role"][];
}

export type NavItem =
  | {
      type: "link";
      label: string;
      href: string;
      icon: LucideIcon;
      comingSoon?: boolean;
      /** Restricts visibility to these roles. Omit to show to everyone —
       *  this is opt-in restrictive, not opt-in permissive, so existing
       *  items without `roles` must keep showing for every role. */
      roles?: CurrentUser["role"][];
    }
  | {
      type: "group";
      label: string;
      icon: LucideIcon;
      children: NavLeaf[];
      comingSoon?: boolean;
      roles?: CurrentUser["role"][];
    };

export const NAV_ITEMS: NavItem[] = [
  { type: "link", label: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["admin", "rep"] },
  { type: "link", label: "Activity Feed", href: "/activity-feed", icon: Activity, roles: ["admin", "rep"] },
  { type: "link", label: "Holidays", href: "/holidays", icon: CalendarDays, roles: ["admin", "rep"] },
  {
    type: "link",
    label: "My Availability",
    href: "/availability",
    icon: CalendarCheck,
    roles: ["installer"],
  },
  {
    type: "link",
    label: "Upcoming Jobs",
    href: "/jobs",
    icon: Briefcase,
    roles: ["installer"],
  },
  { type: "link", label: "Quick Links", href: "/quick-links", icon: Link2, roles: ["admin", "rep"] },
  {
    type: "link",
    label: "Create Appointment",
    href: "/appointments/create",
    icon: Plus,
    roles: ["admin"],
  },
  {
    type: "group",
    label: "Appointments",
    icon: CalendarClock,
    roles: ["admin", "rep"],
    children: [
      { label: "View calendar", href: "/appointments/calendar" },
      { label: "RTA due", href: "/appointments/rta-due" },
      { label: "Ready to Confirm", href: "/appointments/ready-to-confirm" },
      { label: "Unallocated", href: "/appointments/unallocated" },
      { label: "Allocated, not accepted", href: "/appointments/allocated-not-accepted" },
      { label: "Outcome Missing", href: "/appointments/outcome-missing" },
      { label: "Recently cancelled", href: "/appointments/recently-cancelled" },
      { label: "Installer Availability", href: "/appointments/installer-availability", roles: ["admin"] },
    ],
  },
  {
    type: "group",
    label: "Quotes",
    icon: FileText,
    roles: ["admin", "rep"],
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
