import { getPublicChecklist } from "@/data/solar-install-checklist-service";
import { PublicChecklist } from "@/app/checklist/[token]/PublicChecklist";

/** The install photo checklist opened from the office's share link - no portal login, authorised by the unguessable token (like `/survey/[token]`). */
export default async function PublicChecklistPage({ params }: PageProps<"/checklist/[token]">) {
  const { token } = await params;
  const data = await getPublicChecklist(token);

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 p-6 text-center">
        <p className="text-lg font-semibold text-slate-900">This checklist link isn&apos;t valid</p>
        <p className="max-w-sm text-sm text-slate-500">It may have been copied incorrectly. Ask the office to resend the checklist link.</p>
      </div>
    );
  }

  return <PublicChecklist token={token} customerName={data.customerName} address={data.address} initial={data.checklist} />;
}
