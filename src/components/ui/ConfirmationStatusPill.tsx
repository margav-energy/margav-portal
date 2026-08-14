import { CONFIRMATION_STATUS_STYLES } from "@/lib/status-colors";
import type { ConfirmationStatus } from "@/types/ready-to-confirm";
import { Pill } from "@/components/ui/Pill";

export function ConfirmationStatusPill({ status }: { status: ConfirmationStatus }) {
  const { label, className } = CONFIRMATION_STATUS_STYLES[status];
  return <Pill label={label} className={className} />;
}
