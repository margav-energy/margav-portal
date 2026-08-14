import { unallocatedLeads } from "@/data/unallocated-leads";
import type { RtaLead } from "@/types/rta-lead";

export async function getAllUnallocatedLeads(): Promise<RtaLead[]> {
  return unallocatedLeads;
}
