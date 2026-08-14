import type { CancelledAppointment } from "@/types/cancelled-appointment";

export const cancelledAppointments: CancelledAppointment[] = [
  { id: "cancel-01", customerName: "Bernard Dann", address: "1 Pinfold Close, South Staffordshire, ST19 9PF", representativeName: "None", appointmentAt: "2026-08-10T10:00:00", reason: "Customer Cancelled (Via Email Form)" },
  { id: "cancel-02", customerName: "Wendy Fothergill", address: "9 Chapel Fold, Wakefield, WF2 7QY", representativeName: "Damon Clarke", appointmentAt: "2026-08-11T14:00:00", reason: "Customer Cancelled (Phone)" },
  { id: "cancel-03", customerName: "Arthur Stainforth", address: "27 Kirkgate, Bradford, BD1 1QL", representativeName: "Joe Preston", appointmentAt: "2026-08-12T09:30:00", reason: "Rep Unavailable — Rescheduling" },
  { id: "cancel-04", customerName: "Nusrat Bibi", address: "3 Church Lane, Halifax, HX1 2NA", representativeName: "None", appointmentAt: "2026-08-13T11:00:00", reason: "Duplicate Booking" },
  { id: "cancel-05", customerName: "Colin Wraith", address: "14 Manor Road, Doncaster, DN1 3JG", representativeName: "Lucy Starkey", appointmentAt: "2026-08-13T15:30:00", reason: "Customer No Longer Interested" },
];
