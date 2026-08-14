import { outcomeMissingLeads } from "@/data/outcome-missing-leads";
import type { OutcomeMissingLead } from "@/types/outcome-missing";

export async function getAllOutcomeMissingLeads(): Promise<OutcomeMissingLead[]> {
  return outcomeMissingLeads;
}
