import type { OutcomeMissingLead } from "@/types/outcome-missing";

// Appointments that have already happened (or are about to) with no
// recorded outcome yet.
export const outcomeMissingLeads: OutcomeMissingLead[] = [
  { id: "om-01", leadName: "Priya Anand", address: "14 Kirkstall Road, Leeds, LS4 2EW", phone: "07700 900401", representativeName: "Damon Clarke", appointmentAt: "2026-08-10T14:00:00" },
  { id: "om-02", leadName: "Michael O'Rourke", address: "22 Wakefield Road, Huddersfield, HD1 3AA", phone: "07700 900402", representativeName: "Joe Preston", appointmentAt: "2026-08-12T11:00:00" },
  { id: "om-03", leadName: "Sian Hargreaves", address: "8 Market Street, Wakefield, WF1 1DX", phone: "07700 900403", representativeName: "Lucy Starkey", appointmentAt: "2026-08-13T16:30:00" },
  { id: "om-04", leadName: "Tom Brannigan", address: "45 Ecclesall Road, Sheffield, S11 8PX", phone: "07700 900404", representativeName: "Matt Gavin", appointmentAt: "2026-08-14T10:00:00" },
  { id: "om-05", leadName: "Amara Okafor", address: "3 Oxford Road, Manchester, M1 5QA", phone: "07700 900405", representativeName: "Damon Clarke", appointmentAt: "2026-08-14T15:00:00" },
  { id: "om-06", leadName: "Craig Beaumont", address: "67 Chequer Road, Doncaster, DN1 2AY", phone: "07700 900406", representativeName: "Joe Preston", appointmentAt: "2026-08-16T09:00:00" },
  { id: "om-07", leadName: "Freya Nicholson", address: "19 Woodhouse Lane, Leeds, LS11 9PX", phone: "07700 900407", representativeName: "Lucy Starkey", appointmentAt: "2026-08-18T13:00:00" },
  { id: "om-08", leadName: "Imran Qureshi", address: "5 Rooley Lane, Bradford, BD8 0JR", phone: "07700 900408", representativeName: "Matt Gavin", appointmentAt: "2026-08-20T11:30:00" },
  { id: "om-09", leadName: "Holly Sutcliffe", address: "31 Halifax Road, Huddersfield, HD3 3AL", phone: "07700 900409", representativeName: "Damon Clarke", appointmentAt: "2026-08-23T10:00:00" },
  { id: "om-10", leadName: "Dean Ashworth", address: "12 Bankfoot Lane, Barnsley, S71 2PT", phone: "07700 900410", representativeName: "Joe Preston", appointmentAt: "2026-08-09T09:00:00" },
];
