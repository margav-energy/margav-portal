"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/data/current-user";
import { getAllProfiles } from "@/data/profiles-service";
import { logActivity } from "@/lib/activity";
import { notifyUser } from "@/lib/notify";
import { formatDate } from "@/lib/format";

export interface RespondToJobResult {
  error?: string;
}

/**
 * An installer confirming or declining a job they've been booked into (see
 * `install_acceptance_status`, supabase/migrations/0018_*.sql) — the accept
 * /reject buttons on /jobs. Every admin gets notified either way
 * (`notifyUser` — in-app + email), since a decline needs someone to go
 * reassign the job and an accept is worth knowing too.
 */
async function respondToJob(
  quoteId: string,
  status: "accepted" | "rejected",
): Promise<RespondToJobResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role !== "installer") return { error: "Only installers can accept or reject a job." };

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("quotes")
    .select("customer_name, installer_id, install_date")
    .eq("id", quoteId)
    .single();

  if (fetchError || !existing) {
    console.error("respondToJob: quote not found", fetchError);
    return { error: "Job not found." };
  }
  if (existing.installer_id !== user.id) {
    return { error: "This job isn't booked to you." };
  }

  const { error } = await supabase
    .from("quotes")
    .update({ install_acceptance_status: status })
    .eq("id", quoteId);

  if (error) {
    console.error("respondToJob failed", error);
    return { error: "Could not save your response. Please try again." };
  }

  const dateLabel = existing.install_date ? formatDate(existing.install_date) : "the booked date";
  const verb = status === "accepted" ? "accepted" : "declined";

  await logActivity({
    actorId: user.id,
    customerName: existing.customer_name,
    description: `${user.firstName} ${verb} the install job for ${existing.customer_name} on ${dateLabel}`,
    status: status === "accepted" ? "allocated" : "unallocated",
    entityType: "quote_installer_assignment",
    entityId: quoteId,
  });

  const admins = (await getAllProfiles()).filter((profile) => profile.role === "admin");
  await Promise.all(
    admins.map((admin) =>
      notifyUser({
        userId: admin.id,
        title: status === "accepted" ? "Installer accepted a job" : "Installer declined a job",
        body:
          status === "accepted"
            ? `${user.firstName} confirmed they're doing ${existing.customer_name}'s install on ${dateLabel}.`
            : `${user.firstName} can't do ${existing.customer_name}'s install on ${dateLabel} — it needs reassigning.`,
      }),
    ),
  );

  revalidatePath("/jobs");
  revalidatePath("/appointments/installer-availability");
  return {};
}

export async function acceptInstallJobAction(quoteId: string): Promise<RespondToJobResult> {
  return respondToJob(quoteId, "accepted");
}

export async function rejectInstallJobAction(quoteId: string): Promise<RespondToJobResult> {
  return respondToJob(quoteId, "rejected");
}
