"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/site-origin";
import { getCurrentUser } from "@/data/current-user";
import { getProfileById } from "@/data/profiles-service";
import { getOrCreateBoilerSurveyToken } from "@/data/boiler-survey-service";
import { fetchStreetViewPhotoForQuote } from "@/data/property-photo-service";
import { createAgreementSignatureRequest, createSignatureRequest, createWaiverSignatureRequest } from "@/data/signature-service";
import { isResendConfigured, sendEmail } from "@/lib/resend";
import { signAgreementEmailHtml, signQuoteEmailHtml, signWaiverEmailHtml } from "@/lib/esignature/email-templates";
import { logActivity } from "@/lib/activity";
import { notifyUser } from "@/lib/notify";
import { formatCurrency } from "@/lib/format";
import { QUOTE_PIPELINE_STATUS_STYLES } from "@/lib/status-colors";
import { formatUkPhone, formatUkPostcode, normalizeEmail, toTitleCase } from "@/lib/utils";
import {
  mapFreeTextRow,
  mapLineItemRow,
  parseLineItems,
  serializeLineItems,
  sumLineItems,
  type LineItemRow,
} from "@/data/quotes-mappers";
import type {
  CustomerDetails,
  FreeTextExtra,
  LineItem,
  LineItemSection,
  PaymentMethodOption,
  QuoteNote,
} from "@/types/quote-detail-shared";
import type { BoilerPropertyDetails, BoilerUnit } from "@/types/boiler-quote";
import type { SolarArray, SolarPropertyDetails } from "@/types/solar-quote";
import type { QuotePipelineStatus } from "@/types/quote";

/**
 * All mutations for the Quotes module. Reads live in
 * `src/data/quotes-service.ts`. Every mutation here does three things:
 *   1. writes to Supabase,
 *   2. inserts a `quote_history` row (quote-scoped timeline), and
 *   3. calls `logActivity` (portal-wide Activity Feed),
 * then revalidates the quote detail + list paths so a hard navigation/
 * refresh always reflects the change. Client components additionally keep
 * their own local state in sync from each action's return value, matching
 * the existing local-state-first pattern in this module.
 */

async function insertQuoteHistory(params: {
  quoteId: string;
  description: string;
  actorId?: string | null;
  isSystem?: boolean;
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("quote_history").insert({
      quote_id: params.quoteId,
      actor_id: params.actorId ?? null,
      is_system: params.isSystem ?? !params.actorId,
      description: params.description,
    });
  } catch (error) {
    console.error("insertQuoteHistory failed", error);
  }
}

/**
 * The Customer details card (CustomerCard.tsx) reads its address from
 * `customer_address_lines`, not the flat `address`/`postcode` columns —
 * without this, a quote created here shows a blank address on its own
 * detail page even though the Quotes list (which reads `address` directly)
 * displays it fine.
 */
function buildCustomerAddressLines(address: string, postcode: string): string[] {
  return [address.trim(), postcode.trim()].filter(Boolean);
}

function revalidateQuote(quoteId: string) {
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
}

/**
 * `quotes.amount` — the "Value" column on the Quotes list — is a stored
 * column, not derived at read time like the detail page's `sellPrice`
 * (see the doc comment on `buildProfitBreakdown` in quotes-mappers.ts).
 * Every mutation that can change what a quote is worth (units/arrays,
 * extras/standard additionals/free-text extras) calls this afterward so
 * the list stays in sync instead of showing whatever `amount` was at
 * quote creation (0 for an appointment-linked quote) forever after.
 */
async function syncQuoteAmount(quoteId: string): Promise<void> {
  const supabase = await createClient();
  const [unitsResult, arraysResult, lineItemsResult] = await Promise.all([
    supabase.from("boiler_units").select("price, items").eq("quote_id", quoteId),
    supabase.from("solar_arrays").select("items").eq("quote_id", quoteId),
    supabase.from("quote_line_items").select("quantity, unit_price").eq("quote_id", quoteId),
  ]);

  const unitsTotal = (unitsResult.data ?? []).reduce(
    (sum, unit) => sum + Number(unit.price ?? 0) + sumLineItems(parseLineItems(unit.items)),
    0,
  );
  const arraysTotal = (arraysResult.data ?? []).reduce(
    (sum, array) => sum + sumLineItems(parseLineItems(array.items)),
    0,
  );
  const lineItemsTotal = sumLineItems(
    (lineItemsResult.data ?? []).map((row) => ({
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
    })),
  );

  const { error } = await supabase
    .from("quotes")
    .update({ amount: unitsTotal + arraysTotal + lineItemsTotal })
    .eq("id", quoteId);
  if (error) console.error("syncQuoteAmount failed", error);
}

