import { getAllRtaLeads } from "@/data/rta-leads-service";
import { RtaDueTable } from "@/components/appointments/RtaDueTable";

export default async function RtaDuePage() {
  const leads = await getAllRtaLeads();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <h2 className="text-2xl font-semibold text-slate-900">RTA due</h2>
      <RtaDueTable leads={leads} />
    </div>
  );
}
