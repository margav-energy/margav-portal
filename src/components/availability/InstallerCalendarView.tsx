"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { CalendarFilterGroup } from "@/components/calendar/CalendarFilterGroup";
import { AssignJobModal } from "@/components/availability/AssignJobModal";
import { UnassignJobModal } from "@/components/availability/UnassignJobModal";
import {
  addDays,
  addMonths,
  formatMonthLabel,
  formatWeekRangeLabel,
  parseISODate,
  toISODate,
} from "@/lib/date-utils";
import { installerColorFor, type RepColor } from "@/lib/rep-colors";
import { cn } from "@/lib/utils";
import type { AssignedJobSummary, InstallerAvailabilityRow } from "@/types/installer-availability";
import type { UnassignedInstallJob } from "@/types/quote";

export type InstallerCalendarViewMode = "month" | "week";

type EntryKind = "booked" | "available" | "unavailable" | "unset";

const KIND_OPTIONS: { value: EntryKind; label: string }[] = [
  { value: "booked", label: "Booked job" },
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Unavailable" },
  { value: "unset", label: "Not entered" },
];

/** Booked first — it's what an admin scans for — then free, then off. */
const KIND_ORDER: Record<EntryKind, number> = { booked: 0, available: 1, unavailable: 2, unset: 3 };

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_VISIBLE_PER_MONTH_DAY = 4;

interface CalendarEntry {
  installerId: string;
  installerName: string;
  date: string;
  color: RepColor;
  kind: EntryKind;
  note: string | null;
  job: AssignedJobSummary | null;
}

function hrefFor(view: InstallerCalendarViewMode, date: Date): string {
  return `/appointments/installer-availability?layout=calendar&view=${view}&date=${toISODate(date)}`;
}

function firstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName;
}

/**
 * One installer's day, coloured by installer so a glance picks out who's
 * who: a solid block for a booked job, a light tint of their colour for a
 * free day, and grey + struck through (keeping just a dot of their colour)
 * for a day off or one they haven't filled in yet.
 */
function EntryChip({
  entry,
  detailed,
  onAssign,
  onUnassign,
}: {
  entry: CalendarEntry;
  detailed: boolean;
  /** Present only for an available day that's today or later — same rule as the Table layout. */
  onAssign?: () => void;
  onUnassign: () => void;
}) {
  const name = detailed ? entry.installerName : firstName(entry.installerName);
  const baseClassName =
    "flex min-w-0 items-center gap-1.5 rounded border px-1.5 py-0.5 text-left text-[11px] font-medium";

  if (entry.kind === "booked" && entry.job) {
    const job = entry.job;
    return (
      <button
        type="button"
        onClick={onUnassign}
        title={`${entry.installerName} · ${job.customerName} (${job.postcode}) — click to view or unassign`}
        style={{ backgroundColor: entry.color.hex, borderColor: entry.color.hex }}
        className={cn(baseClassName, "text-white hover:brightness-95", detailed && "flex-col items-start gap-0 py-1")}
      >
        <span className="w-full truncate font-semibold">{name}</span>
        <span className={cn("w-full truncate", !detailed && "opacity-90")}>
          {detailed ? `${job.customerName} · ${job.postcode}` : job.customerName}
        </span>
        {detailed && job.acceptanceStatus === "pending" && (
          <span className="text-[10px] opacity-80">Awaiting installer acceptance</span>
        )}
      </button>
    );
  }

  const title = `${entry.installerName} — ${
    entry.kind === "available" ? "available" : entry.kind === "unavailable" ? "unavailable" : "not entered yet"
  }${entry.note ? ` (${entry.note})` : ""}`;

  if (entry.kind === "available") {
    const className = cn(baseClassName, detailed && "flex-col items-start gap-0 py-1");
    const content = (
      <>
        <span className="w-full truncate">{name}</span>
        {detailed && entry.note && <span className="w-full truncate text-[10px] opacity-80">{entry.note}</span>}
      </>
    );
    return onAssign ? (
      <button
        type="button"
        onClick={onAssign}
        title={`${title} — click to assign a job`}
        style={entry.color.blockStyle}
        className={cn(className, "cursor-pointer hover:brightness-95")}
      >
        {content}
      </button>
    ) : (
      <span title={title} style={entry.color.blockStyle} className={className}>
        {content}
      </span>
    );
  }

  return (
    <span
      title={title}
      className={cn(
        baseClassName,
        "text-slate-400",
        entry.kind === "unavailable" ? "border-slate-200 bg-slate-100" : "border-dashed border-slate-200 bg-white",
      )}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color.hex }} />
      <span className={cn("truncate", entry.kind === "unavailable" && "line-through")}>{name}</span>
      {detailed && (
        <span className="ml-auto shrink-0 text-[10px]">{entry.kind === "unavailable" ? "Off" : "—"}</span>
      )}
    </span>
  );
}

