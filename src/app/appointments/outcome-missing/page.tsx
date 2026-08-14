import { getAllOutcomeMissingLeads } from "@/data/outcome-missing-service";
import { getActivityActors } from "@/data/activities-service";
import { OutcomeMissingTable } from "@/components/appointments/OutcomeMissingTable";

export default async function OutcomeMissingPage() {
  const [leads, reps] = await Promise.all([getAllOutcomeMissingLeads(), getActivityActors()]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h2 className="text-2xl font-semibold text-slate-900">Outcome Missing</h2>
      <OutcomeMissingTable leads={leads} reps={reps} />
    </div>
  );
}
