import { ActivityAvatar } from "@/components/activity/ActivityAvatar";
import { ActivityStatusPill } from "@/components/ui/ActivityStatusPill";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Activity } from "@/types/activity";

export function ActivityRow({
  activity,
  dotColorClassName,
}: {
  activity: Activity;
  dotColorClassName: string;
}) {
  return (
    <div className="relative flex flex-col gap-3 py-4 pr-5 pl-12 hover:bg-slate-50 sm:flex-row sm:items-start">
      {/* Timeline gutter: a continuous line (each row draws its own full-height
          segment; adjacent rows have no gap, so the segments read as one line)
          plus a dot marking this entry. */}
      <span
        aria-hidden="true"
        className="absolute top-0 bottom-0 left-[27px] w-px bg-slate-200"
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-6 left-[23px] h-2.5 w-2.5 rounded-full ring-4 ring-white",
          dotColorClassName,
        )}
      />

      <div className="flex flex-1 gap-3">
        <ActivityAvatar
          actorName={activity.actorName}
          initials={activity.actorInitials}
          isSystem={activity.isSystem}
        />
        <div className="min-w-0">
          <p className="text-sm text-slate-900">
            <span className="font-semibold">{activity.actorName}</span>{" "}
            <span className="text-slate-500">updated</span>{" "}
            <span className="font-semibold">{activity.customerName}</span>
          </p>
          <p className="mt-1 text-sm whitespace-pre-line text-slate-600">
            {activity.description}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 pl-[52px] sm:w-[420px] sm:shrink-0 sm:pl-0 sm:text-right">
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Status
          </p>
          <div className="mt-1 sm:flex sm:justify-end">
            <ActivityStatusPill status={activity.status} />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Customer
          </p>
          <p className="mt-1 truncate text-sm font-medium text-slate-700">
            {activity.customerName}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Time
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateTime(activity.timestamp)}
          </p>
        </div>
      </div>
    </div>
  );
}
