import { getAllCalendarAppointments } from "@/data/calendar-appointments-service";
import { getAllProfiles } from "@/data/profiles-service";
import { getCurrentUser } from "@/data/current-user";
import { getSavedCalendarViews } from "@/data/appointments-service";
import { CalendarView } from "@/components/calendar/CalendarView";

export default async function CalendarPage() {
  const [appointments, profiles, user] = await Promise.all([
    getAllCalendarAppointments(),
    getAllProfiles(),
    getCurrentUser(),
  ]);

  const reps = profiles.map((profile) => profile.fullName);
  const savedViews = user ? await getSavedCalendarViews(user.id) : [];
  const favourites = savedViews.map((view) => ({
    id: view.id,
    name: view.name,
    stages: view.filters.stages ?? [],
    reps: view.filters.reps ?? [],
  }));

  return <CalendarView appointments={appointments} reps={reps} initialFavourites={favourites} />;
}
