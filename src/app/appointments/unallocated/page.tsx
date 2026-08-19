import { getAllUnallocatedLeads } from "@/data/unallocated-leads-service";
import { getAllProfiles } from "@/data/profiles-service";
import { LeadTable } from "@/components/appointments/LeadTable";

export default async function UnallocatedPage() {
  const [leads, reps] = await Promise.all([getAllUnallocatedLeads(), getAllProfiles()]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h2 className="text-2xl font-semibold text-slate-900">Unallocated</h2>
      <LeadTable leads={leads} reps={reps} />
    </div>
  );
}
