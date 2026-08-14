import type { RtaLead } from "@/types/rta-lead";

// Leads with an upcoming appointment that still need a reminder call before
// the visit. Names/times overlap with the nearer end of the Calendar
// module's mock appointments for continuity.
export const rtaLeads: RtaLead[] = [
  { id: "rta-01", leadName: "David Whitfield", phone: "07700 900101", appointmentAt: "2026-08-14T10:00:00" },
  { id: "rta-02", leadName: "Callum Fenwick", phone: "07700 900102", appointmentAt: "2026-08-14T13:00:00" },
  { id: "rta-03", leadName: "Priya Anand", phone: "07700 900103", appointmentAt: "2026-08-15T09:00:00" },
  { id: "rta-04", leadName: "Michael O'Rourke", phone: "07700 900104", appointmentAt: "2026-08-17T09:00:00" },
  { id: "rta-05", leadName: "Sian Hargreaves", phone: "07700 900105", appointmentAt: "2026-08-18T14:00:00" },
  { id: "rta-06", leadName: "Tom Brannigan", phone: "07700 900106", appointmentAt: "2026-08-19T11:00:00" },
  { id: "rta-07", leadName: "Amara Okafor", phone: "07700 900107", appointmentAt: "2026-08-20T16:00:00" },
  { id: "rta-08", leadName: "Craig Beaumont", phone: "07700 900108", appointmentAt: "2026-08-21T10:00:00" },
  { id: "rta-09", leadName: "Freya Nicholson", phone: "07700 900109", appointmentAt: "2026-08-24T09:30:00" },
  { id: "rta-10", leadName: "Holly Sutcliffe", phone: "07700 900110", appointmentAt: "2026-08-25T14:00:00" },
  { id: "rta-11", leadName: "Dean Ashworth", phone: "07700 900111", appointmentAt: "2026-08-26T11:00:00" },
  { id: "rta-12", leadName: "Nadia Farooq", phone: "07700 900112", appointmentAt: "2026-08-27T15:00:00" },
  { id: "rta-13", leadName: "Lewis Braithwaite", phone: "07700 900113", appointmentAt: "2026-08-28T10:00:00" },
  { id: "rta-14", leadName: "Charlotte Ingham", phone: "07700 900114", appointmentAt: "2026-08-29T13:00:00" },
];
