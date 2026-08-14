import type { RtaLead } from "@/types/rta-lead";

// New leads with a booked appointment slot that hasn't been assigned to a
// rep yet.
export const unallocatedLeads: RtaLead[] = [
  { id: "unalloc-01", leadName: "Grace Whitmore", phone: "07700 900201", appointmentAt: "2026-08-16T10:00:00" },
  { id: "unalloc-02", leadName: "Owen Pemberton", phone: "07700 900202", appointmentAt: "2026-08-16T14:30:00" },
  { id: "unalloc-03", leadName: "Aisha Malik", phone: "07700 900203", appointmentAt: "2026-08-17T11:00:00" },
  { id: "unalloc-04", leadName: "Ben Calloway", phone: "07700 900204", appointmentAt: "2026-08-18T09:30:00" },
  { id: "unalloc-05", leadName: "Rosie Fenton", phone: "07700 900205", appointmentAt: "2026-08-19T15:00:00" },
  { id: "unalloc-06", leadName: "Jack Openshaw", phone: "07700 900206", appointmentAt: "2026-08-20T13:00:00" },
  { id: "unalloc-07", leadName: "Yasmin Iqbal", phone: "07700 900207", appointmentAt: "2026-08-21T10:30:00" },
];
