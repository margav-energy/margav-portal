import { ACCEPTANCE_STATUS_STYLES } from "@/lib/status-colors";
import type { AcceptanceStatus } from "@/types/allocated-appointment";
import { Pill } from "@/components/ui/Pill";

export function AcceptanceStatusPill({ status }: { status: AcceptanceStatus }) {
  const { label, className } = ACCEPTANCE_STATUS_STYLES[status];
  return <Pill label={label} className={className} />;
}
