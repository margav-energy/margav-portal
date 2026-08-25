import { getAllOutcomeMissingLeads } from "@/data/outcome-missing-service";
import { getAllProfiles } from "@/data/profiles-service";
import { requireStaffUser } from "@/data/current-user";
import { OutcomeMissingTable } from "@/components/appointments/OutcomeMissingTable";

export default async function OutcomeMissingPage() {
  await requireStaffUser();

  const [leads, profiles] = await Promise.all([getAllOutcomeMissingLeads(), getAllProfiles()]);
  const reps = profiles.map((profile) => profile.fullName);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h2 className="text-2xl font-semibold text-slate-900">Outcome Missing</h2>
      <OutcomeMissingTable leads={leads} reps={reps} />
    </div>
  );
}