async function nextSortOrder(
  table: "boiler_units" | "solar_arrays" | "quote_line_items",
  quoteId: string,
  extraFilter?: { column: string; value: string },
): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("quote_id", quoteId);
  if (extraFilter) query = query.eq(extraFilter.column, extraFilter.value);
  const { count } = await query;
  return count ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────────────────

export interface CreateQuoteInput {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  postcode: string;
  address: string;
  productType: "solar" | "boiler";
  amount: number;
  paymentType: "cash" | "finance" | "card" | "bacs";
}

export interface CreateQuoteResult {
  id?: string;
  error?: string;
}

/**
 * Quick-create: the Quotes screens otherwise only ever view/edit quotes
 * that already exist (they normally land here from elsewhere), so this is
 * intentionally minimal — everything else (line items, boiler units/solar
 * arrays, notes, ...) gets added afterward from the detail page.
 */
export async function createQuote(input: CreateQuoteInput): Promise<CreateQuoteResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  // Reps work quotes an admin has already created and assigned to them —
  // see the "New quote" button being admin-only in QuotesPageHeader.tsx.
  if (user.role !== "admin") return { error: "Only admins can create quotes." };

  const customerName = toTitleCase(input.customerName.trim());
  if (!customerName) return { error: "Customer name is required." };
  const postcode = formatUkPostcode(input.postcode.trim());
  const customerEmail = input.customerEmail?.trim() ? normalizeEmail(input.customerEmail) : null;
  const customerPhone = input.customerPhone?.trim() ? formatUkPhone(input.customerPhone) : null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      customer_name: customerName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      postcode,
      address: input.address.trim(),
      customer_address_lines: buildCustomerAddressLines(input.address, postcode),
      product_type: input.productType,
      amount: input.amount,
      payment_type: input.paymentType,
      pipeline_status: "new_lead",
      sent_date: new Date().toISOString().slice(0, 10),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createQuote failed", error);
    return { error: "Could not create the quote. Please try again." };
  }

  // Best-effort — runs after the response is sent so it never adds latency
  // to quote creation, and is a no-op if Street View isn't configured or
  // has no coverage for this address (see `fetchStreetViewPhotoForQuote`).
  after(() => fetchStreetViewPhotoForQuote(data.id, `${input.address.trim()}, ${postcode}`));

  await insertQuoteHistory({
    quoteId: data.id,
    actorId: user.id,
    description: `${user.firstName} created this quote`,
  });
  await logActivity({
    actorId: user.id,
    customerName,
    description: `${user.firstName} created a new quote for ${customerName}`,
    status: "allocated",
    entityType: "quote",
    entityId: data.id,
  });

  revalidatePath("/quotes");

  return { id: data.id as string };
}

export interface CreateQuoteForAppointmentInput {
  appointmentId: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  postcode: string;
  address: string;
  productType: "solar" | "boiler";
  notes?: string | null;
  /** Whoever created the appointment — attributed as the author of the
   *  `quote_notes` row this seeds from `notes` below, so it doesn't show
   *  up as "Unknown". Absent for old call sites/tests; the note still
   *  gets created either way. */
  createdBy?: string | null;
}

/**
 * Auto-creates the placeholder "new_lead" quote that backs a freshly
 * created appointment — called from `createAppointmentAction` in
 * `src/components/appointments/actions.ts` so the Quotes section stays in
 * sync with the Appointments pipeline. Unassigned and £0 until a rep pitches
 * it, same shape as a manual "Quick-create" quote. `appointment_id` is
 * unique per appointment (see migration `0006_quotes_appointment_link.sql`),
 * so a retried call for the same appointment fails the unique index instead
 * of creating a second quote.
 */
