import { getAllCancelledAppointments } from "@/data/cancelled-appointments-service";
import { getActivityActors } from "@/data/activities-service";
import { RecentlyCancelledTable } from "@/components/appointments/RecentlyCancelledTable";

export default async function RecentlyCancelledPage() {
  const [appointments, reps] = await Promise.all([
    getAllCancelledAppointments(),
    getActivityActors(),
  ]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h2 className="text-2xl font-semibold text-slate-900">Recently cancelled</h2>
      <RecentlyCancelledTable appointments={appointments} reps={reps} />
    </div>
  );
}
