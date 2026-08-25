import { cn } from "@/lib/utils";
import { accentForName } from "@/lib/name-color";

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
