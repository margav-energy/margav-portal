"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/data/current-user";
import { getAllProfiles, getProfileById } from "@/data/profiles-service";
import { logActivity } from "@/lib/activity";
import { notifyUser } from "@/lib/notify";
import { formatDate } from "@/lib/format";
import { toISODate } from "@/lib/date-utils";

export interface AssignInstallerResult {
  error?: string;
}

/**
 * Installers who actually marked themselves available on `date` and don't
 * already have a job booked that day — backs the date-first picker on
 * InstallerAssignmentCard (pick a day, then only see who you could actually
 * book), so the UI can't offer a choice `assignInstallerToJobAction` would
 * just reject anyway.
 */
export async function getAssignableInstallersForDateAction(
  date: string,
): Promise<{ id: string; fullName: string }[]> {
  const user = await getCurrentUser();
  if (!user || user.role === "installer") return [];

  const supabase = await createClient();
  const [{ data: availableRows, error: availableError }, { data: bookedRows, error: bookedError }] =
    await Promise.all([
      supabase.from("installer_availability").select("installer_id").eq("date", date).eq("status", "available"),
      supabase.from("quotes").select("installer_id").eq("install_date", date).not("installer_id", "is", null),
    ]);

  if (availableError) console.error("getAssignableInstallersForDateAction: availability query failed", availableError);
  if (bookedError) console.error("getAssignableInstallersForDateAction: booked query failed", bookedError);

  const bookedIds = new Set((bookedRows ?? []).map((row) => row.installer_id as string));
  const availableIds = new Set(
    (availableRows ?? []).map((row) => row.installer_id as string).filter((id) => !bookedIds.has(id)),
  );
  if (availableIds.size === 0) return [];

  const profiles = await getAllProfiles();
  return profiles
    .filter((profile) => profile.role === "installer" && availableIds.has(profile.id))
    .map(({ id, fullName }) => ({ id, fullName }));
}

/**
 * Books a signed job to an installer on a specific day — the action behind
 * clicking an "available" cell on the Installer Availability grid, picking
 * a job in AssignJobModal, and (src/components/quotes/detail/InstallerAssignmentCard.tsx)
 * the installer+date picker on the quote itself. Mirrors the existing
 * `assignQuoteRepresentative` pattern (src/components/quotes/actions.ts):
 * update -> activity log + notify -> revalidate. Open to reps as well as
 * admins, same as assigning a rep to a quote — the Installer Availability
 * grid page itself stays admin-only (it's a cross-installer scheduling
 * tool), but booking a specific job you're already looking at doesn't need
 * that restriction.
 */
