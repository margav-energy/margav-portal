import { INSTALL_STATUS_STYLES } from "@/lib/status-colors";
import type { InstallStatus } from "@/types/quote";
import { cn } from "@/lib/utils";

export function StatusPill({ status }: { status: InstallStatus }) {
  const { label, className } = INSTALL_STATUS_STYLES[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        className,
      )}
    >
      {label}
    </span>
  );
}