export async function createQuoteForAppointment(
  input: CreateQuoteForAppointmentInput,
): Promise<CreateQuoteResult> {
  const customerName = toTitleCase(input.customerName.trim());
  if (!customerName) return { error: "Customer name is required." };
  const postcode = formatUkPostcode(input.postcode.trim());

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      appointment_id: input.appointmentId,
      customer_name: customerName,
      customer_email: input.customerEmail ? normalizeEmail(input.customerEmail) : null,
      customer_phone: input.customerPhone ? formatUkPhone(input.customerPhone) : null,
      postcode,
      address: input.address.trim(),
      customer_address_lines: buildCustomerAddressLines(input.address, postcode),
      product_type: input.productType,
      notes: input.notes || null,
      pipeline_status: "new_lead",
      sent_date: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createQuoteForAppointment failed", error);
    return { error: "Could not create the linked quote. Please try again." };
  }

  // Best-effort — see the equivalent call in `createQuote` above.
  after(() => fetchStreetViewPhotoForQuote(data.id, `${input.address.trim()}, ${postcode}`));

  await insertQuoteHistory({
    quoteId: data.id,
    isSystem: true,
    description: "Quote auto-created from a new appointment",
  });
  await logActivity({
    customerName,
    description: `New appointment auto-created a quote for ${customerName}`,
    status: "unallocated",
    entityType: "quote",
    entityId: data.id,
    isSystem: true,
  });

  // Carries whatever was typed into the appointment form's "Notes" field
  // over to the ONE place a note is actually visible on a quote — the
  // Notes panel (backed by `quote_notes`, not the flat `quotes.notes`
  // column set above, which nothing in the UI ever reads back). Without
  // this, that text is saved (to `quotes.notes`) but invisible, so
  // whoever typed it re-types it via "Leave a note" the moment they open
  // the quote — this is what fixes that.
  const trimmedNotes = input.notes?.trim();
  if (trimmedNotes) {
    const { error: noteError } = await supabase
      .from("quote_notes")
      .insert({ quote_id: data.id, author_id: input.createdBy ?? null, body: trimmedNotes });
    if (noteError) console.error("createQuoteForAppointment: seeding quote_notes failed", noteError);
  }

  revalidatePath("/quotes");

  return { id: data.id as string };
}

// ─────────────────────────────────────────────────────────────────────────
// Header actions: favourite, lock, assign rep, communications
// ─────────────────────────────────────────────────────────────────────────

export async function toggleQuoteFavourite(
  quoteId: string,
  isFavourite: boolean,
  customerName: string,
): Promise<void> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error } = await supabase.from("quotes").update({ is_favourite: isFavourite }).eq("id", quoteId);
  if (error) {
    console.error("toggleQuoteFavourite failed", error);
    return;
  }

  const description = isFavourite ? "Marked as favourite" : "Removed from favourites";
  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `${description} — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
  revalidateQuote(quoteId);
}

export async function setQuoteLocked(quoteId: string, isLocked: boolean, customerName: string): Promise<void> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error } = await supabase.from("quotes").update({ is_locked: isLocked }).eq("id", quoteId);
  if (error) {
    console.error("setQuoteLocked failed", error);
    return;
  }

  const description = isLocked ? "Locked the quote" : "Unlocked the quote";
  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `${description} — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
  revalidateQuote(quoteId);
}

export interface UpdateQuotePipelineStatusResult {
  error?: string;
}

/**
 * Moves a lead through its lifecycle — New Lead → Ready to Pitch → Locked →
 * Complete (see `QUOTE_PIPELINE_STATUS_STYLES`, src/lib/status-colors.ts).
 * Admin-only: every other field this module writes is open to reps too,
 * but `pipeline_status` doubles as the top-level "is this deal done"
 * signal reps and installers see on the quotes list, so only an admin can
 * move it. Previously this column was only ever set once at creation
 * ('new_lead') and never changed again.
 */
export async function updateQuotePipelineStatusAction(
  quoteId: string,
  status: QuotePipelineStatus,
  customerName: string,
): Promise<UpdateQuotePipelineStatusResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role !== "admin") return { error: "Only admins can change a lead's status." };

  const supabase = await createClient();
  const { error } = await supabase.from("quotes").update({ pipeline_status: status }).eq("id", quoteId);
  if (error) {
    console.error("updateQuotePipelineStatusAction failed", error);
    return { error: "Could not update the status. Please try again." };
  }

  const label = QUOTE_PIPELINE_STATUS_STYLES[status].label;
  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user.id, description: `Changed status to ${label}` }),
    logActivity({
      actorId: user.id,
      customerName,
      description: `Changed status to ${label} — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
  revalidateQuote(quoteId);
  return {};
}

/**
 * Admin-only — reps work whatever's already been assigned to them, they
 * don't reassign who a quote belongs to (see the rep-assign dropdown being
 * hidden for non-admins in QuoteHeader.tsx). Returns `null` on failure
 * (including "not an admin") rather than an `{ error }` shape since the
 * caller applies the change optimistically and doesn't surface this
 * return value — same as the pre-existing `!rep` early-return below.
 */
export async function assignQuoteRepresentative(
  quoteId: string,
  repId: string,
  customerName: string,
): Promise<{ repId: string; repName: string } | null> {
  const supabase = await createClient();
  const [user, rep] = await Promise.all([getCurrentUser(), getProfileById(repId)]);
  if (!user || user.role !== "admin") return null;
  if (!rep) return null;

  const { error } = await supabase.from("quotes").update({ representative_id: repId }).eq("id", quoteId);
  if (error) {
    console.error("assignQuoteRepresentative failed", error);
    return null;
  }

  const description = `Assigned to ${rep.fullName}`;
  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `${description} — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
    notifyUser({
      userId: repId,
      title: "New quote assigned to you",
      body: `You've been assigned to ${customerName}'s quote. Log in to Margav Portal to view it.`,
    }),
  ]);
  revalidateQuote(quoteId);
  return { repId, repName: rep.fullName };
}

