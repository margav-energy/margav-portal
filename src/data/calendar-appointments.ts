import type { CalendarAppointment } from "@/types/calendar-appointment";

// Mock appointment bookings spanning three weeks around the portal's current
// narrative date (14 Aug 2026), reusing customer names from src/data/quotes.ts
// and reps from src/data/activities.ts for continuity.
export const calendarAppointments: CalendarAppointment[] = [
  // Week of 3–9 August
  { id: "cal-01", customerName: "David Whitfield", repName: "Damon Clarke", stage: "confirmed", date: "2026-08-03", startTime: "09:00", endTime: "10:00" },
  { id: "cal-02", customerName: "Priya Anand", repName: "Joe Preston", stage: "sold", date: "2026-08-03", startTime: "14:00", endTime: "15:00" },
  { id: "cal-03", customerName: "Michael O'Rourke", repName: "Lucy Starkey", stage: "booked", date: "2026-08-04", startTime: "11:00", endTime: "12:00" },
  { id: "cal-04", customerName: "Sian Hargreaves", repName: "Matt Gavin", stage: "not_pitched", date: "2026-08-05", startTime: "16:00", endTime: "17:00" },
  { id: "cal-05", customerName: "Tom Brannigan", repName: "Damon Clarke", stage: "pitch_and_miss", date: "2026-08-06", startTime: "10:00", endTime: "11:00" },
  { id: "cal-06", customerName: "Amara Okafor", repName: "Unallocated", stage: "allocated", date: "2026-08-07", startTime: "13:00", endTime: "14:00" },
  { id: "cal-07", customerName: "Craig Beaumont", repName: "Joe Preston", stage: "confirmed", date: "2026-08-08", startTime: "09:00", endTime: "10:00" },

  // Week of 10–16 August (current week)
  { id: "cal-08", customerName: "Freya Nicholson", repName: "Damon Clarke", stage: "booked", date: "2026-08-10", startTime: "09:00", endTime: "10:00" },
  { id: "cal-09", customerName: "Imran Qureshi", repName: "Lucy Starkey", stage: "confirmed", date: "2026-08-10", startTime: "15:00", endTime: "16:00" },
  { id: "cal-10", customerName: "Holly Sutcliffe", repName: "Matt Gavin", stage: "sold", date: "2026-08-11", startTime: "11:00", endTime: "12:00" },
  { id: "cal-11", customerName: "Dean Ashworth", repName: "Joe Preston", stage: "not_pitched", date: "2026-08-11", startTime: "18:00", endTime: "19:00" },
  { id: "cal-12", customerName: "Nadia Farooq", repName: "Unallocated", stage: "allocated", date: "2026-08-12", startTime: "10:00", endTime: "11:00" },
  { id: "cal-13", customerName: "Lewis Braithwaite", repName: "Damon Clarke", stage: "booked", date: "2026-08-12", startTime: "14:00", endTime: "15:30" },
  { id: "cal-14", customerName: "Charlotte Ingham", repName: "Lucy Starkey", stage: "confirmed", date: "2026-08-13", startTime: "09:00", endTime: "10:00" },
  { id: "cal-15", customerName: "Grace Whitmore", repName: "Matt Gavin", stage: "pitch_and_miss", date: "2026-08-13", startTime: "17:00", endTime: "18:00" },
  { id: "cal-16", customerName: "David Whitfield", repName: "Joe Preston", stage: "sold", date: "2026-08-14", startTime: "10:00", endTime: "11:00" },
  { id: "cal-17", customerName: "Callum Fenwick", repName: "Damon Clarke", stage: "allocated", date: "2026-08-14", startTime: "13:00", endTime: "14:00" },
  { id: "cal-18", customerName: "Priya Anand", repName: "Unallocated", stage: "booked", date: "2026-08-15", startTime: "09:00", endTime: "10:00" },

  // Week of 17–23 August
  { id: "cal-19", customerName: "Michael O'Rourke", repName: "Lucy Starkey", stage: "confirmed", date: "2026-08-17", startTime: "09:00", endTime: "10:00" },
  { id: "cal-20", customerName: "Sian Hargreaves", repName: "Matt Gavin", stage: "sold", date: "2026-08-18", startTime: "14:00", endTime: "15:00" },
  { id: "cal-21", customerName: "Tom Brannigan", repName: "Damon Clarke", stage: "not_pitched", date: "2026-08-19", startTime: "11:00", endTime: "12:00" },
  { id: "cal-22", customerName: "Amara Okafor", repName: "Joe Preston", stage: "booked", date: "2026-08-20", startTime: "16:00", endTime: "17:00" },
  { id: "cal-23", customerName: "Craig Beaumont", repName: "Unallocated", stage: "allocated", date: "2026-08-21", startTime: "10:00", endTime: "11:00" },
];
