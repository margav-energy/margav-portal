import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { renderSurveySummaryPdf, type SurveyPdfPhoto } from "@/lib/boiler-survey/pdf";
import {
  emptyBoilerSurveyAnswers,
  type BoilerSurveyAnswers,
  type BoilerSurveyDetail,
  type BoilerSurveyJobContext,
  type BoilerSurveyPhoto,
  type BoilerSurveyStatus,
  type PhotoChecklistItemKey,
} from "@/types/boiler-survey";

export const SURVEY_PHOTOS_BUCKET = "boiler-survey-photos";

/** react-pdf's `<Image>` only reliably decodes these — see `SurveyPdfPhoto.embeddable` in `src/lib/boiler-survey/pdf.tsx`. */
const PDF_EMBEDDABLE_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);

/** Every `boiler_surveys` column this module reads — kept in one place since both the authenticated and service-role paths select the same shape. */
const SURVEY_COLUMNS = `
  id, quote_id, access_token, status, submitted_at,
  property_type, property_age, occupancy, landlord_permission_confirmed, access_notes, is_hmo,
  current_boiler_make_model, current_boiler_age, current_boiler_type, current_fuel_type, known_faults,
  current_boiler_location, current_boiler_working,
  desired_boiler_location, reason_for_replacement, bedrooms, bathrooms, radiators, occupants,
  simultaneous_hot_water_demand, planned_extension,
  existing_gas_supply, gas_meter_size, current_flue_termination, flue_route_obstructions,
  mains_water_pressure, existing_cold_water_tank, low_pressure_hard_water_history, scale_reducer_required,
  fused_spur_present, smart_controls_requested,
  asbestos_concerns, responsible_person_signoff, additional_notes,
  surveyor_name, survey_date
`;

interface SurveyRow {
  id: string;
  quote_id: string;
  access_token: string;
  status: BoilerSurveyStatus;
  submitted_at: string | null;
  property_type: string | null;
  property_age: string | null;
  occupancy: string | null;
  landlord_permission_confirmed: string | null;
  access_notes: string | null;
  is_hmo: string | null;
  current_boiler_make_model: string | null;
  current_boiler_age: string | null;
  current_boiler_type: string | null;
  current_fuel_type: string | null;
  known_faults: string | null;
  current_boiler_location: string | null;
  current_boiler_working: string | null;
  desired_boiler_location: string | null;
  reason_for_replacement: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  radiators: number | null;
  occupants: number | null;
  simultaneous_hot_water_demand: string | null;
  planned_extension: string | null;
  existing_gas_supply: string | null;
  gas_meter_size: string | null;
  current_flue_termination: string | null;
  flue_route_obstructions: string | null;
  mains_water_pressure: string | null;
  existing_cold_water_tank: string | null;
  low_pressure_hard_water_history: string | null;
  scale_reducer_required: string | null;
  fused_spur_present: string | null;
  smart_controls_requested: string | null;
  asbestos_concerns: string | null;
  responsible_person_signoff: string | null;
  additional_notes: string | null;
  surveyor_name: string | null;
  survey_date: string | null;
}

function mapAnswers(row: SurveyRow): BoilerSurveyAnswers {
  return {
    propertyType: row.property_type ?? "",
    propertyAge: row.property_age ?? "",
    occupancy: row.occupancy ?? "",
    landlordPermissionConfirmed: row.landlord_permission_confirmed ?? "",
    accessNotes: row.access_notes ?? "",
    isHmo: row.is_hmo ?? "",
    currentBoilerMakeModel: row.current_boiler_make_model ?? "",
    currentBoilerAge: row.current_boiler_age ?? "",
    currentBoilerType: row.current_boiler_type ?? "",
    currentFuelType: row.current_fuel_type ?? "",
    knownFaults: row.known_faults ?? "",
    currentBoilerLocation: row.current_boiler_location ?? "",
    currentBoilerWorking: row.current_boiler_working ?? "",
    desiredBoilerLocation: row.desired_boiler_location ?? "",
    reasonForReplacement: row.reason_for_replacement ?? "",
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    radiators: row.radiators,
    occupants: row.occupants,
    simultaneousHotWaterDemand: row.simultaneous_hot_water_demand ?? "",
    plannedExtension: row.planned_extension ?? "",
    existingGasSupply: row.existing_gas_supply ?? "",
    gasMeterSize: row.gas_meter_size ?? "",
    currentFlueTermination: row.current_flue_termination ?? "",
    flueRouteObstructions: row.flue_route_obstructions ?? "",
    mainsWaterPressure: row.mains_water_pressure ?? "",
    existingColdWaterTank: row.existing_cold_water_tank ?? "",
    lowPressureHardWaterHistory: row.low_pressure_hard_water_history ?? "",
    scaleReducerRequired: row.scale_reducer_required ?? "",
    fusedSpurPresent: row.fused_spur_present ?? "",
    smartControlsRequested: row.smart_controls_requested ?? "",
    asbestosConcerns: row.asbestos_concerns ?? "",
    responsiblePersonSignoff: row.responsible_person_signoff ?? "",
    additionalNotes: row.additional_notes ?? "",
    surveyorName: row.surveyor_name ?? "",
    surveyDate: row.survey_date ?? "",
  };
}

