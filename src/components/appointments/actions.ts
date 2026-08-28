"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/data/current-user";
import { logActivity } from "@/lib/activity";
import { notifyUser } from "@/lib/notify";
import { createAppointmentCalendarEvent } from "@/lib/google-calendar";
import { formatUkPhone, formatUkPostcode, normalizeEmail, toTitleCase } from "@/lib/utils";
import {
  acceptAppointment,
  allocateAppointment,
  confirmAppointment,
  createAppointment,
  declineAppointment,
  declineConfirmation,
  getAppointmentSummary,
  logOutcome,
  type CreateAppointmentInput,
} from "@/data/appointments-service";
import { createQuoteForAppointment } from "@/components/quotes/actions";

const APPOINTMENT_PATHS = [
  "/appointments/calendar",
  "/appointments/unallocated",
  "/appointments/allocated-not-accepted",
  "/appointments/ready-to-confirm",
  "/appointments/outcome-missing",
  "/appointments/rta-due",
  "/appointments/recently-cancelled",
];

function revalidateAppointmentPaths() {
  for (const path of APPOINTMENT_PATHS) revalidatePath(path);
}

export type CreateAppointmentActionInput = Omit<CreateAppointmentInput, "createdBy">;

/** Admin-only — see the page-level guard on `/appointments/create` (src/app/appointments/create/page.tsx). */
export async function createAppointmentAction(
  input: CreateAppointmentActionInput,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in to do that." };
  if (user.role !== "admin") return { ok: false, error: "Only admins can create appointments." };

  // Normalized here too, not just in the form — this is the one place every
  // appointment (from this form or any future caller) actually gets saved.
  input = {
    ...input,
    firstName: toTitleCase(input.firstName.trim()),
    lastName: toTitleCase(input.lastName.trim()),
    postcode: formatUkPostcode(input.postcode.trim()),
    email: normalizeEmail(input.email),
    phone: formatUkPhone(input.phone),
  };

  const result = await createAppointment({ ...input, createdBy: user.id });

  if (!result) {
    return { ok: false, error: "Could not save the appointment. Please try again." };
  }

  const customerName = `${input.firstName} ${input.lastName}`.trim();

  await Promise.all([
    logActivity({
      actorId: user.id,
      customerName,
      description: input.rebookedFromId
        ? "Rebooked a cancelled appointment"
        : "Created a new appointment",
      status: "unallocated",
      entityType: "appointment",
      entityId: result.id,
    }),
    // Keeps the Quotes section in sync — every new appointment gets a
    // matching "new_lead" quote a rep can pick up once they pitch it.
    // Wrapped so a failure here can never fail the appointment itself.
    createQuoteForAppointment({
      appointmentId: result.id,
      customerName,
      customerEmail: input.email,
      customerPhone: input.phone,
      postcode: input.postcode,
      address: result.address,
      productType: result.productType,
      notes: input.notes,
      createdBy: user.id,
    }).catch((error) => console.error("createQuoteForAppointment failed", error)),
    // Puts name/address/contact/notes on Lucy's Google Calendar at a glance.
    // Wrapped the same way — a Calendar API hiccup can never fail the
    // appointment itself. No-ops (resolves to null) if unconfigured.
    createAppointmentCalendarEvent({
      customerName,
      address: result.address,
      postcode: input.postcode,
      phone: input.phone,
      email: input.email,
      product: input.product,
      notes: input.notes,
      source: input.source,
      medium: input.medium,
      date: input.date,
      startTime: input.time,
    }).catch((error) => console.error("createAppointmentCalendarEvent failed", error)),
  ]);

  revalidateAppointmentPaths();
  return { ok: true };
}

