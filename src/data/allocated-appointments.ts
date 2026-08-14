import type { AllocatedAppointment } from "@/types/allocated-appointment";

// Appointments assigned to a rep who hasn't accepted them via the acceptance
// form yet. "Overdue" ones have already passed their appointment time.
export const allocatedAppointments: AllocatedAppointment[] = [
  { id: "alloc-01", customerName: "Charlotte Ingham", status: "overdue", representativeName: "Damon Clarke", appointmentAt: "2026-08-12T09:00:00", response: "Reminder sent" },
  { id: "alloc-02", customerName: "Lewis Braithwaite", status: "overdue", representativeName: "Joe Preston", appointmentAt: "2026-08-13T14:00:00" },
  { id: "alloc-03", customerName: "Grace Whitmore", status: "pending", representativeName: "Lucy Starkey", appointmentAt: "2026-08-16T10:00:00" },
  { id: "alloc-04", customerName: "Owen Pemberton", status: "pending", representativeName: "Matt Gavin", appointmentAt: "2026-08-16T15:00:00", response: "Reminder sent" },
  { id: "alloc-05", customerName: "Aisha Malik", status: "pending", representativeName: "Damon Clarke", appointmentAt: "2026-08-17T11:00:00" },
  { id: "alloc-06", customerName: "Ben Calloway", status: "pending", representativeName: "Joe Preston", appointmentAt: "2026-08-18T09:30:00" },
  { id: "alloc-07", customerName: "Rosie Fenton", status: "pending", representativeName: "Lucy Starkey", appointmentAt: "2026-08-19T15:30:00" },
  { id: "alloc-08", customerName: "Jack Openshaw", status: "pending", representativeName: "Matt Gavin", appointmentAt: "2026-08-20T13:00:00" },
];
