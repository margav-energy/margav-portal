"use client";

import { useRef, useState, useTransition } from "react";
import { Wrench } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { getInitials } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { INSTALL_ACCEPTANCE_STATUS_STYLES } from "@/lib/status-colors";
import {
  assignInstallerToJobAction,
  getAssignableInstallersForDateAction,
  unassignInstallerFromJobAction,
} from "@/app/appointments/installer-availability/actions";
import type { InstallAcceptanceStatus } from "@/types/installer-availability";

interface InstallerOption {
  id: string;
  fullName: string;
}

/**
 * Read-plus-assign summary of `quotes.installer_id`/`install_date` right on
 * the quote. Date-first by design: pick a day, then only choose from
 * installers who actually marked themselves available that day (and aren't
 * already booked elsewhere) — mirrors how the admin's Installer Availability
 * grid works (you click a day *on that installer's row*), instead of the
 * old free-typed date that `assignInstallerToJobAction` would just reject.
 */
export function InstallerAssignmentCard({
  quoteId,
  customerName,
  installerName,
  installDate,
  acceptanceStatus,
  todayISO,
  onAssigned,
  onUnassigned,
}: {
  quoteId: string;
  customerName: string;
  installerName?: string;
  installDate?: string;
  acceptanceStatus?: InstallAcceptanceStatus;
  todayISO: string;
  onAssigned: (installerName: string, installDate: string) => void;
  onUnassigned: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState("");
  const [availableInstallers, setAvailableInstallers] = useState<InstallerOption[] | null>(null);
  const [isLoadingInstallers, setIsLoadingInstallers] = useState(false);
  const [selectedInstallerId, setSelectedInstallerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Guards against an earlier date's fetch resolving after a later one, if
  // the user changes the date again before the first request finishes.
  const latestRequestedDate = useRef<string | null>(null);

  function handleDateChange(nextDate: string) {
    setSelectedDate(nextDate);
    setSelectedInstallerId("");
    latestRequestedDate.current = nextDate;

    if (!nextDate) {
      setAvailableInstallers(null);
      return;
    }

    setIsLoadingInstallers(true);
    getAssignableInstallersForDateAction(nextDate).then((installers) => {
      if (latestRequestedDate.current !== nextDate) return;
      setAvailableInstallers(installers);
      setSelectedInstallerId(installers[0]?.id ?? "");
      setIsLoadingInstallers(false);
    });
  }

  function handleAssign() {
    const installer = availableInstallers?.find((candidate) => candidate.id === selectedInstallerId);
    if (!installer || !selectedDate) return;
    setError(null);
    startTransition(async () => {
      const result = await assignInstallerToJobAction(quoteId, installer.id, selectedDate, customerName);
      if (result.error) setError(result.error);
      else onAssigned(installer.fullName, selectedDate);
    });
  }

  function handleUnassign() {
    setError(null);
    startTransition(async () => {
      const result = await unassignInstallerFromJobAction(quoteId);
      if (result.error) setError(result.error);
      else onUnassigned();
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
        <Wrench className="h-4 w-4 text-slate-400" />
        Installation
      </h3>

      {installerName && installDate ? (
        <>
          <div className="flex items-center gap-2.5">
            <InitialsAvatar
              name={installerName}
              initials={getInitials(installerName) || installerName[0]?.toUpperCase() || "?"}
              className="h-9 w-9 text-xs"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{installerName}</p>
              <p className="text-xs text-slate-500">Booked for {formatDate(installDate)}</p>
            </div>
          </div>
          {acceptanceStatus && (
            <Pill
              label={INSTALL_ACCEPTANCE_STATUS_STYLES[acceptanceStatus].label}
              className={INSTALL_ACCEPTANCE_STATUS_STYLES[acceptanceStatus].className}
            />
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button variant="secondary" disabled={isPending} onClick={handleUnassign}>
            {isPending ? "Unassigning…" : "Unassign"}
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
              Install date
              <input
                type="date"
                value={selectedDate}
                min={todayISO}
                onChange={(event) => handleDateChange(event.target.value)}
                disabled={isPending}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>

            {selectedDate &&
              (isLoadingInstallers ? (
                <p className="text-sm text-slate-400">Checking who&rsquo;s available…</p>
              ) : availableInstallers && availableInstallers.length === 0 ? (
                <p className="text-sm text-amber-600">No installer is available on this date.</p>
              ) : (
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
                  Installer
                  <select
                    value={selectedInstallerId}
                    onChange={(event) => setSelectedInstallerId(event.target.value)}
                    disabled={isPending}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {availableInstallers?.map((installer) => (
                      <option key={installer.id} value={installer.id}>
                        {installer.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button disabled={isPending || !selectedInstallerId} onClick={handleAssign}>
            {isPending ? "Assigning…" : "Assign installer"}
          </Button>
        </>
      )}
    </Card>
  );
}