/**
 * No email/communications provider is wired up yet. This just logs that the
 * Communications panel was opened so the button isn't a dead end — swap in
 * a real provider call here later (and keep the logging alongside it).
 */
export async function logCommunicationsOpened(quoteId: string, customerName: string): Promise<void> {
  const user = await getCurrentUser();
  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description: "Communications opened" }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Communications opened — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
}

/** Sends the actual email from the Communications modal — see `src/lib/resend.ts`. Always from lucy@margav.energy. */
export async function sendCommunicationEmail(
  quoteId: string,
  customerName: string,
  customerEmail: string,
  subject: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isResendConfigured()) {
    return { ok: false, error: "Email isn't set up yet — add RESEND_API_KEY to .env.local to enable this." };
  }
  if (!customerEmail.trim()) {
    return { ok: false, error: "This customer has no email address on file." };
  }

  const user = await getCurrentUser();

  try {
    await sendEmail({ to: customerEmail, subject, text: message });
  } catch (error) {
    console.error("sendCommunicationEmail failed", error);
    return { ok: false, error: "Could not send the email. Please try again." };
  }

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description: `Sent email: "${subject}"` }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Sent email to ${customerName}: "${subject}"`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
  revalidateQuote(quoteId);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────
// Customer + property details
// ─────────────────────────────────────────────────────────────────────────

export async function updateQuoteCustomer(quoteId: string, customer: CustomerDetails): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const customerName = toTitleCase(customer.name.trim());
  const { error } = await supabase
    .from("quotes")
    .update({
      customer_name: customerName,
      customer_email: customer.email ? normalizeEmail(customer.email) : null,
      customer_phone: customer.phone ? formatUkPhone(customer.phone) : null,
      customer_address_lines: customer.addressLines,
    })
    .eq("id", quoteId);

  if (error) {
    console.error("updateQuoteCustomer failed", error);
    return false;
  }

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description: "Updated customer details" }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Updated customer details — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
  revalidateQuote(quoteId);
  return true;
}

export async function updateQuotePropertyDetails(
  quoteId: string,
  propertyDetails: BoilerPropertyDetails | SolarPropertyDetails,
  customerName: string,
): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error } = await supabase
    .from("quotes")
    .update({ property_details: propertyDetails })
    .eq("id", quoteId);

  if (error) {
    console.error("updateQuotePropertyDetails failed", error);
    return false;
  }

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description: "Updated property details" }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Updated property details — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
  revalidateQuote(quoteId);
  return true;
}

/**
 * Solar-only: the one value a rep enters for the Profit card — `sellPrice`
 * always mirrors the Pricing card's total instead of being stored (see
 * `buildProfitBreakdown` in `src/data/quotes-mappers.ts`), so this is the
 * one write needed to make `profit`/`marginPercent` calculate. Boiler
 * quotes don't call this — their cost price is calculated, not entered
 * (see `src/lib/boiler-install-cost.ts`).
 */
export async function updateQuoteCostPrice(
  quoteId: string,
  costPrice: number,
  customerName: string,
): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error } = await supabase.from("quotes").update({ profit_breakdown: { costPrice } }).eq("id", quoteId);

  if (error) {
    console.error("updateQuoteCostPrice failed", error);
    return false;
  }

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description: `Set cost price to ${formatCurrency(costPrice)}` }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Updated cost price — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
  revalidateQuote(quoteId);
  return true;
}

export interface PricingAdjustments {
  vatAmount: number;
  discountAmount: number;
  depositAmount: number;
}

/**
 * The three "System Summary" figures on the quote document
 * (src/lib/esignature/document.ts) that need a human to enter them rather
 * than being derived from line items — see supabase/migrations/0020_*.sql.
 * `vatAmount` is informational only (this business quotes VAT-inclusive
 * prices); the real total is subtotal minus discount.
 */
export async function updatePricingAdjustments(
  quoteId: string,
  adjustments: PricingAdjustments,
  customerName: string,
): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error } = await supabase
    .from("quotes")
    .update({
      vat_amount: adjustments.vatAmount,
      discount_amount: adjustments.discountAmount,
      deposit_amount: adjustments.depositAmount,
    })
    .eq("id", quoteId);

  if (error) {
    console.error("updatePricingAdjustments failed", error);
    return false;
  }

  await Promise.all([
    insertQuoteHistory({
      quoteId,
      actorId: user?.id,
      // VAT isn't editable from PricingAdjustmentsCard for now (see its
      // comment), so it's left out here too — otherwise every discount/
      // deposit edit would misleadingly log "Set VAT" alongside them.
      description: `Set discount ${formatCurrency(adjustments.discountAmount)}, deposit ${formatCurrency(adjustments.depositAmount)}`,
    }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Updated pricing adjustments — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
  revalidateQuote(quoteId);
  return true;
}

/**
 * `termYears` is only meaningful (and only persisted) when `method` is
 * "monthly_plan" — see src/lib/finance.ts for the term/APR rule.
 */
export async function updateSelectedPaymentMethod(
  quoteId: string,
  method: PaymentMethodOption,
  termYears: number | null,
  customerName: string,
): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error } = await supabase
    .from("quotes")
    .update({
      selected_payment_method: method,
      monthly_plan_term_years: method === "monthly_plan" ? termYears : null,
    })
    .eq("id", quoteId);
  if (error) {
    console.error("updateSelectedPaymentMethod failed", error);
    return false;
  }

  const description =
    method === "monthly_plan"
      ? `Changed the payment method to Monthly Plan (${termYears} year${termYears === 1 ? "" : "s"})`
      : "Changed the payment method to Bacs";

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Changed payment method — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
  revalidateQuote(quoteId);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// Boiler units
// ─────────────────────────────────────────────────────────────────────────

export async function createBoilerUnit(
  quoteId: string,
  unit: Omit<BoilerUnit, "id">,
  customerName: string,
): Promise<BoilerUnit | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const sortOrder = await nextSortOrder("boiler_units", quoteId);

  const { data, error } = await supabase
    .from("boiler_units")
    .insert({
      quote_id: quoteId,
      label: unit.label,
      make: unit.make,
      model: unit.model,
      output_kw: unit.outputKw,
      fuel_type: unit.fuelType,
      flue_type: unit.flueType,
      install_type: unit.installType,
      cylinder_litres: unit.cylinderLitres ?? null,
      warranty_years: unit.warrantyYears,
      price: unit.price,
      items: serializeLineItems(unit.items),
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createBoilerUnit failed", error);
    return null;
  }

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description: `Added boiler unit "${unit.label}"` }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Added boiler unit "${unit.label}" — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
    syncQuoteAmount(quoteId),
  ]);
  revalidateQuote(quoteId);
  return { ...unit, id: data.id as string };
}

export async function updateBoilerUnit(quoteId: string, unit: BoilerUnit, customerName: string): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error } = await supabase
    .from("boiler_units")
    .update({
      label: unit.label,
      make: unit.make,
      model: unit.model,
      output_kw: unit.outputKw,
      fuel_type: unit.fuelType,
      flue_type: unit.flueType,
      install_type: unit.installType,
      cylinder_litres: unit.cylinderLitres ?? null,
      warranty_years: unit.warrantyYears,
      price: unit.price,
      items: serializeLineItems(unit.items),
    })
    .eq("id", unit.id);

  if (error) {
    console.error("updateBoilerUnit failed", error);
    return false;
  }

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description: `Updated boiler unit "${unit.label}"` }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Updated boiler unit "${unit.label}" — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
    syncQuoteAmount(quoteId),
  ]);
  revalidateQuote(quoteId);
  return true;
}

export async function deleteBoilerUnit(quoteId: string, unitId: string, unitLabel: string, customerName: string): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error } = await supabase.from("boiler_units").delete().eq("id", unitId);
  if (error) {
    console.error("deleteBoilerUnit failed", error);
    return false;
  }

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description: `Removed boiler unit "${unitLabel}"` }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Removed boiler unit "${unitLabel}" — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
    syncQuoteAmount(quoteId),
  ]);
  revalidateQuote(quoteId);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// Solar arrays
// ─────────────────────────────────────────────────────────────────────────

export async function createSolarArray(
  quoteId: string,
  array: Omit<SolarArray, "id">,
  customerName: string,
): Promise<SolarArray | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const sortOrder = await nextSortOrder("solar_arrays", quoteId);

  const { data, error } = await supabase
    .from("solar_arrays")
    .insert({
      quote_id: quoteId,
      label: array.label,
      shade_factor: array.shadeFactor,
      orientation: array.orientation,
      pitch_degrees: array.pitchDegrees,
      items: serializeLineItems(array.items),
      sort_order: sortOrder,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createSolarArray failed", error);
    return null;
  }

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description: `Added solar array "${array.label}"` }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Added solar array "${array.label}" — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
    syncQuoteAmount(quoteId),
  ]);
  revalidateQuote(quoteId);
  return { ...array, id: data.id as string };
}

export async function updateSolarArray(quoteId: string, array: SolarArray, customerName: string): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error } = await supabase
    .from("solar_arrays")
    .update({
      label: array.label,
      shade_factor: array.shadeFactor,
      orientation: array.orientation,
      pitch_degrees: array.pitchDegrees,
      items: serializeLineItems(array.items),
    })
    .eq("id", array.id);

  if (error) {
    console.error("updateSolarArray failed", error);
    return false;
  }

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description: `Updated solar array "${array.label}"` }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Updated solar array "${array.label}" — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
    syncQuoteAmount(quoteId),
  ]);
  revalidateQuote(quoteId);
  return true;
}

export async function deleteSolarArray(
  quoteId: string,
  arrayId: string,
  arrayLabel: string,
  customerName: string,
): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error } = await supabase.from("solar_arrays").delete().eq("id", arrayId);
  if (error) {
    console.error("deleteSolarArray failed", error);
    return false;
  }

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description: `Removed solar array "${arrayLabel}"` }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Removed solar array "${arrayLabel}" — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
    syncQuoteAmount(quoteId),
  ]);
  revalidateQuote(quoteId);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// Line items — quote_line_items, shared by Extras / Standard Additionals /
// Free-text Extras across both product verticals.
// ─────────────────────────────────────────────────────────────────────────

const SECTION_LABELS: Record<LineItemSection, string> = {
  extra: "extra",
  standard_additional: "standard additional",
  free_text: "free-text extra",
};

export async function createQuoteLineItem(
  quoteId: string,
  section: LineItemSection,
  data: { name: string; quantity: number; unitPrice: number },
  customerName: string,
): Promise<LineItem | FreeTextExtra | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const sortOrder = await nextSortOrder("quote_line_items", quoteId, { column: "section", value: section });

  const isFreeText = section === "free_text";
  const { data: row, error } = await supabase
    .from("quote_line_items")
    .insert({
      quote_id: quoteId,
      section,
      name: isFreeText ? null : data.name,
      description: isFreeText ? data.name : null,
      quantity: data.quantity,
      unit_price: data.unitPrice,
      sort_order: sortOrder,
    })
    .select("id, section, name, description, quantity, unit_price, sort_order")
    .single();

  if (error || !row) {
    console.error("createQuoteLineItem failed", error);
    return null;
  }

  await Promise.all([
    insertQuoteHistory({
      quoteId,
      actorId: user?.id,
      description: `Added ${SECTION_LABELS[section]} "${data.name}"`,
    }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Added ${SECTION_LABELS[section]} "${data.name}" — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
    syncQuoteAmount(quoteId),
  ]);
  revalidateQuote(quoteId);

  const typedRow = row as LineItemRow;
  return isFreeText ? mapFreeTextRow(typedRow) : mapLineItemRow(typedRow);
}

export async function updateQuoteLineItem(
  quoteId: string,
  itemId: string,
  section: LineItemSection,
  data: { name: string; quantity: number; unitPrice: number },
  customerName: string,
): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const isFreeText = section === "free_text";

  const { error } = await supabase
    .from("quote_line_items")
    .update({
      name: isFreeText ? null : data.name,
      description: isFreeText ? data.name : null,
      quantity: data.quantity,
      unit_price: data.unitPrice,
    })
    .eq("id", itemId);

  if (error) {
    console.error("updateQuoteLineItem failed", error);
    return false;
  }

  await Promise.all([
    insertQuoteHistory({
      quoteId,
      actorId: user?.id,
      description: `Updated ${SECTION_LABELS[section]} "${data.name}"`,
    }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Updated ${SECTION_LABELS[section]} "${data.name}" — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
    syncQuoteAmount(quoteId),
  ]);
  revalidateQuote(quoteId);
  return true;
}

export async function deleteQuoteLineItem(
  quoteId: string,
  itemId: string,
  section: LineItemSection,
  itemLabel: string,
  customerName: string,
): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error } = await supabase.from("quote_line_items").delete().eq("id", itemId);
  if (error) {
    console.error("deleteQuoteLineItem failed", error);
    return false;
  }

  await Promise.all([
    insertQuoteHistory({
      quoteId,
      actorId: user?.id,
      description: `Removed ${SECTION_LABELS[section]} "${itemLabel}"`,
    }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Removed ${SECTION_LABELS[section]} "${itemLabel}" — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
    syncQuoteAmount(quoteId),
  ]);
  revalidateQuote(quoteId);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// Notes
// ─────────────────────────────────────────────────────────────────────────

export async function addQuoteNote(quoteId: string, body: string, customerName: string): Promise<QuoteNote | null> {
  const trimmed = body.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("quote_notes")
    .insert({ quote_id: quoteId, author_id: user.id, body: trimmed })
    .select("id, created_at")
    .single();

  if (error || !data) {
    console.error("addQuoteNote failed", error);
    return null;
  }

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user.id, description: "Left a note" }),
    logActivity({
      actorId: user.id,
      customerName,
      description: `Left a note — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
  revalidateQuote(quoteId);

  return {
    id: data.id as string,
    authorName: user.firstName,
    authorInitials: user.initials,
    timestamp: data.created_at as string,
    body: trimmed,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// There is no manual "Archive" action anymore — quotes archive themselves
// automatically once they're 5+ years old (see the read-side filter in
// src/data/quotes-service.ts). The `quotes.archived_at` column is kept for
// a possible future manual override, just nothing writes to it today.
// ─────────────────────────────────────────────────────────────────────────
// Action button grid — Send Quote / Warranty / STAX / Survey / Cancel App /
// Pitch Outcome. Rebook App and View Quote are plain `href` navigation
// (see BoilerQuoteDetail.tsx / SolarQuoteDetail.tsx) and need no action.
// ─────────────────────────────────────────────────────────────────────────

export type SendQuoteResult = { ok: true } | { ok: false; error: string };

/**
 * Sends the quote to the customer for a self-hosted e-signature (see
 * `src/data/signature-service.ts` — replaced Dropbox Sign). Locks a
 * document snapshot, creates a `/sign/[token]` link, and emails it via
 * Resend. Re-fetches the quote server-side inside `createSignatureRequest`
 * instead of trusting client-passed strings, since the customer's email is
 * load-bearing (it's who the signing link gets sent to).
 */
export async function sendQuote(quoteId: string): Promise<SendQuoteResult> {
  if (!isResendConfigured()) {
    return {
      ok: false,
      error: "Email sending isn't configured yet. Ask an admin to set up Resend (see .env.local.example).",
    };
  }

  const request = await createSignatureRequest(quoteId);
  if ("error" in request) return { ok: false, error: request.error };
  const { accessToken, snapshot, signerEmail } = request;

  const origin = await getSiteOrigin();
  const signLink = `${origin}/sign/${accessToken}`;

  try {
    await sendEmail({
      to: signerEmail,
      subject: `Your Margav Heating quote (${snapshot.reference}) is ready to sign`,
      text:
        `Hi ${snapshot.customerName},\n\n` +
        `Your ${snapshot.productTypeLabel} quote (${snapshot.reference}, ${snapshot.totalPriceLabel}) is ready to review and sign:\n\n` +
        `${signLink}\n\n` +
        `This link is unique to you — please don't share it.\n\n` +
        `Margav Heating`,
      html: signQuoteEmailHtml({
        customerName: snapshot.customerName,
        reference: snapshot.reference,
        totalPriceLabel: snapshot.totalPriceLabel,
        productTypeLabel: snapshot.productTypeLabel,
        signLink,
      }),
    });
  } catch (error) {
    console.error("sendQuote: email send failed", error);
    return { ok: false, error: "Couldn't email the signing link. Please try again or contact support." };
  }

  const user = await getCurrentUser();
  const customerName = snapshot.customerName;

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description: "Sent the quote for e-signature" }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Sent quote for signature — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
  revalidateQuote(quoteId);
  return { ok: true };
}

