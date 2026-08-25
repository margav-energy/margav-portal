import { getAllReadyToConfirmLeads } from "@/data/ready-to-confirm-service";
import { requireStaffUser } from "@/data/current-user";
import { ReadyToConfirmTable } from "@/components/appointments/ReadyToConfirmTable";

export default async function ReadyToConfirmPage() {
  await requireStaffUser();

  const leads = await getAllReadyToConfirmLeads();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h2 className="text-2xl font-semibold text-slate-900">Leads Ready to Confirm</h2>
      <ReadyToConfirmTable leads={leads} />
    </div>
  );
}
