import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

function accentForName(name: string): "blue" | "green" {
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return sum % 2 === 0 ? "blue" : "green";
}

export function ActivityAvatar({
  actorName,
  initials,
  isSystem,
}: {
  actorName: string;
  initials?: string;
  isSystem?: boolean;
}) {
  if (isSystem) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Settings2 className="h-5 w-5" />
      </div>
    );
  }

  const accent = accentForName(actorName);

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
        accent === "blue"
          ? "bg-brand-blue/10 text-brand-blue"
          : "bg-brand-green-mid/10 text-brand-green-mid",
      )}
    >
      {initials}
    </div>
  );
}
