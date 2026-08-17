import { QUOTE_PIPELINE_STATUS_STYLES } from "@/lib/status-colors";
import type { QuotePipelineStatus } from "@/types/quote";
import { Pill } from "@/components/ui/Pill";

export function QuotePipelineStatusPill({ status }: { status: QuotePipelineStatus }) {
  const { label, className } = QUOTE_PIPELINE_STATUS_STYLES[status];
  return <Pill label={label} className={className} />;
}
