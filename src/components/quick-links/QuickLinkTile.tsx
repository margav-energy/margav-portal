import type { LucideIcon } from "lucide-react";

export function QuickLinkTile({
  label,
  href,
  icon: Icon,
}: {
  label: string;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex aspect-square items-center justify-center rounded-lg bg-slate-100">
        <Icon className="h-14 w-14 text-slate-400" strokeWidth={1.5} />
      </div>
      <p className="pt-3 text-center text-sm font-medium text-brand-blue group-hover:underline">
        {label}
      </p>
    </a>
  );
}
