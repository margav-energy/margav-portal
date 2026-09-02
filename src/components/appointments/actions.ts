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
  cancelAppointment,
  confirmAppointment,
  createAppointment,
  declineAppointment,
  declineConfirmation,
  deleteAppointment,
  deriveCalendarStage,
  getAppointmentById,
  getAppointmentSummary,
  logOutcome,
  setAppointmentCalendarEventId,
  type CreateAppointmentInput,
} from "@/data/appointments-service";
import { getProfileById } from "@/data/profiles-service";
import type { AppointmentStage } from "@/types/calendar-appointment";
import {
  createQuoteForAppointment,
  getQuoteIdForAppointment,
  getQuoteSummaryForAppointment,
  relinkQuoteToRebookedAppointment,
} from "@/components/quotes/actions";

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

  // A rebook should carry the customer's existing quote forward — its property
  // details, boiler/solar units, line items, notes and history — rather than
  // spawning a second, blank "new_lead" quote that buries all of that and
  // looks to whoever opens it like the original was erased.
  const existingQuoteId = input.rebookedFromId ? await getQuoteIdForAppointment(input.rebookedFromId) : null;

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
    existingQuoteId
      ? relinkQuoteToRebookedAppointment(existingQuoteId, result.id, customerName).catch((error) =>
          console.error("relinkQuoteToRebookedAppointment failed", error),
        )
      : // Keeps the Quotes section in sync — every genuinely new appointment gets a
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
    })
      // Stashes the event id so a future rebook/delete can remove this exact event instead
      // of leaving it on Lucy's calendar forever alongside whatever replaces it.
      .then((event) => (event ? setAppointmentCalendarEventId(result.id, event.id) : undefined))
      .catch((error) => console.error("createAppointmentCalendarEvent failed", error)),
    // The appointment being rebooked from is superseded by this new one — cancel it so it
    // drops off the calendar/pipeline lists instead of sitting there as a second, still-live
    // appointment for the same customer (this is what made a rebooked customer appear twice
    // on the calendar: the original was never actually closed out).
    input.rebookedFromId
      ? cancelAppointment(input.rebookedFromId, "Rebooked to a new date/time").catch((error) =>
          console.error("cancelAppointment (superseded by rebook) failed", error),
        )
      : Promise.resolve(true),
  ]);

  revalidateAppointmentPaths();
  return { ok: true };
}

export interface AppointmentOverview {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  postcode: string;
  product: string;
  notes: string;
  repName: string;
  /** Freshly derived, not whatever the calendar's list happened to show when the page last loaded. */
  stage: AppointmentStage;
  date: string;
  startTime: string;
  /** The quote this appointment backs, if any — lets the modal link straight to "View full quote". */
  quoteId: string | null;
  /** e.g. "MarGav-1014" — for labelling a "Delete quote" confirmation. Absent when `quoteId` is. */
  quoteReference: string | null;
}

/** Backs the calendar's click-to-view overview popup — a live read, so it can't show a stage/rep
 *  combination that's gone stale since the calendar's own page load (e.g. a rep (re)assigned after). */
export async function getAppointmentOverviewAction(id: string): Promise<AppointmentOverview | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const [row, quote] = await Promise.all([getAppointmentById(id), getQuoteSummaryForAppointment(id)]);
  if (!row) return null;

  const rep = await getProfileById(row.rep_id);

  return {
    id: row.id,
    customerName: `${row.first_name} ${row.last_name}`.trim(),
    phone: row.phone,
    email: row.email ?? "",
    address: row.address,
    postcode: row.postcode,
    product: row.product ?? (row.product_type === "boiler" ? "Boiler" : "Solar"),
    notes: row.notes ?? "",
    repName: rep?.fullName ?? "Unallocated",
    stage: deriveCalendarStage(row),
    date: row.appointment_date,
    startTime: row.start_time.slice(0, 5),
    quoteId: quote?.id ?? null,
    quoteReference: quote?.reference ?? null,
  };
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

/** Admin-only, irreversible — see `deleteAppointment`'s doc comment in `appointments-service.ts` for the FK handling. */
export async function deleteAppointmentAction(
  id: string,
  customerName: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in to do that." };
  if (user.role !== "admin") return { ok: false, error: "Only admins can delete appointments." };

  const ok = await deleteAppointment(id);
  if (!ok) return { ok: false, error: "Could not delete the appointment. Please try again." };

  await logActivity({
    actorId: user.id,
    customerName,
    description: `${user.firstName} deleted an appointment for ${customerName}`,
    status: "unallocated",
    entityType: "appointment",
    entityId: id,
  });

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
