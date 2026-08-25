import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAllProfiles } from "@/data/profiles-service";
import { addDays, parseISODate, toISODate } from "@/lib/date-utils";
import type {
  AssignedJobSummary,
  InstallAcceptanceStatus,
  InstallerAvailabilityDay,
  InstallerAvailabilityRow,
  InstallerAvailabilityStatus,
} from "@/types/installer-availability";

/**
 * Data-access layer for the self-reported installer day-availability
 * calendar (`installer_availability`, see supabase/migrations/0014_*.sql)
 * and the jobs booked on top of it (`quotes.installer_id`/`install_date`,
 * see supabase/migrations/0015_*.sql). Backs both the installer's own "My
 * Availability" page and the admin's "Installer Availability" grid used to
 * assign jobs.
 */

interface AvailabilityDbRow {
  installer_id: string;
  date: string;
  status: InstallerAvailabilityStatus;
  note: string | null;
}

interface AssignedJobDbRow {
  id: string;
  installer_id: string;
  install_date: string;
  customer_name: string;
  product_type: "solar" | "boiler";
  reference: string | null;
  postcode: string;
  install_acceptance_status: InstallAcceptanceStatus | null;
}

/**
 * Fills every calendar date in [startDate, endDate] (inclusive) with a day
 * entry, using `status: null` for dates with no row. "No row" is itself
 * meaningful (the installer hasn't told us yet) so callers should never see
 * a sparse array — they'd have to re-derive the same gaps themselves.
 */
function densify(
  startDate: string,
  endDate: string,
  rows: Pick<AvailabilityDbRow, "date" | "status" | "note">[],
  assignedJobsByDate: Map<string, AssignedJobSummary>,
): InstallerAvailabilityDay[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const days: InstallerAvailabilityDay[] = [];

  let cursor = parseISODate(startDate);
  const end = parseISODate(endDate);
  while (cursor <= end) {
    const iso = toISODate(cursor);
    const row = byDate.get(iso);
    days.push({
      date: iso,
      status: row?.status ?? null,
      note: row?.note ?? null,
      assignedJob: assignedJobsByDate.get(iso) ?? null,
    });
    cursor = addDays(cursor, 1);
  }

  return days;
}

/**
 * Jobs booked to any of `installerIds` on a date within [startDate, endDate],
 * grouped by installer then by date — one query for however many installers
 * the admin grid is showing.
 */
async function getAssignedJobsByInstaller(
  installerIds: string[],
  startDate: string,
  endDate: string,
): Promise<Map<string, Map<string, AssignedJobSummary>>> {
  const byInstaller = new Map<string, Map<string, AssignedJobSummary>>();
  if (installerIds.length === 0) return byInstaller;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("id, installer_id, install_date, customer_name, product_type, reference, postcode, install_acceptance_status")
    .in("installer_id", installerIds)
    .gte("install_date", startDate)
    .lte("install_date", endDate);

  if (error) {
    console.error("getAssignedJobsByInstaller failed", error);
    return byInstaller;
  }

  for (const row of (data ?? []) as AssignedJobDbRow[]) {
    const summary: AssignedJobSummary = {
      quoteId: row.id,
      customerName: row.customer_name,
      productType: row.product_type,
      reference: row.reference,
      postcode: row.postcode,
      acceptanceStatus: row.install_acceptance_status,
    };
    let byDate = byInstaller.get(row.installer_id);
    if (!byDate) {
      byDate = new Map();
      byInstaller.set(row.installer_id, byDate);
    }
    byDate.set(row.install_date, summary);
  }

  return byInstaller;
}

export async function getInstallers(): Promise<{ id: string; fullName: string; initials: string }[]> {
  const profiles = await getAllProfiles();
  return profiles
    .filter((profile) => profile.role === "installer")
    .map(({ id, fullName, initials }) => ({ id, fullName, initials }));
}

/** One installer's availability across [startDate, endDate], densified,
 *  with any jobs booked to them in that range attached per day. */
export async function getInstallerAvailability(
  installerId: string,
  startDate: string,
  endDate: string,
): Promise<InstallerAvailabilityDay[]> {
  const supabase = await createClient();
  const [{ data, error }, assignedJobs] = await Promise.all([
    supabase
      .from("installer_availability")
      .select("date, status, note")
      .eq("installer_id", installerId)
      .gte("date", startDate)
      .lte("date", endDate),
    getAssignedJobsByInstaller([installerId], startDate, endDate),
  ]);

  if (error) {
    console.error("getInstallerAvailability failed", error);
    return densify(startDate, endDate, [], assignedJobs.get(installerId) ?? new Map());
  }

  return densify(
    startDate,
    endDate,
    (data ?? []) as AvailabilityDbRow[],
    assignedJobs.get(installerId) ?? new Map(),
  );
}

/**
 * Every installer's availability across [startDate, endDate] — the admin
 * grid's data source. One query across all installers, grouped and
 * densified per installer so every row lines up positionally against the
 * same date headers the page computes once. Booked jobs are merged in the
 * same way — a booked day takes visual priority over the raw status
 * wherever the grid renders it (see InstallerAvailabilityGrid).
 */
export async function getAllInstallersAvailability(
  startDate: string,
  endDate: string,
): Promise<InstallerAvailabilityRow[]> {
  const installers = await getInstallers();
  if (installers.length === 0) return [];

  const installerIds = installers.map((installer) => installer.id);
  const supabase = await createClient();
  const [{ data, error }, assignedJobsByInstaller] = await Promise.all([
    supabase
      .from("installer_availability")
      .select("installer_id, date, status, note")
      .in("installer_id", installerIds)
      .gte("date", startDate)
      .lte("date", endDate),
    getAssignedJobsByInstaller(installerIds, startDate, endDate),
  ]);

  if (error) {
    console.error("getAllInstallersAvailability failed", error);
  }

  const rows = (data ?? []) as AvailabilityDbRow[];
  const byInstaller = new Map<string, AvailabilityDbRow[]>();
  for (const row of rows) {
    const existing = byInstaller.get(row.installer_id);
    if (existing) existing.push(row);
    else byInstaller.set(row.installer_id, [row]);
  }

  return installers.map((installer) => ({
    installerId: installer.id,
    installerName: installer.fullName,
    installerInitials: installer.initials,
    days: densify(
      startDate,
      endDate,
      byInstaller.get(installer.id) ?? [],
      assignedJobsByInstaller.get(installer.id) ?? new Map(),
    ),
  }));
}