/**
 * Sends the fixed "Boiler Installation Agreement" T&Cs document (see
 * `assets/agreement-templates/boiler-installation-agreement.pdf`) to the
 * customer for signature. The rep's side is filled in automatically from
 * their saved Settings signature once the customer signs — see
 * `src/data/signature-service.ts`'s `submitSignature`. Boiler-only, since
 * the document itself is boiler-specific.
 */
export async function sendInstallationAgreement(quoteId: string): Promise<SendQuoteResult> {
  if (!isResendConfigured()) {
    return {
      ok: false,
      error: "Email sending isn't configured yet. Ask an admin to set up Resend (see .env.local.example).",
    };
  }

  const request = await createAgreementSignatureRequest(quoteId);
  if ("error" in request) return { ok: false, error: request.error };
  const { accessToken, snapshot, signerEmail } = request;

  const origin = await getSiteOrigin();
  const signLink = `${origin}/sign/${accessToken}`;

  try {
    await sendEmail({
      to: signerEmail,
      subject: `Margav Heating — Boiler Installation Agreement to sign (${snapshot.reference})`,
      text:
        `Hi ${snapshot.customerName},\n\n` +
        `Please review and sign your Boiler Installation Agreement for quote ${snapshot.reference}:\n\n` +
        `${signLink}\n\n` +
        `This link is unique to you — please don't share it.\n\n` +
        `Margav Heating`,
      html: signAgreementEmailHtml({ customerName: snapshot.customerName, reference: snapshot.reference, signLink }),
    });
  } catch (error) {
    console.error("sendInstallationAgreement: email send failed", error);
    return { ok: false, error: "Couldn't email the signing link. Please try again or contact support." };
  }

  const user = await getCurrentUser();
  const customerName = snapshot.customerName;

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description: "Sent the installation agreement for signature" }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Sent installation agreement for signature — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
  revalidateQuote(quoteId);
  return { ok: true };
}

