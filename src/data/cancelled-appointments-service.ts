import { cancelledAppointments } from "@/data/cancelled-appointments";
import type { CancelledAppointment } from "@/types/cancelled-appointment";

export async function getAllCancelledAppointments(): Promise<CancelledAppointment[]> {
  return cancelledAppointments;
}
