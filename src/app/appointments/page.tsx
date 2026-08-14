import { redirect } from "next/navigation";

// The Appointments module is now fully built out into its sub-views; land
// visitors of the bare route on the calendar rather than a dead end.
export default function AppointmentsPage() {
  redirect("/appointments/calendar");
}
