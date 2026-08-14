import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-brand-blue/10 text-brand-blue",
  "bg-brand-green-mid/10 text-brand-green-mid",
  "bg-purple-100 text-purple-600",
  "bg-rose-100 text-rose-600",
  "bg-amber-100 text-amber-700",
  "bg-slate-200 text-slate-600",
];

function accentForName(name: string): string {
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return PALETTE[sum % PALETTE.length];
}

/** Colored square initials avatar, hashed from `name` for consistent variety. */
export function InitialsAvatar({
  name,
  initials,
  className,
}: {
  name: string;
  initials: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
        accentForName(name),
        className,
      )}
    >
      {initials}
    </div>
  );
}
