"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/data/current-user";
import { getAllProfiles } from "@/data/profiles-service";
import { logActivity } from "@/lib/activity";
import { notifyUser } from "@/lib/notify";
import { formatDate } from "@/lib/format";
import { getOrCreateSolarSurveyToken } from "@/data/solar-survey-service";

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
    .select("customer_name, installer_id, install_date, product_type")
    .eq("id", quoteId)
    .single();

  if (fetchError || !existing) {
    console.error("respondToJob: quote not found", fetchError);
    return { error: "Job not found." };
  }
  if (existing.installer_id !== user.id) {
    return { error: "This job isn't booked to you." };
  }

  // A solar installer is assigned to survey the job first — accepting or
  // declining it is only offered once that survey has been submitted.
  const isSolar = existing.product_type === "solar";
  if (isSolar) {
    const { data: survey } = await supabase
      .from("solar_surveys")
      .select("status")
      .eq("quote_id", quoteId)
      .maybeSingle();
    if (survey?.status !== "submitted") {
      return { error: "Complete and submit the survey before accepting or declining this job." };
    }
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
  const activityDescription = isSolar
    ? `${user.firstName} ${verb} the solar job for ${existing.customer_name} after completing the survey`
    : `${user.firstName} ${verb} the install job for ${existing.customer_name} on ${dateLabel}`;
  const notificationBody = isSolar
    ? status === "accepted"
      ? `${user.firstName} surveyed ${existing.customer_name}'s solar job and accepted it.`
      : `${user.firstName} surveyed ${existing.customer_name}'s solar job and declined it — it needs reassigning.`
    : status === "accepted"
      ? `${user.firstName} confirmed they're doing ${existing.customer_name}'s install on ${dateLabel}.`
      : `${user.firstName} can't do ${existing.customer_name}'s install on ${dateLabel} — it needs reassigning.`;

  await logActivity({
    actorId: user.id,
    customerName: existing.customer_name,
    description: activityDescription,
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
        body: notificationBody,
        link: `/quotes/${quoteId}`,
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

/**
 * "Start survey" on a solar job's page — returns the `/survey/[token]` token
 * (creating the survey record on first use) so the installer can open the
 * on-site form. Scoped to the installer's own solar jobs, like `respondToJob`.
 */
export async function startSolarJobSurveyAction(quoteId: string): Promise<{ accessToken?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role !== "installer") return { error: "Only installers can start a job survey." };

  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("installer_id, product_type")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote || quote.installer_id !== user.id || quote.product_type !== "solar") {
    return { error: "This job isn't assigned to you." };
  }

  try {
    const { accessToken } = await getOrCreateSolarSurveyToken(quoteId);
    return { accessToken };
  } catch (error) {
    console.error("startSolarJobSurveyAction failed", error);
    return { error: "Could not open the survey. Please try again." };
  }
}
