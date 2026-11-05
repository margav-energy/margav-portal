import { Pencil, Reply, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIONS = {
  edit: { Icon: Pencil, label: "Edit", filled: "bg-brand-green-gradient text-black hover:brightness-95", subtle: "text-slate-500 hover:text-brand-blue" },
  delete: { Icon: Trash2, label: "Delete", filled: "bg-red-600 text-white hover:bg-red-700", subtle: "text-slate-500 hover:text-red-600" },
  reply: { Icon: Reply, label: "Reply", filled: "bg-slate-100 text-slate-700 hover:bg-slate-200", subtle: "text-slate-500 hover:text-brand-blue" },
} as const;

export type ActionIconKind = keyof typeof ACTIONS;

/**
 * An icon-only Edit / Delete / Reply button. The label is the accessible name and the default tooltip;
 * pass `title` to replace the tooltip (e.g. "Unlock this quote to make changes"). `subtle` drops the fill
 * for use inline, such as on a note.
 */
export function ActionIcon({
  action,
  onClick,
  disabled,
  title,
  label,
  subtle = false,
  className,
}: {
  action: ActionIconKind;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  /** Overrides the default label, e.g. "Remove". */
  label?: string;
  subtle?: boolean;
  className?: string;
}) {
  const { Icon, label: defaultLabel, filled, subtle: subtleClasses } = ACTIONS[action];
  const name = label ?? defaultLabel;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={name}
      title={title ?? name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        subtle ? cn("p-1", subtleClasses) : cn("h-8 w-8 rounded-lg", filled),
        className,
      )}
    >
      <Icon className={subtle ? "h-4 w-4" : "h-3.5 w-3.5"} />
    </button>
  );
}
