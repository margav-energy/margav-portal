import { ACTIVITY_STATUS_STYLES } from "@/lib/status-colors";
import type { ActivityStatus } from "@/types/activity";
import { Pill } from "@/components/ui/Pill";

export function ActivityStatusPill({ status }: { status: ActivityStatus }) {
  const { label, className } = ACTIVITY_STATUS_STYLES[status];
  return <Pill label={label} className={className} />;
}