/**
 * The "Calendar" layout of the admin Installer Availability page (see
 * src/app/appointments/installer-availability/page.tsx) — the same data as
 * the Table layout (InstallerAvailabilityGrid), arranged as a month/week
 * calendar and colour-coded per installer, with the same assign/unassign
 * clicks. Navigation (prev/next, month/week) is plain links the server
 * re-renders for; installer/status filtering is client-side over what's
 * already loaded.
 */
export function InstallerCalendarView({
  view,
  anchorISO,
  dayISOs,
  todayISO,
  rows,
  unassignedJobs,
}: {
  view: InstallerCalendarViewMode;
  anchorISO: string;
  dayISOs: string[];
  todayISO: string;
  rows: InstallerAvailabilityRow[];
  unassignedJobs: UnassignedInstallJob[];
}) {
  const anchor = parseISODate(anchorISO);
  const [assignTarget, setAssignTarget] = useState<CalendarEntry | null>(null);
  const [unassignTarget, setUnassignTarget] = useState<CalendarEntry | null>(null);

  const colorsById = useMemo(
    () => new Map(rows.map((row) => [row.installerId, installerColorFor(row.installerName, row.calendarColor)])),
    [rows],
  );

  const installerOptions = useMemo(
    () =>
      rows.map((row) => ({
        value: row.installerId,
        label: row.installerName,
        dotColor: colorsById.get(row.installerId)?.hex,
      })),
    [rows, colorsById],
  );

  const [selectedInstallers, setSelectedInstallers] = useState<string[]>(() => rows.map((row) => row.installerId));
  const [selectedKinds, setSelectedKinds] = useState<string[]>(["booked", "available", "unavailable"]);

  const entriesByDate = useMemo(() => {
    const byDate = new Map<string, CalendarEntry[]>();
    for (const row of rows) {
      if (!selectedInstallers.includes(row.installerId)) continue;
      const color = installerColorFor(row.installerName, row.calendarColor);
      for (const day of row.days) {
        const kind: EntryKind = day.assignedJob ? "booked" : (day.status ?? "unset");
        if (!selectedKinds.includes(kind)) continue;
        const entry: CalendarEntry = {
          installerId: row.installerId,
          installerName: row.installerName,
          date: day.date,
          color,
          kind,
          note: day.note,
          job: day.assignedJob,
        };
        const existing = byDate.get(day.date);
        if (existing) existing.push(entry);
        else byDate.set(day.date, [entry]);
      }
    }
    for (const entries of byDate.values()) {
      entries.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.installerName.localeCompare(b.installerName));
    }
    return byDate;
  }, [rows, selectedInstallers, selectedKinds]);

  const availableTodayCount = rows.filter((row) =>
    row.days.some((day) => day.date === todayISO && day.status === "available" && !day.assignedJob),
  ).length;
  const todayInRange = dayISOs.includes(todayISO);

  const rangeLabel =
    view === "month"
      ? formatMonthLabel(anchor)
      : formatWeekRangeLabel(parseISODate(dayISOs[0]), parseISODate(dayISOs[dayISOs.length - 1]));
  const prevDate = view === "month" ? addMonths(anchor, -1) : addDays(anchor, -7);
  const nextDate = view === "month" ? addMonths(anchor, 1) : addDays(anchor, 7);

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <Link
            href={hrefFor(view, prevDate)}
            aria-label="Previous"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link
            href={hrefFor(view, parseISODate(todayISO))}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            Today
          </Link>
          <Link
            href={hrefFor(view, nextDate)}
            aria-label="Next"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(["month", "week"] as const).map((mode) => (
            <Link
              key={mode}
              href={hrefFor(mode, anchor)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors",
                view === mode ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              {mode}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3">
        <span className="text-sm font-semibold text-brand-blue">{rangeLabel}</span>
        {todayInRange && rows.length > 0 && (
          <span className="ml-auto rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-semibold text-brand-blue">
            {availableTodayCount} of {rows.length} available today
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <Card className="p-6 text-sm text-slate-500">
          No installer accounts yet — availability will show here once installers start filling theirs in.
        </Card>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <Card className="flex shrink-0 flex-col gap-6 p-5 lg:w-60">
            <CalendarFilterGroup
              title="Installer"
              options={installerOptions}
              selected={selectedInstallers}
              onChange={setSelectedInstallers}
            />
            <CalendarFilterGroup
              title="Show"
              options={KIND_OPTIONS}
              selected={selectedKinds}
              onChange={setSelectedKinds}
            />
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <h3 className="text-sm font-semibold text-slate-900">Key</h3>
              <span className="flex items-center gap-2">
                <span className="h-3 w-5 rounded-sm bg-slate-600" /> Booked job (solid)
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-5 rounded-sm border border-slate-400/50 bg-slate-400/15" /> Available (tint)
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-5 rounded-sm border border-slate-200 bg-slate-100" />
                <span className="line-through">Unavailable</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-5 rounded-sm border border-dashed border-slate-300 bg-white" /> Not entered
              </span>
              <p className="text-slate-400">Colours can be changed per installer in Settings → Team Members.</p>
            </div>
          </Card>

          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="min-w-[640px] overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="grid grid-cols-7 border-b border-slate-200">
                {dayISOs.slice(0, 7).map((iso, index) => (
                  <div
                    key={iso}
                    className="border-l border-slate-100 px-3 py-2 text-center text-xs font-semibold tracking-wide text-slate-400 uppercase first:border-l-0"
                  >
                    {WEEKDAY_SHORT[index]}
                    {view === "week" && (
                      <span className={cn("ml-1", iso === todayISO ? "text-brand-blue" : "text-slate-600")}>
                        {parseISODate(iso).getDate()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {dayISOs.map((iso) => {
                  const date = parseISODate(iso);
                  const entries = entriesByDate.get(iso) ?? [];
                  const isOutsideMonth = view === "month" && date.getMonth() !== anchor.getMonth();
                  const isPast = iso < todayISO;
                  const visible = view === "month" ? entries.slice(0, MAX_VISIBLE_PER_MONTH_DAY) : entries;
                  const hiddenCount = entries.length - visible.length;

                  return (
                    <div
                      key={iso}
                      className={cn(
                        "flex flex-col gap-1 border-t border-l border-slate-100 p-2 [&:nth-child(7n+1)]:border-l-0",
                        view === "month" ? "min-h-[120px]" : "min-h-[320px] border-t-0",
                        (isOutsideMonth || isPast) && "bg-slate-50/60",
                        isPast && "opacity-70",
                      )}
                    >
                      {view === "month" && (
                        <Link
                          href={hrefFor("week", date)}
                          title="Open this week"
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold hover:bg-slate-100",
                            iso === todayISO
                              ? "bg-brand-blue text-white hover:bg-brand-blue/90"
                              : isOutsideMonth
                                ? "text-slate-400"
                                : "text-slate-600",
                          )}
                        >
                          {date.getDate()}
                        </Link>
                      )}
                      <div className="flex flex-col gap-0.5">
                        {visible.map((entry) => (
                          <EntryChip
                            key={entry.installerId}
                            entry={entry}
                            detailed={view === "week"}
                            onAssign={entry.kind === "available" && !isPast ? () => setAssignTarget(entry) : undefined}
                            onUnassign={() => setUnassignTarget(entry)}
                          />
                        ))}
                        {hiddenCount > 0 && (
                          <Link href={hrefFor("week", date)} className="text-[11px] text-slate-400 hover:text-brand-blue">
                            +{hiddenCount} more
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {assignTarget && (
        <AssignJobModal
          installerId={assignTarget.installerId}
          installerName={assignTarget.installerName}
          date={assignTarget.date}
          jobs={unassignedJobs}
          onClose={() => setAssignTarget(null)}
        />
      )}

      {unassignTarget?.job && (
        <UnassignJobModal
          quoteId={unassignTarget.job.quoteId}
          installerName={unassignTarget.installerName}
          customerName={unassignTarget.job.customerName}
          date={unassignTarget.date}
          onClose={() => setUnassignTarget(null)}
        />
      )}
    </>
  );
}
