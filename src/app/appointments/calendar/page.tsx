import { getAllCalendarAppointments } from "@/data/calendar-appointments-service";
import { getActivityActors } from "@/data/activities-service";
import { CalendarView } from "@/components/calendar/CalendarView";

export default async function CalendarPage() {
  const [appointments, reps] = await Promise.all([
    getAllCalendarAppointments(),
    getActivityActors(),
  ]);

  return <CalendarView appointments={appointments} reps={reps} />;
}
