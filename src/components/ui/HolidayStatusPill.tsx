import { HOLIDAY_STATUS_STYLES } from "@/lib/status-colors";
import type { HolidayStatus } from "@/types/holiday";
import { Pill } from "@/components/ui/Pill";

export function HolidayStatusPill({ status }: { status: HolidayStatus }) {
  const { label, className } = HOLIDAY_STATUS_STYLES[status];
  return <Pill label={label} className={className} />;
}
