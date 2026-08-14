import { allocatedAppointments } from "@/data/allocated-appointments";
import type { AllocatedAppointment } from "@/types/allocated-appointment";

export async function getAllAllocatedAppointments(): Promise<AllocatedAppointment[]> {
  return allocatedAppointments;
}