export async function sendCoolingOffWaiver(quoteId: string): Promise<SendQuoteResult> {
  if (!isResendConfigured()) {
    return {
      ok: false,
      error: "Email sending isn't configured yet. Ask an admin to set up Resend (see .env.local.example).",
    };
  }

  const request = await createWaiverSignatureRequest(quoteId);
  if ("error" in request) return { ok: false, error: request.error };
  const { accessToken, snapshot, signerEmail } = request;

  const origin = await getSiteOrigin();
  const signLink = `${origin}/sign/${accessToken}`;

  try {
    await sendEmail({
      to: signerEmail,
      subject: `Margav Heating — Cooling-Off Waiver to sign (${snapshot.reference})`,
      text:
        `Hi ${snapshot.customerName},\n\n` +
        `Please review and sign your Cooling-Off Waiver for quote ${snapshot.reference}:\n\n` +
        `${signLink}\n\n` +
        `This link is unique to you — please don't share it.\n\n` +
        `Margav Heating`,
      html: signWaiverEmailHtml({ customerName: snapshot.customerName, reference: snapshot.reference, signLink }),
    });
  } catch (error) {
    console.error("sendCoolingOffWaiver: email send failed", error);
    return { ok: false, error: "Couldn't email the signing link. Please try again or contact support." };
  }

  const user = await getCurrentUser();
  const customerName = snapshot.customerName;

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description: "Sent the cooling-off waiver for signature" }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Sent cooling-off waiver for signature — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
  revalidateQuote(quoteId);
  return { ok: true };
}

