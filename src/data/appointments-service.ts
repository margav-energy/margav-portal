import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAllProfiles, type RepProfile } from "@/data/profiles-service";
import type { AppointmentStage, CalendarAppointment } from "@/types/calendar-appointment";
import type { AcceptanceStatus, AllocatedAppointment } from "@/types/allocated-appointment";
import type { ConfirmationStatus, ReadyToConfirmLead } from "@/types/ready-to-confirm";
import type { OutcomeMissingLead } from "@/types/outcome-missing";
import type { RtaLead } from "@/types/rta-lead";
import type { CancelledAppointment } from "@/types/cancelled-appointment";

/**
 * Shared data-access layer for the Appointments module. Every sub-page
 * (unallocated / allocated / ready-to-confirm / outcome-missing / RTA due /
 * recently cancelled) and the calendar is really just a different filtered
 * view of the single `public.appointments` table (see `supabase/schema.sql`)
 * — this file owns the real Supabase queries + row → legacy-mock-type
 * mapping, and the per-page `*-service.ts` files just re-export the bits
 * they need so existing `page.tsx`/component prop shapes don't change.
 */

export type LifecycleStage =
  | "unallocated"
  | "allocated"
  | "ready_to_confirm"
  | "confirmed"
  | "completed"
  | "cancelled";

