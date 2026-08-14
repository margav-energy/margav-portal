import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type IconTileAccent = "blue" | "green";

const ACCENT_CLASSES: Record<IconTileAccent, string> = {
  blue: "bg-brand-blue/10 text-brand-blue",
  green: "bg-brand-green-gradient text-white",
};

export function IconTile({
  icon: Icon,
  accent = "blue",
  className,
}: {
  icon: LucideIcon;
  accent?: IconTileAccent;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
        ACCENT_CLASSES[accent],
        className,
      )}
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
    </div>
  );
}