/**
 * Logs the activity-history entry for the "Warranty Registration" button,
 * which opens the Intergas installer portal
 * (https://www.myintergasregistration.co.uk/app/installer_login) in a new
 * tab — see `BoilerQuoteDetail.tsx`'s `onSecondaryPortalAction`.
 */
export async function logWarrantyRegistration(quoteId: string, customerName: string): Promise<void> {
  await logExternalPortalAction(quoteId, customerName, "Warranty registration submitted");
}

/** No STAX portal integration exists yet — this is that integration point. */
export async function logStaxPortalAction(quoteId: string, customerName: string): Promise<void> {
  await logExternalPortalAction(quoteId, customerName, "STAX Portal opened");
}

/** No survey-provider integration exists yet — this is that integration point. Kept for the solar vertical, which doesn't have its own survey form yet (see `requestBoilerSurvey` for boiler quotes). */
export async function logSurveyAction(quoteId: string, customerName: string): Promise<void> {
  await logExternalPortalAction(quoteId, customerName, "Survey requested");
}

/**
 * Backs the boiler "Survey" button — creates (or reuses) the on-site survey
 * record for this quote and returns its access token so the caller can
 * build the `/survey/[token]` QR code / link. See
 * `src/data/boiler-survey-service.ts` and `supabase/migrations/0007_boiler_surveys.sql`.
 */
