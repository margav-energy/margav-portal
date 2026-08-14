import { rtaLeads } from "@/data/rta-leads";
import type { RtaLead } from "@/types/rta-lead";

export async function getAllRtaLeads(): Promise<RtaLead[]> {
  return rtaLeads;
}
