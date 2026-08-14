import { Globe, Image, MapPin, Star, type LucideIcon } from "lucide-react";

export interface QuickLink {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Placeholder hrefs until Margav supplies the real destinations for each.
export const QUICK_LINKS: QuickLink[] = [
  { label: "Margav Website", href: "#", icon: Globe },
  { label: "Trustpilot", href: "#", icon: Star },
  { label: "Install Gallery", href: "#", icon: Image },
  { label: "Installs Map", href: "#", icon: MapPin },
];
