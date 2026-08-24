"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/data/current-user";
import { getProfileById } from "@/data/profiles-service";
import { logActivity } from "@/lib/activity";
import { notifyUser } from "@/lib/notify";
import { formatDate } from "@/lib/format";

export interface AssignInstallerResult {
  error?: string;
}

/**
 * Books a signed job to an installer on a specific day — the action behind
 * clicking an "available" cell on the Installer Availability grid and
 * picking a job in AssignJobModal. Mirrors the existing
 * `assignQuoteRepresentative` pattern (src/components/quotes/actions.ts):
 * update -> activity log + notify -> revalidate.
 */
export async function assignInstallerToJobAction(
  quoteId: string,
  installerId: string,
  installDate: string,
  customerName: string,
): Promise<AssignInstallerResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role !== "admin") return { error: "Only admins can assign installers to jobs." };

  const installer = await getProfileById(installerId);
  if (!installer) return { error: "Installer not found." };

  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("quotes")
    .select("install_status")
    .eq("id", quoteId)
    .single();

  if (fetchError || !existing) {
    console.error("assignInstallerToJobAction: quote not found", fetchError);
    return { error: "Job not found." };
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
  return {};
}

/** Frees up a booked day — clears the assignment so the job goes back into
 *  the unassigned-jobs list and the day cell reverts to its plain status. */
export async function unassignInstallerFromJobAction(quoteId: string): Promise<AssignInstallerResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role !== "admin") return { error: "Only admins can unassign installers from jobs." };

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

  const { error } = await supabase.from("quotes").update({ installer_id: null, install_date: null }).eq("id", quoteId);

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
  return {};
}
