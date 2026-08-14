import { readyToConfirmLeads } from "@/data/ready-to-confirm-leads";
import type { ReadyToConfirmLead } from "@/types/ready-to-confirm";

export async function getAllReadyToConfirmLeads(): Promise<ReadyToConfirmLead[]> {
  return readyToConfirmLeads;
}
