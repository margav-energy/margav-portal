import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";

export function StatCard({
  label,
  value,
  href,
  linkLabel,
  icon,
  accent = "blue",
}: {
  label: string;
  value: number;
  href: string;
  linkLabel: string;
  icon: LucideIcon;
  accent?: "blue" | "green";
}) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {label}
        </p>
        <IconTile icon={icon} accent={accent} />
      </div>
      <p className="text-4xl font-semibold text-slate-900">{value}</p>
      <Link
        href={href}
        className="text-sm font-medium text-brand-blue hover:underline"
      >
        {linkLabel}
      </Link>
    </Card>
  );
}
