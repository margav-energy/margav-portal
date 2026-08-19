import { Award, Globe, Image, Map, type LucideIcon } from "lucide-react";

export interface QuickLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Placeholder hrefs until Margav supplies the real destinations for each.
export const QUICK_LINKS: QuickLink[] = [
  { label: "Margav Website", href: "https://www.margavheating.com", icon: Globe },
  { label: "Trustpilot", href: "#", icon: Award },
  { label: "Install Gallery", href: "#", icon: Image },
  { label: "Installs Map", href: "#", icon: Map },
];
