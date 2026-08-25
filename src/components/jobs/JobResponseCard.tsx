"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { INSTALL_ACCEPTANCE_STATUS_STYLES } from "@/lib/status-colors";
import { formatDate } from "@/lib/format";
import { acceptInstallJobAction, rejectInstallJobAction } from "@/app/jobs/actions";
import type { InstallAcceptanceStatus } from "@/types/installer-availability";

/** Product/date/reference header plus accept/reject — the top of a job's
 *  detail page. Equipment and survey live in their own cards alongside it
 *  (see InstallerEquipmentCard, BoilerSurveyCard). */
export function JobResponseCard({
  quoteId,
  installDate,
  acceptanceStatus,
  productLabel,
  reference,
}: {
  quoteId: string;
  installDate: string;
  acceptanceStatus: InstallAcceptanceStatus | null;
  productLabel: string;
  reference: string | null;
}) {
  const [status, setStatus] = useState(acceptanceStatus);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRespond(next: "accepted" | "rejected") {
    setError(null);
    startTransition(async () => {
      const action = next === "accepted" ? acceptInstallJobAction : rejectInstallJobAction;
      const result = await action(quoteId);
      if (result.error) setError(result.error);
      else setStatus(next);
    });
  }

  const statusStyle = status ? INSTALL_ACCEPTANCE_STATUS_STYLES[status] : null;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pill label={productLabel} className="bg-slate-100 text-slate-600" />
          {reference && <span className="text-xs text-slate-400">{reference}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-brand-blue">{formatDate(installDate)}</span>
          {statusStyle && <Pill label={statusStyle.label} className={statusStyle.className} />}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {status === "pending" && (
        <div className="flex gap-2">
          <Button variant="success" disabled={isPending} onClick={() => handleRespond("accepted")} className="gap-1.5">
            <Check className="h-4 w-4" />
            Accept
          </Button>
          <Button variant="danger" disabled={isPending} onClick={() => handleRespond("rejected")} className="gap-1.5">
            <X className="h-4 w-4" />
            Reject
          </Button>
        </div>
      )}
    </Card>
  );
}