export async function allocateAppointmentAction(
  id: string,
  repId: string,
  repName: string,
): Promise<{ ok: boolean }> {
  const [user, ok] = await Promise.all([getCurrentUser(), allocateAppointment(id, repId)]);
  if (!ok) return { ok: false };

  const summary = await getAppointmentSummary(id);
  await Promise.all([
    logActivity({
      actorId: user?.id,
      customerName: summary?.customerName ?? "",
      description: `Allocated to ${repName}`,
      status: "allocated",
      entityType: "appointment",
      entityId: id,
    }),
    notifyUser({
      userId: repId,
      title: "New appointment assigned to you",
      body: summary?.customerName
        ? `You've been assigned an appointment with ${summary.customerName}. Log in to Margav Portal to view it.`
        : "You've been assigned a new appointment. Log in to Margav Portal to view it.",
    }),
  ]);

  revalidateAppointmentPaths();
  return { ok: true };
}

export async function acceptAppointmentAction(id: string): Promise<{ ok: boolean }> {
  const [user, ok] = await Promise.all([getCurrentUser(), acceptAppointment(id)]);
  if (!ok) return { ok: false };

  const summary = await getAppointmentSummary(id);
  await logActivity({
    actorId: user?.id,
    customerName: summary?.customerName ?? "",
    description: "Accepted allocated appointment",
    status: "ready_to_confirm",
    entityType: "appointment",
    entityId: id,
  });

  revalidateAppointmentPaths();
  return { ok: true };
}

export async function declineAppointmentAction(id: string): Promise<{ ok: boolean }> {
  const [user, summary, ok] = await Promise.all([
    getCurrentUser(),
    getAppointmentSummary(id),
    declineAppointment(id),
  ]);
  if (!ok) return { ok: false };

  await logActivity({
    actorId: user?.id,
    customerName: summary?.customerName ?? "",
    description: "Declined allocated appointment — returned to unallocated",
    status: "unallocated",
    entityType: "appointment",
    entityId: id,
  });

  revalidateAppointmentPaths();
  return { ok: true };
}

export async function confirmAppointmentAction(id: string): Promise<{ ok: boolean }> {
  const [user, ok] = await Promise.all([getCurrentUser(), confirmAppointment(id)]);
  if (!ok) return { ok: false };

  const summary = await getAppointmentSummary(id);
  await logActivity({
    actorId: user?.id,
    customerName: summary?.customerName ?? "",
    description: "Confirmed appointment",
    status: "allocated",
    entityType: "appointment",
    entityId: id,
  });

  revalidateAppointmentPaths();
  return { ok: true };
}

export async function declineConfirmationAction(id: string): Promise<{ ok: boolean }> {
  const [user, summary, ok] = await Promise.all([
    getCurrentUser(),
    getAppointmentSummary(id),
    declineConfirmation(id),
  ]);
  if (!ok) return { ok: false };

  await Promise.all([
    logActivity({
      actorId: user?.id,
      customerName: summary?.customerName ?? "",
      description: "Declined confirmation — appointment cancelled",
      status: "cancelled",
      entityType: "appointment",
      entityId: id,
    }),
    // Unlike every other lifecycle change here, this one is customer-
    // initiated — the rep has no other way to find out their appointment
    // just got cancelled out from under them.
    summary?.repId
      ? notifyUser({
          userId: summary.repId,
          title: "Appointment cancelled",
          body: summary.customerName
            ? `${summary.customerName} declined confirmation — the appointment has been cancelled.`
            : "A customer declined confirmation — the appointment has been cancelled.",
        })
      : Promise.resolve(),
  ]);

  revalidateAppointmentPaths();
  return { ok: true };
}

export async function logOutcomeAction(id: string, outcome: string): Promise<{ ok: boolean }> {
  const [user, ok] = await Promise.all([getCurrentUser(), logOutcome(id, outcome)]);
  if (!ok) return { ok: false };

  const summary = await getAppointmentSummary(id);
  await logActivity({
    actorId: user?.id,
    customerName: summary?.customerName ?? "",
    description: `Logged outcome: ${outcome}`,
    status: "allocated",
    entityType: "appointment",
    entityId: id,
  });

  revalidateAppointmentPaths();
  return { ok: true };
}
