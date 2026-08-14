import { INSTALL_STATUS_STYLES } from "@/lib/status-colors";
import type { InstallStatus } from "@/types/quote";
import { Pill } from "@/components/ui/Pill";

export function StatusPill({ status }: { status: InstallStatus }) {
  const { label, className } = INSTALL_STATUS_STYLES[status];
  return <Pill label={label} className={className} />;
}
