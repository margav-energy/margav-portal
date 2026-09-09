import {
  Activity,
  Briefcase,
  Calculator,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  FileText,
  HandCoins,
  LayoutDashboard,
  Link2,
  PiggyBank,
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
      /** Opens `href` in a new tab via a plain `<a>` instead of a Next
       *  `<Link>` — for off-site destinations (e.g. the finance partner). */
      external?: boolean;
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
    }
  | {
      type: "action";
      label: string;
      icon: LucideIcon;
      /** Identifies which in-app modal/handler this item triggers — kept
       *  as data here so `Sidebar` owns the actual behaviour. */
      action: "finance-calculator";
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
    type: "action",
    label: "Finance Calculator",
    icon: Calculator,
    action: "finance-calculator",
    roles: ["admin", "rep"],
  },
  {
    type: "link",
    label: "Apply for Finance",
    href: "https://ideal4finance.com/retail-hi/apply/margav",
    icon: HandCoins,
    external: true,
    roles: ["admin", "rep"],
  },
  {
    type: "link",
    label: "Personal Loan",
    href: "https://ideal4finance.com/apply/margav/loan",
    icon: PiggyBank,
    external: true,
    roles: ["admin", "rep"],
  },
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