export interface AppointmentRow {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  postcode: string;
  address: string;
  occupancy: string | null;
  source: string | null;
  medium: string | null;
  term: string | null;
  product_type: "solar" | "boiler";
  notes: string | null;
  rep_id: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string | null;
  lifecycle_stage: LifecycleStage;
  calendar_stage: AppointmentStage | null;
  acceptance_status: AcceptanceStatus | "accepted" | "declined" | null;
  acceptance_response: string | null;
  confirmation_status: ConfirmationStatus | null;
  outcome: string | null;
  outcome_logged_at: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  rta_due_date: string | null;
  rebooked_from_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedCalendarViewFilters {
  stages: string[];
  reps: string[];
}

export interface SavedCalendarView {
  id: string;
  name: string;
  filters: SavedCalendarViewFilters;
}

// ── shared helpers ──────────────────────────────────────────────────────

function fullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function repNameFor(repId: string | null, profiles: RepProfile[]): string {
  if (!repId) return "Unallocated";
  return profiles.find((profile) => profile.id === repId)?.fullName ?? "Unallocated";
}

/** Combines an appointment_date + start_time into the bare ISO datetime string the mock types use, e.g. "2026-08-16T10:00:00". */
function toISODateTime(date: string, time: string): string {
  return `${date}T${time.length >= 8 ? time : `${time}:00`}`;
}

function toHHmm(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

function addHour(hhmm: string): string {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return `${String((hours + 1) % 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

async function fetchAppointmentRows(): Promise<AppointmentRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .order("appointment_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    console.error("fetchAppointmentRows failed", error);
    return [];
  }

  return (data ?? []) as AppointmentRow[];
}

export async function getAppointmentSummary(
  id: string,
): Promise<{ id: string; customerName: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, first_name, last_name")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return { id: data.id as string, customerName: fullName(data.first_name, data.last_name) };
}

// ── calendar ─────────────────────────────────────────────────────────────

/**
 * `calendar_stage` is only ever set explicitly by the mutations below —
 * older/blank rows fall back to a stage derived from `lifecycle_stage` (and
 * `outcome` once completed) so every appointment always renders on the
 * calendar with a sensible colour.
 */
function deriveCalendarStage(row: AppointmentRow): AppointmentStage {
  if (row.calendar_stage) return row.calendar_stage;

  switch (row.lifecycle_stage) {
    case "unallocated":
      return "allocated";
    case "allocated":
    case "ready_to_confirm":
      return "booked";
    case "confirmed":
      return "confirmed";
    case "completed":
      if (row.outcome === "Sat - Sold") return "sold";
      if (row.outcome === "No Show" || row.outcome === "Sat - No Sale") return "pitch_and_miss";
      return "not_pitched";
    default:
      return "allocated";
  }
}

export async function getAllCalendarAppointments(): Promise<CalendarAppointment[]> {
  const [rows, profiles] = await Promise.all([fetchAppointmentRows(), getAllProfiles()]);

  return rows
    .filter((row) => row.lifecycle_stage !== "cancelled")
    .map((row) => {
      const startTime = toHHmm(row.start_time) ?? "09:00";
      return {
        id: row.id,
        customerName: fullName(row.first_name, row.last_name),
        repName: repNameFor(row.rep_id, profiles),
        stage: deriveCalendarStage(row),
        date: row.appointment_date,
        startTime,
        endTime: toHHmm(row.end_time) ?? addHour(startTime),
      };
    });
}

// ── allocated, not accepted ─────────────────────────────────────────────

export async function getAllAllocatedAppointments(): Promise<AllocatedAppointment[]> {
  const [rows, profiles] = await Promise.all([fetchAppointmentRows(), getAllProfiles()]);
  const now = new Date();

  return rows
    .filter((row) => row.lifecycle_stage === "allocated")
    .map((row) => {
      const appointmentAt = toISODateTime(row.appointment_date, row.start_time);
      const isOverdue = row.acceptance_status === "overdue" || new Date(appointmentAt) < now;
      return {
        id: row.id,
        customerName: fullName(row.first_name, row.last_name),
        status: (isOverdue ? "overdue" : "pending") as AcceptanceStatus,
        representativeName: repNameFor(row.rep_id, profiles),
        appointmentAt,
        response: row.acceptance_response ?? undefined,
      };
    });
}

// ── ready to confirm ─────────────────────────────────────────────────────

export async function getAllReadyToConfirmLeads(): Promise<ReadyToConfirmLead[]> {
  const rows = await fetchAppointmentRows();

  return rows
    .filter((row) => row.lifecycle_stage === "ready_to_confirm")
    .map((row) => ({
      id: row.id,
      leadName: fullName(row.first_name, row.last_name),
      phone: row.phone,
      appointmentAt: toISODateTime(row.appointment_date, row.start_time),
      occupancy: row.occupancy ?? "—",
      confirmation: row.confirmation_status ?? "awaiting",
    }));
}

// ── outcome missing ──────────────────────────────────────────────────────

/**
 * "Outcome missing" = an appointment that made it all the way to
 * `confirmed` but hasn't had an outcome logged yet — the pipeline stage
 * right before `completed`.
 */
export async function getAllOutcomeMissingLeads(): Promise<OutcomeMissingLead[]> {
  const [rows, profiles] = await Promise.all([fetchAppointmentRows(), getAllProfiles()]);

  return rows
    .filter((row) => row.lifecycle_stage === "confirmed" && !row.outcome)
    .map((row) => ({
      id: row.id,
      leadName: fullName(row.first_name, row.last_name),
      address: row.address,
      phone: row.phone,
      representativeName: repNameFor(row.rep_id, profiles),
      appointmentAt: toISODateTime(row.appointment_date, row.start_time),
    }));
}

// ── RTA due ──────────────────────────────────────────────────────────────

export async function getAllRtaLeads(): Promise<RtaLead[]> {
  const rows = await fetchAppointmentRows();
  const today = new Date().toISOString().slice(0, 10);

  return rows
    .filter(
      (row) =>
        !!row.rta_due_date &&
        row.rta_due_date <= today &&
        row.lifecycle_stage !== "completed" &&
        row.lifecycle_stage !== "cancelled",
    )
    .map((row) => ({
      id: row.id,
      leadName: fullName(row.first_name, row.last_name),
      phone: row.phone,
      appointmentAt: toISODateTime(row.appointment_date, row.start_time),
    }));
}

// ── unallocated ──────────────────────────────────────────────────────────

export async function getAllUnallocatedLeads(): Promise<RtaLead[]> {
  const rows = await fetchAppointmentRows();

  return rows
    .filter((row) => row.lifecycle_stage === "unallocated")
    .map((row) => ({
      id: row.id,
      leadName: fullName(row.first_name, row.last_name),
      phone: row.phone,
      appointmentAt: toISODateTime(row.appointment_date, row.start_time),
    }));
}

// ── recently cancelled ───────────────────────────────────────────────────

export async function getAllCancelledAppointments(): Promise<CancelledAppointment[]> {
  const [rows, profiles] = await Promise.all([fetchAppointmentRows(), getAllProfiles()]);

  return rows
    .filter((row) => row.lifecycle_stage === "cancelled")
    .map((row) => ({
      id: row.id,
      customerName: fullName(row.first_name, row.last_name),
      address: row.address,
      representativeName: repNameFor(row.rep_id, profiles),
      appointmentAt: toISODateTime(row.appointment_date, row.start_time),
      reason: row.cancellation_reason ?? "—",
    }));
}

// ── mutations ────────────────────────────────────────────────────────────

export interface CreateAppointmentInput {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  postcode: string;
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  city: string;
  county?: string;
  source?: string;
  medium?: string;
  term?: string;
  notes: string;
  product: string;
  date: string;
  time: string;
  createdBy: string | null;
  rebookedFromId?: string | null;
}

/** Days before the appointment date that a reminder-to-attend call becomes due — see report for rationale. */
const RTA_DUE_OFFSET_DAYS = 3;

function computeRtaDueDate(appointmentDate: string): string {
  const due = new Date(`${appointmentDate}T00:00:00`);
  due.setDate(due.getDate() - RTA_DUE_OFFSET_DAYS);
  return due.toISOString().slice(0, 10);
}

/** The single `product_type` column only models `solar` | `boiler` — every other product option folds into `solar`. */
function mapProductToType(product: string): "solar" | "boiler" {
  return product.toLowerCase().includes("boiler") ? "boiler" : "solar";
}

function combineAddress(input: CreateAppointmentInput): string {
  return [input.addressLine1, input.addressLine2, input.addressLine3, input.city, input.county]
    .map((line) => line?.trim())
    .filter((line): line is string => Boolean(line))
    .join(", ");
}

export interface CreatedAppointment {
  id: string;
  address: string;
  productType: "solar" | "boiler";
}

export async function createAppointment(input: CreateAppointmentInput): Promise<CreatedAppointment | null> {
  const supabase = await createClient();
  const address = combineAddress(input);
  const productType = mapProductToType(input.product);

  const { data, error } = await supabase
    .from("appointments")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      phone: input.phone,
      email: input.email || null,
      postcode: input.postcode,
      address,
      source: input.source || null,
      medium: input.medium || null,
      term: input.term || null,
      product_type: productType,
      notes: input.notes,
      appointment_date: input.date,
      start_time: input.time,
      lifecycle_stage: "unallocated",
      calendar_stage: "allocated",
      rta_due_date: computeRtaDueDate(input.date),
      rebooked_from_id: input.rebookedFromId ?? null,
      created_by: input.createdBy,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createAppointment failed", error);
    return null;
  }

  return { id: data.id as string, address, productType };
}

export async function allocateAppointment(id: string, repId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      rep_id: repId,
      lifecycle_stage: "allocated",
      acceptance_status: "pending",
      calendar_stage: "allocated",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("allocateAppointment failed", error);
    return false;
  }
  return true;
}

export async function acceptAppointment(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      acceptance_status: "accepted",
      lifecycle_stage: "ready_to_confirm",
      confirmation_status: "awaiting",
      calendar_stage: "booked",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("acceptAppointment failed", error);
    return false;
  }
  return true;
}

/** Judgement call: a declined allocation flows back to `unallocated` (rep cleared) so it re-enters the allocation queue rather than dead-ending. */
export async function declineAppointment(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      rep_id: null,
      acceptance_status: null,
      lifecycle_stage: "unallocated",
      calendar_stage: "allocated",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("declineAppointment failed", error);
    return false;
  }
  return true;
}

export async function confirmAppointment(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      confirmation_status: "confirmed",
      lifecycle_stage: "confirmed",
      calendar_stage: "confirmed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("confirmAppointment failed", error);
    return false;
  }
  return true;
}

/** Judgement call: declining at the confirmation stage cancels the appointment outright rather than looping it back for another confirmation attempt. */
export async function declineConfirmation(
  id: string,
  reason = "Declined at confirmation stage",
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      confirmation_status: "declined",
      lifecycle_stage: "cancelled",
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("declineConfirmation failed", error);
    return false;
  }
  return true;
}

export async function logOutcome(id: string, outcome: string): Promise<boolean> {
  const supabase = await createClient();
  const calendarStage: AppointmentStage = outcome === "Sat - Sold" ? "sold" : "pitch_and_miss";

  const { error } = await supabase
    .from("appointments")
    .update({
      outcome,
      outcome_logged_at: new Date().toISOString(),
      lifecycle_stage: "completed",
      calendar_stage: calendarStage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("logOutcome failed", error);
    return false;
  }
  return true;
}

export async function cancelAppointment(id: string, reason: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      lifecycle_stage: "cancelled",
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("cancelAppointment failed", error);
    return false;
  }
  return true;
}

// ── calendar saved views ─────────────────────────────────────────────────

export async function getSavedCalendarViews(userId: string): Promise<SavedCalendarView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_saved_views")
    .select("id, name, filters")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getSavedCalendarViews failed", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    filters: (row.filters ?? { stages: [], reps: [] }) as SavedCalendarViewFilters,
  }));
}

export async function createSavedCalendarView(
  userId: string,
  name: string,
  filters: SavedCalendarViewFilters,
): Promise<SavedCalendarView | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("calendar_saved_views")
    .insert({ user_id: userId, name, filters })
    .select("id, name, filters")
    .single();

  if (error || !data) {
    console.error("createSavedCalendarView failed", error);
    return null;
  }

  return {
    id: data.id as string,
    name: data.name as string,
    filters: (data.filters ?? filters) as SavedCalendarViewFilters,
  };
}

export async function deleteSavedCalendarView(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("calendar_saved_views").delete().eq("id", id);
  if (error) {
    console.error("deleteSavedCalendarView failed", error);
    return false;
  }
  return true;
}