/** camelCase `BoilerSurveyAnswers` → the snake_case column patch `submitBoilerSurvey` writes. */
export function serializeAnswersPatch(answers: BoilerSurveyAnswers): Record<string, unknown> {
  return {
    property_type: answers.propertyType || null,
    property_age: answers.propertyAge || null,
    occupancy: answers.occupancy || null,
    landlord_permission_confirmed: answers.landlordPermissionConfirmed || null,
    access_notes: answers.accessNotes || null,
    is_hmo: answers.isHmo || null,
    current_boiler_make_model: answers.currentBoilerMakeModel || null,
    current_boiler_age: answers.currentBoilerAge || null,
    current_boiler_type: answers.currentBoilerType || null,
    current_fuel_type: answers.currentFuelType || null,
    known_faults: answers.knownFaults || null,
    current_boiler_location: answers.currentBoilerLocation || null,
    current_boiler_working: answers.currentBoilerWorking || null,
    desired_boiler_location: answers.desiredBoilerLocation || null,
    reason_for_replacement: answers.reasonForReplacement || null,
    bedrooms: answers.bedrooms,
    bathrooms: answers.bathrooms,
    radiators: answers.radiators,
    occupants: answers.occupants,
    simultaneous_hot_water_demand: answers.simultaneousHotWaterDemand || null,
    planned_extension: answers.plannedExtension || null,
    existing_gas_supply: answers.existingGasSupply || null,
    gas_meter_size: answers.gasMeterSize || null,
    current_flue_termination: answers.currentFlueTermination || null,
    flue_route_obstructions: answers.flueRouteObstructions || null,
    mains_water_pressure: answers.mainsWaterPressure || null,
    existing_cold_water_tank: answers.existingColdWaterTank || null,
    low_pressure_hard_water_history: answers.lowPressureHardWaterHistory || null,
    scale_reducer_required: answers.scaleReducerRequired || null,
    fused_spur_present: answers.fusedSpurPresent || null,
    smart_controls_requested: answers.smartControlsRequested || null,
    asbestos_concerns: answers.asbestosConcerns || null,
    responsible_person_signoff: answers.responsiblePersonSignoff || null,
    additional_notes: answers.additionalNotes || null,
    surveyor_name: answers.surveyorName || null,
    survey_date: answers.surveyDate || null,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Portal side (authenticated) — used from the quote detail page.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Called when a rep clicks "Survey" on a boiler quote. Reuses the existing
 * row for that quote if one already exists (one survey per quote — see the
 * migration), otherwise creates a fresh one, and returns its access token
 * for the launch-form QR code / link.
 */
export async function getOrCreateBoilerSurveyToken(
  quoteId: string,
): Promise<{ accessToken: string; status: BoilerSurveyStatus; created: boolean }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("boiler_surveys")
    .select("access_token, status")
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (existing) {
    return { accessToken: existing.access_token, status: existing.status as BoilerSurveyStatus, created: false };
  }

  const { data, error } = await supabase
    .from("boiler_surveys")
    .insert({ quote_id: quoteId })
    .select("access_token, status")
    .single();

  if (error || !data) {
    throw new Error(`getOrCreateBoilerSurveyToken failed: ${error?.message ?? "no row returned"}`);
  }

  return { accessToken: data.access_token, status: data.status as BoilerSurveyStatus, created: true };
}

/** A short-lived signed URL to the generated survey-summary PDF (see `generateAndStoreSurveyPdf`), for the "Download survey PDF" link on the quote detail page. `undefined` until a surveyor has submitted at least once. */
export async function getSurveyDocumentUrl(quoteId: string): Promise<string | undefined> {
  const supabase = await createClient();
  const { data } = await supabase.from("boiler_surveys").select("pdf_path").eq("quote_id", quoteId).maybeSingle();

  if (!data?.pdf_path) return undefined;

  const { data: signed, error } = await supabase.storage
    .from(SURVEY_PHOTOS_BUCKET)
    .createSignedUrl(data.pdf_path, 60 * 60);

  if (error || !signed) {
    console.error("getSurveyDocumentUrl: createSignedUrl failed", error);
    return undefined;
  }
  return signed.signedUrl;
}

/**
 * Public-safe (service-role) variant of `getSurveyDocumentUrl` above, for
 * linking to the survey PDF from the customer's `/sign/[token]` page —
 * there's no authenticated session there for the normal RLS-bound client
 * (`boiler_surveys_all_authenticated`, supabase/migrations/0007_*.sql) to
 * use. Only returns a link once the survey is actually submitted — a
 * pending/part-filled survey isn't something to hand a customer.
 */
export async function getPublicSurveyDocumentUrl(quoteId: string): Promise<string | undefined> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("boiler_surveys")
    .select("pdf_path, status")
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (!data?.pdf_path || data.status !== "submitted") return undefined;

  const { data: signed, error } = await supabase.storage
    .from(SURVEY_PHOTOS_BUCKET)
    .createSignedUrl(data.pdf_path, 60 * 60);

  if (error || !signed) {
    console.error("getPublicSurveyDocumentUrl: createSignedUrl failed", error);
    return undefined;
  }
  return signed.signedUrl;
}

