import { getAllAllocatedAppointments } from "@/data/allocated-appointments-service";
import { getAllProfiles } from "@/data/profiles-service";
import { AllocatedNotAcceptedTable } from "@/components/appointments/AllocatedNotAcceptedTable";

export default async function AllocatedNotAcceptedPage() {
  const [appointments, profiles] = await Promise.all([
    getAllAllocatedAppointments(),
    getAllProfiles(),
  ]);
  const reps = profiles.map((profile) => profile.fullName);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Allocated, not accepted</h2>
        <p className="mt-1 text-sm text-slate-500">
          Below are appointments allocated to a representative who hasn&rsquo;t
          accepted them via the acceptance form yet.
        </p>
      </div>
      <AllocatedNotAcceptedTable appointments={appointments} reps={reps} />
    </div>
  );
}
