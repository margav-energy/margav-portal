"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/data/current-user";
import { getProfileById } from "@/data/profiles-service";
import { getOrCreateBoilerSurveyToken } from "@/data/boiler-survey-service";
import { getQuoteDetail } from "@/data/quotes-service";
import { buildMergeFields, isDropboxSignConfigured, sendQuoteForSignature } from "@/lib/dropbox-sign";
import { isResendConfigured, sendEmail } from "@/lib/resend";
import { logActivity } from "@/lib/activity";
import { notifyUser } from "@/lib/notify";
import { formatCurrency } from "@/lib/format";
import {
  mapFreeTextRow,
  mapLineItemRow,
  serializeLineItems,
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
  const customerName = input.customerName.trim();
  if (!customerName) return { error: "Customer name is required." };

  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      customer_name: customerName,
      postcode: input.postcode.trim(),
      address: input.address.trim(),
      customer_address_lines: buildCustomerAddressLines(input.address, input.postcode),
      product_type: input.productType,
      amount: input.amount,
      payment_type: input.paymentType,
      pipeline_status: "new_lead",
      sent_date: new Date().toISOString().slice(0, 10),
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createQuote failed", error);
    return { error: "Could not create the quote. Please try again." };
  }

  await insertQuoteHistory({
    quoteId: data.id,
    actorId: user?.id,
    description: `${user?.firstName ?? "Someone"} created this quote`,
  });
  await logActivity({
    actorId: user?.id,
    customerName,
    description: `${user?.firstName ?? "Someone"} created a new quote for ${customerName}`,
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
  const customerName = input.customerName.trim();
  if (!customerName) return { error: "Customer name is required." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      appointment_id: input.appointmentId,
      customer_name: customerName,
      customer_email: input.customerEmail || null,
      customer_phone: input.customerPhone || null,
      postcode: input.postcode.trim(),
      address: input.address.trim(),
      customer_address_lines: buildCustomerAddressLines(input.address, input.postcode),
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

export async function assignQuoteRepresentative(
  quoteId: string,
  repId: string,
  customerName: string,
): Promise<{ repId: string; repName: string } | null> {
  const supabase = await createClient();
  const [user, rep] = await Promise.all([getCurrentUser(), getProfileById(repId)]);
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

  const { error } = await supabase
    .from("quotes")
    .update({
      customer_name: customer.name,
      customer_email: customer.email || null,
      customer_phone: customer.phone || null,
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
      customerName: customer.name,
      description: `Updated customer details — ${customer.name}`,
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
 * The only value a rep enters for the Profit card — `sellPrice` always
 * mirrors the Pricing card's total instead of being stored (see
 * `buildProfitBreakdown` in `src/data/quotes-mappers.ts`), so this is the
 * one write needed to make `profit`/`marginPercent` calculate.
 */
export async function updateQuoteCostPrice(
  quoteId: string,
  costPrice: number,
  customerName: string,
): Promise<boolean> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error } = await supabase
    .from("quotes")
    .update({ profit_breakdown: { costPrice } })
    .eq("id", quoteId);

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
 * Sends the quote to the customer for e-signature via Dropbox Sign (see
 * `src/lib/dropbox-sign.ts`). Re-fetches the quote server-side instead of
 * trusting client-passed strings, since the customer's email is now
 * load-bearing (it's who Dropbox Sign sends the signing request to).
 */
export async function sendQuote(quoteId: string): Promise<SendQuoteResult> {
  if (!isDropboxSignConfigured()) {
    return {
      ok: false,
      error: "E-signature sending isn't configured yet. Ask an admin to set up Dropbox Sign (see .env.local.example).",
    };
  }

  const result = await getQuoteDetail(quoteId);
  if (!result) return { ok: false, error: "Quote not found." };
  const { quote, detail } = result;

  const email = detail.customer.email.trim();
  if (!email) {
    return {
      ok: false,
      error: "This customer has no email address on file. Add one on the Customer card before sending for signature.",
    };
  }

  let signatureRequestId: string;
  try {
    signatureRequestId = await sendQuoteForSignature({
      quoteId,
      signerName: detail.customer.name,
      signerEmail: email,
      customFields: buildMergeFields(quote, detail),
    });
  } catch (error) {
    console.error("sendQuote: Dropbox Sign request failed", error);
    return { ok: false, error: "Couldn't send the quote for signature. Please try again or contact support." };
  }

  const supabase = await createClient();
  const user = await getCurrentUser();

  const { error } = await supabase
    .from("quotes")
    .update({ sent_at: new Date().toISOString(), dropbox_sign_request_id: signatureRequestId })
    .eq("id", quoteId);
  if (error) console.error("sendQuote: failed to record sent_at/dropbox_sign_request_id", error);

  await Promise.all([
    insertQuoteHistory({ quoteId, actorId: user?.id, description: "Sent the quote for e-signature (Dropbox Sign)" }),
    logActivity({
      actorId: user?.id,
      customerName: detail.customer.name,
      description: `Sent quote for signature — ${detail.customer.name}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
  revalidateQuote(quoteId);
  return { ok: true };
}

/** No warranty-registration provider is integrated yet — this is that integration point. */
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