/** For the "Survey" card on the quote detail page. Returns `undefined` if "Survey" has never been clicked for this quote. */
export async function getBoilerSurveyForQuote(quoteId: string): Promise<BoilerSurveyDetail | undefined> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("boiler_surveys")
    .select(SURVEY_COLUMNS)
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (error) console.error("getBoilerSurveyForQuote failed", error);
  if (!row) return undefined;

  const surveyRow = row as SurveyRow;
  const photos = await loadSignedPhotos(supabase, surveyRow.id);

  return {
    id: surveyRow.id,
    status: surveyRow.status,
    accessToken: surveyRow.access_token,
    answers: mapAnswers(surveyRow),
    photos,
    submittedAt: surveyRow.submitted_at ?? undefined,
  };
}

async function loadSignedPhotos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `createServerClient` (ssr) and `createClient` (supabase-js) both satisfy this shape but resolve to slightly different generic instantiations.
  supabase: SupabaseClient<any>,
  surveyId: string,
): Promise<BoilerSurveyPhoto[]> {
  const { data: photoRows, error } = await supabase
    .from("boiler_survey_photos")
    .select("item_key, storage_path, uploaded_at")
    .eq("survey_id", surveyId);

  if (error) {
    console.error("loadSignedPhotos failed", error);
    return [];
  }

  const rows = (photoRows ?? []) as { item_key: PhotoChecklistItemKey; storage_path: string; uploaded_at: string }[];

  const photos = await Promise.all(
    rows.map(async (row) => {
      const { data: signed, error: signError } = await supabase.storage
        .from(SURVEY_PHOTOS_BUCKET)
        .createSignedUrl(row.storage_path, 60 * 60);
      if (signError || !signed) {
        console.error("createSignedUrl failed", row.storage_path, signError);
        return null;
      }
      return { itemKey: row.item_key, url: signed.signedUrl, uploadedAt: row.uploaded_at };
    }),
  );

  return photos.filter((photo): photo is BoilerSurveyPhoto => photo !== null);
}

/** Shared by `getPublicBoilerSurvey` and `generateAndStoreSurveyPdf` — looks up the owning quote + assigned rep to build the read-only job header both need. */
async function buildJobContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see `loadSignedPhotos`'s note above.
  supabase: SupabaseClient<any>,
  quoteId: string,
): Promise<BoilerSurveyJobContext> {
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, reference, customer_name, customer_phone, customer_email, customer_address_lines, representative_id")
    .eq("id", quoteId)
    .maybeSingle();

  if (quoteError) console.error("buildJobContext quote lookup failed", quoteError);

  let repName = "Unassigned";
  if (quote?.representative_id) {
    const { data: rep } = await supabase.from("profiles").select("full_name").eq("id", quote.representative_id).maybeSingle();
    repName = rep?.full_name || repName;
  }

  return {
    quoteId: quote?.id ?? "",
    reference: quote?.reference || quote?.id || "",
    repName,
    customerName: quote?.customer_name ?? "",
    phone: quote?.customer_phone ?? "",
    email: quote?.customer_email ?? "",
    addressLines: quote?.customer_address_lines ?? [],
  };
}

/** Downloads each uploaded photo's raw bytes for embedding into the survey PDF — a separate read from `loadSignedPhotos`, which only needs signed *URLs* for the portal UI. */
async function loadPhotosForPdf(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see `loadSignedPhotos`'s note above.
  supabase: SupabaseClient<any>,
  surveyId: string,
): Promise<SurveyPdfPhoto[]> {
  const { data: photoRows, error } = await supabase
    .from("boiler_survey_photos")
    .select("item_key, storage_path")
    .eq("survey_id", surveyId);

  if (error) {
    console.error("loadPhotosForPdf failed", error);
    return [];
  }

  const rows = (photoRows ?? []) as { item_key: PhotoChecklistItemKey; storage_path: string }[];

  const photos = await Promise.all(
    rows.map(async (row): Promise<SurveyPdfPhoto | null> => {
      const { data, error: downloadError } = await supabase.storage.from(SURVEY_PHOTOS_BUCKET).download(row.storage_path);
      if (downloadError || !data) {
        console.error("loadPhotosForPdf: download failed", row.storage_path, downloadError);
        return null;
      }
      const extension = row.storage_path.split(".").pop()?.toLowerCase() ?? "";
      return {
        itemKey: row.item_key,
        bytes: Buffer.from(await data.arrayBuffer()),
        embeddable: PDF_EMBEDDABLE_EXTENSIONS.has(extension),
      };
    }),
  );

  return photos.filter((photo): photo is SurveyPdfPhoto => photo !== null);
}