export async function requestBoilerSurvey(quoteId: string, customerName: string): Promise<{ accessToken: string }> {
  const { accessToken, created } = await getOrCreateBoilerSurveyToken(quoteId);

  if (created) {
    await logExternalPortalAction(quoteId, customerName, "Survey link generated");
  }

  return { accessToken };
}

async function logExternalPortalAction(quoteId: string, customerName: string, description: string): Promise<void> {
  const user = await getCurrentUser();
  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `${description} — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
  revalidateQuote(quoteId);
}

/**
 * Quotes have no hard FK to the appointments table in this schema (that
 * module is owned by a different agent), so "Cancel App" is treated as a
 * quote-level status action instead of touching an appointment row.
 */
export async function cancelQuoteAppointment(quoteId: string, customerName: string): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error } = await supabase.from("quotes").update({ install_status: "cancelled" }).eq("id", quoteId);
  if (error) {
    console.error("cancelQuoteAppointment failed", error);
    return false;
  }

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description: "Cancelled the appointment" }),
    logActivity({
      actorId: user?.id,
      customerName,
      description: `Cancelled appointment — ${customerName}`,
      status: "cancelled",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
  revalidateQuote(quoteId);
  return true;
}

export async function recordPitchOutcome(
  quoteId: string,
  outcome: string,
  customerName: string,
): Promise<QuoteNote | null> {
  return addQuoteNote(quoteId, `Pitch outcome: ${outcome}`, customerName);
}