export async function assignInstallerToJobAction(
  quoteId: string,
  installerId: string,
  installDate: string,
  customerName: string,
): Promise<AssignInstallerResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role === "installer") return { error: "Only admins and reps can assign installers to jobs." };

  const installer = await getProfileById(installerId);
  if (!installer) return { error: "Installer not found." };
  if (installer.role !== "installer") return { error: "That teammate isn't an installer." };

  if (installDate < toISODate(new Date())) {
    return { error: "Can't book a job on a date that has already passed." };
  }

  const supabase = await createClient();

  // The admin grid only ever offers this action on a cell the installer
  // marked "available" — but that's a UI-only constraint, and this action
  // is also reachable from a plain installer+date picker on the quote
  // itself (src/components/quotes/detail/InstallerAssignmentCard.tsx),
  // which has no such restriction. Enforce it here so it can't be bypassed
  // from either caller.
  const { data: availabilityRow, error: availabilityError } = await supabase
    .from("installer_availability")
    .select("status")
    .eq("installer_id", installerId)
    .eq("date", installDate)
    .maybeSingle();

  if (availabilityError) {
    console.error("assignInstallerToJobAction: availability check failed", availabilityError);
    return { error: "Could not assign this job. Please try again." };
  }
  if (availabilityRow?.status !== "available") {
    const dateLabel = formatDate(installDate);
    return {
      error:
        availabilityRow?.status === "unavailable"
          ? `${installer.fullName} isn't available on ${dateLabel}.`
          : `${installer.fullName} hasn't confirmed they're available on ${dateLabel} yet.`,
    };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("quotes")
    .select("install_status")
    .eq("id", quoteId)
    .single();

  if (fetchError || !existing) {
    console.error("assignInstallerToJobAction: quote not found", fetchError);
    return { error: "Job not found." };
  }

  // One job per installer per day: without this, a second job booked to the
  // same installer/date would silently overwrite the first in every view
  // that groups assigned jobs by date (see getAssignedJobsByInstaller).
  const { data: conflict, error: conflictError } = await supabase
    .from("quotes")
    .select("id")
    .eq("installer_id", installerId)
    .eq("install_date", installDate)
    .neq("id", quoteId)
    .maybeSingle();

  if (conflictError) {
    console.error("assignInstallerToJobAction: conflict check failed", conflictError);
    return { error: "Could not assign this job. Please try again." };
  }
  if (conflict) {
    return { error: `${installer.fullName} already has a job booked on ${formatDate(installDate)}.` };
  }

  const { error } = await supabase
    .from("quotes")
    .update({
      installer_id: installerId,
      install_date: installDate,
      // Nothing else in the app sets install_status yet (see
      // supabase/migrations/0015_*.sql) — assigning is what kicks the
      // install lifecycle off, but only if it hasn't started already.
      install_status: existing.install_status ?? "awaiting_scaffold",
      // Fresh assignment, fresh answer — never inherit an accept/reject a
      // previous installer gave for this job (see src/app/jobs/actions.ts).
      install_acceptance_status: "pending",
    })
    .eq("id", quoteId);

  if (error) {
    console.error("assignInstallerToJobAction failed", error);
    return { error: "Could not assign this job. Please try again." };
  }

  const dateLabel = formatDate(installDate);
  await Promise.all([
    logActivity({
      actorId: user.id,
      customerName,
      description: `${installer.fullName} was booked to install ${customerName}'s job on ${dateLabel}`,
      status: "allocated",
      entityType: "quote_installer_assignment",
      entityId: quoteId,
    }),
    notifyUser({
      userId: installerId,
      title: "New job booked in",
      body: `You've been booked to install ${customerName}'s job on ${dateLabel}. Log in to Margav Portal to view it.`,
    }),
  ]);

  revalidatePath("/appointments/installer-availability");
  revalidatePath("/availability");
  revalidatePath("/jobs");
  return {};
}

/** Frees up a booked day — clears the assignment so the job goes back into
 *  the unassigned-jobs list and the day cell reverts to its plain status. */
export async function unassignInstallerFromJobAction(quoteId: string): Promise<AssignInstallerResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role === "installer") return { error: "Only admins and reps can unassign installers from jobs." };

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("quotes")
    .select("customer_name, installer_id")
    .eq("id", quoteId)
    .single();

  if (fetchError || !existing) {
    console.error("unassignInstallerFromJobAction: quote not found", fetchError);
    return { error: "Job not found." };
  }

  const { error } = await supabase
    .from("quotes")
    .update({ installer_id: null, install_date: null, install_acceptance_status: null })
    .eq("id", quoteId);

  if (error) {
    console.error("unassignInstallerFromJobAction failed", error);
    return { error: "Could not unassign this job. Please try again." };
  }

  await logActivity({
    actorId: user.id,
    customerName: existing.customer_name,
    description: `Installer unassigned from ${existing.customer_name}'s job`,
    status: "unallocated",
    entityType: "quote_installer_assignment",
    entityId: quoteId,
  });

  if (existing.installer_id) {
    await notifyUser({
      userId: existing.installer_id,
      title: "Job unassigned",
      body: `You're no longer booked for ${existing.customer_name}'s job.`,
    });
  }

  revalidatePath("/appointments/installer-availability");
  revalidatePath("/availability");
  revalidatePath("/jobs");
  return {};
}
