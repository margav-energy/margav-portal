import { INSTALLER_AVAILABILITY_STATUS_STYLES } from "@/lib/status-colors";
import type { InstallerAvailabilityStatus } from "@/types/installer-availability";
import { Pill } from "@/components/ui/Pill";

export function InstallerAvailabilityStatusPill({
  status,
}: {
  status: InstallerAvailabilityStatus | null;
}) {
  const { label, className } = INSTALLER_AVAILABILITY_STATUS_STYLES[status ?? "unset"];
  return <Pill label={label} className={className} />;
}
