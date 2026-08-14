import { HolidayStatusPill } from "@/components/ui/HolidayStatusPill";
import { formatDateRange } from "@/lib/format";
import type { HolidayRequest } from "@/types/holiday";

export function HolidayRow({
  holiday,
  onApprove,
  onReject,
}: {
  holiday: HolidayRequest;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-5 py-4 hover:bg-slate-50 sm:grid-cols-[1.5fr_1.3fr_1.6fr_1fr_1.2fr] sm:items-center">
      <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10 text-xs font-semibold text-brand-blue">
          {holiday.repInitials}
        </div>
        <span className="text-sm font-semibold text-slate-900">{holiday.repName}</span>
      </div>
      <p className="text-sm text-slate-600">{holiday.postcodes.join(", ")}</p>
      <p className="text-sm text-slate-600">
        {formatDateRange(holiday.startDate, holiday.endDate)}
      </p>
      <div>
        <HolidayStatusPill status={holiday.status} />
      </div>
      <div className="col-span-2 flex gap-2 sm:col-span-1 sm:justify-end">
        {holiday.status === "pending" ? (
          <>
            <button
              type="button"
              onClick={onApprove}
              className="rounded-md bg-brand-green-mid/10 px-2.5 py-1.5 text-xs font-semibold text-brand-green-mid hover:bg-brand-green-mid/20"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={onReject}
              className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
            >
              Reject
            </button>
          </>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        )}
      </div>
    </div>
  );
}