/**
 * Called by `submitBoilerSurvey` (`src/app/survey/[token]/actions.ts`) once
 * the on-site surveyor submits/resubmits — renders the answers + photo
 * checklist to a PDF (see `src/lib/boiler-survey/pdf.tsx`) and stores it
 * back on the same `boiler_surveys` row, the same pattern as
 * `signature-service.ts`'s signed-document PDF. Best-effort: the survey
 * answers are already saved by the time this runs, so a failure here (a
 * broken photo download, a storage hiccup) shouldn't fail the submission
 * itself — it just means "Download survey PDF" stays absent until the next
 * successful (re)submit.
 */
export async function generateAndStoreSurveyPdf(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see `loadSignedPhotos`'s note above.
  supabase: SupabaseClient<any>,
  params: { surveyId: string; quoteId: string; answers: BoilerSurveyAnswers; submittedAtLabel: string },
): Promise<void> {
  try {
    const [job, photos] = await Promise.all([
      buildJobContext(supabase, params.quoteId),
      loadPhotosForPdf(supabase, params.surveyId),
    ]);

    const pdfBuffer = await renderSurveySummaryPdf({
      job,
      answers: params.answers,
      photos,
      submittedAtLabel: params.submittedAtLabel,
    });
    const pdfPath = `${params.surveyId}/survey.pdf`;

    const { error: uploadError } = await supabase.storage
      .from(SURVEY_PHOTOS_BUCKET)
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (uploadError) {
      console.error("generateAndStoreSurveyPdf: upload failed", uploadError);
      return;
    }

    const { error: updateError } = await supabase.from("boiler_surveys").update({ pdf_path: pdfPath }).eq("id", params.surveyId);
    if (updateError) console.error("generateAndStoreSurveyPdf: failed to save pdf_path", updateError);
  } catch (error) {
    console.error("generateAndStoreSurveyPdf failed", error);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Public side (unauthenticated, token-gated) — used by /survey/[token].
// ─────────────────────────────────────────────────────────────────────────

export interface PublicBoilerSurvey {
  surveyId: string;
  status: BoilerSurveyStatus;
  answers: BoilerSurveyAnswers;
  photos: BoilerSurveyPhoto[];
  job: BoilerSurveyJobContext;
}

/**
 * Looks up a survey by its unguessable `access_token`. Returns `undefined`
 * for an unknown/expired token — the page renders a generic "link not
 * found" state, never a reason why.
 *
 * Fetches `boiler_surveys` → `quotes` → `profiles` as three separate
 * queries rather than a PostgREST relational embed, matching how
 * `quotes-service.ts` joins related tables everywhere else in this app.
 */
export async function getPublicBoilerSurvey(token: string): Promise<PublicBoilerSurvey | undefined> {
  if (!token) return undefined;
  const supabase = createServiceRoleClient();

  const { data: row, error } = await supabase
    .from("boiler_surveys")
    .select(SURVEY_COLUMNS)
    .eq("access_token", token)
    .maybeSingle();

  if (error) console.error("getPublicBoilerSurvey failed", error);
  if (!row) return undefined;

  const surveyRow = row as SurveyRow;

  const [job, photos] = await Promise.all([
    buildJobContext(supabase, surveyRow.quote_id),
    loadSignedPhotos(supabase, surveyRow.id),
  ]);

  const answers = mapAnswers(surveyRow);

  // Whoever quoted the job already captured bedrooms on the property details
  // card, before any survey exists — don't make the on-site surveyor re-enter
  // it here too if it hasn't been separately answered on the survey yet.
  if (answers.bedrooms === null) {
    const { data: quoteRow } = await supabase
      .from("quotes")
      .select("property_details")
      .eq("id", surveyRow.quote_id)
      .maybeSingle();
    const propertyBedrooms = (quoteRow?.property_details as { bedrooms?: unknown } | null)?.bedrooms;
    if (typeof propertyBedrooms === "number") answers.bedrooms = propertyBedrooms;
  }

  return {
    surveyId: surveyRow.id,
    status: surveyRow.status,
    answers,
    photos,
    job,
  };
}

export { emptyBoilerSurveyAnswers };
