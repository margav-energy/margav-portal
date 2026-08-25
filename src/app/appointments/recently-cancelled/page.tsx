import { getAllCancelledAppointments } from "@/data/cancelled-appointments-service";
import { getAllProfiles } from "@/data/profiles-service";
import { requireStaffUser } from "@/data/current-user";
import { RecentlyCancelledTable } from "@/components/appointments/RecentlyCancelledTable";

export default async function RecentlyCancelledPage() {
  await requireStaffUser();

  const [appointments, profiles] = await Promise.all([
    getAllCancelledAppointments(),
    getAllProfiles(),
  ]);
  const reps = profiles.map((profile) => profile.fullName);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h2 className="text-2xl font-semibold text-slate-900">Recently cancelled</h2>
      <RecentlyCancelledTable appointments={appointments} reps={reps} />
    </div>
  );
}
