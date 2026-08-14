import { cn } from "@/lib/utils";

export function Avatar({
  initials,
  className,
}: {
  initials: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue text-sm font-semibold text-white",
        className,
      )}
    >
      {initials}
    </div>
  );
}
