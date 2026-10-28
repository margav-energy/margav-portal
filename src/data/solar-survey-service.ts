import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { canViewCustomerPhone, type CurrentUser } from "@/data/current-user";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { mapSolarPropertyDetails } from "@/data/quotes-mappers";
import { splitCustomerName, splitSolarSurveyAddress } from "@/lib/solar-survey-address";
import { SOLAR_SURVEY_BUCKET } from "@/lib/solar-survey-bucket";
import {
  normalizeSolarSurveyAnswers,
  type SolarSurveyAnswers,
  type SolarSurveyDetail,
  type SolarSurveyFile,
  type SolarSurveyJobContext,
  type SolarSurveyStatus,
} from "@/types/solar-survey";

export { SOLAR_SURVEY_BUCKET };

const SURVEY_COLUMNS = "id, quote_id, access_token, status, submitted_at, answers";

interface SurveyRow {
  id: string;
  quote_id: string;
  access_token: string;
  status: SolarSurveyStatus;
  submitted_at: string | null;
  answers: unknown;
}

// ─────────────────────────────────────────────────────────────────────────
// Portal side (authenticated) — used from the quote detail page.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Called when a rep clicks "Survey" on a solar quote. Reuses the existing row
 * for that quote if there is one (one survey per quote), otherwise creates a
 * fresh one, and returns its access token for the launch-form QR code / link.
 */
export async function getOrCreateSolarSurveyToken(
  quoteId: string,
): Promise<{ accessToken: string; status: SolarSurveyStatus; created: boolean }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("solar_surveys")
    .select("access_token, status")
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (existing) {
    return { accessToken: existing.access_token, status: existing.status as SolarSurveyStatus, created: false };
  }

  const { data, error } = await supabase
    .from("solar_surveys")
    .insert({ quote_id: quoteId })
    .select("access_token, status")
    .single();

  if (error || !data) {
    throw new Error(`getOrCreateSolarSurveyToken failed: ${error?.message ?? "no row returned"}`);
  }

  return { accessToken: data.access_token, status: data.status as SolarSurveyStatus, created: true };
}

/** For the "Survey" card on the solar quote detail page. Returns `undefined` if "Survey" has never been clicked for this quote. */
export async function getSolarSurveyForQuote(quoteId: string): Promise<SolarSurveyDetail | undefined> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("solar_surveys")
    .select(SURVEY_COLUMNS)
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (error) console.error("getSolarSurveyForQuote failed", error);
  if (!row) return undefined;

  const surveyRow = row as SurveyRow;
  return {
    id: surveyRow.id,
    status: surveyRow.status,
    accessToken: surveyRow.access_token,
    answers: normalizeSolarSurveyAnswers(surveyRow.answers),
    files: await loadSignedFiles(supabase, surveyRow.id),
    submittedAt: surveyRow.submitted_at ?? undefined,
  };
}

async function loadSignedFiles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `createServerClient` (ssr) and `createClient` (supabase-js) both satisfy this shape but resolve to slightly different generic instantiations.
  supabase: SupabaseClient<any>,
  surveyId: string,
): Promise<SolarSurveyFile[]> {
  const { data: fileRows, error } = await supabase
    .from("solar_survey_files")
    .select("id, item_key, storage_path, file_name, content_type, size_bytes, uploaded_at")
    .eq("survey_id", surveyId)
    .order("uploaded_at", { ascending: true });

  if (error) {
    console.error("loadSignedFiles failed", error);
    return [];
  }

  const rows = (fileRows ?? []) as {
    id: string;
    item_key: string;
    storage_path: string;
    file_name: string;
    content_type: string;
    size_bytes: number | null;
    uploaded_at: string;
  }[];

  const files = await Promise.all(
    rows.map(async (row): Promise<SolarSurveyFile | null> => {
      const signedUrl = await signSolarSurveyFileUrl(supabase, row.storage_path);
      if (!signedUrl) return null;
      return {
        id: row.id,
        itemKey: row.item_key,
        fileName: row.file_name,
        contentType: row.content_type,
        sizeBytes: row.size_bytes,
        url: signedUrl,
        uploadedAt: row.uploaded_at,
      };
    }),
  );

  return files.filter((file): file is SolarSurveyFile => file !== null);
}

export async function signSolarSurveyFileUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see `loadSignedFiles`'s note above.
  supabase: SupabaseClient<any>,
  storagePath: string,
): Promise<string | undefined> {
  const { data, error } = await supabase.storage.from(SOLAR_SURVEY_BUCKET).createSignedUrl(storagePath, 60 * 60);
  if (error || !data) {
    console.error("signSolarSurveyFileUrl failed", storagePath, error);
    return undefined;
  }
  return data.signedUrl;
}

// ─────────────────────────────────────────────────────────────────────────
// Public side (unauthenticated, token-gated) — used by /survey/[token].
// ─────────────────────────────────────────────────────────────────────────

export interface PublicSolarSurvey {
  surveyId: string;
  status: SolarSurveyStatus;
  answers: SolarSurveyAnswers;
  files: SolarSurveyFile[];
  job: SolarSurveyJobContext;
}

/** First line item across the quote's arrays whose name matches `pattern` — used for the panel model and mounting system, which the quote only stores as line items. */
function findItemName(arrays: { items: unknown }[], pattern: RegExp): string {
  for (const array of arrays) {
    if (!Array.isArray(array.items)) continue;
    for (const item of array.items as { name?: unknown }[]) {
      if (typeof item?.name === "string" && pattern.test(item.name)) return item.name;
    }
  }
  return "";
}

export async function buildJobContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see `loadSignedFiles`'s note above.
  supabase: SupabaseClient<any>,
  quoteId: string,
): Promise<{ job: SolarSurveyJobContext; mpan: string }> {
  const [{ data: quote, error: quoteError }, { data: arrays }] = await Promise.all([
    supabase
      .from("quotes")
      .select(
        "id, reference, customer_name, customer_phone, customer_email, customer_address_lines, postcode, representative_id, key_details, property_details",
      )
      .eq("id", quoteId)
      .maybeSingle(),
    supabase.from("solar_arrays").select("items").eq("quote_id", quoteId).order("sort_order", { ascending: true }),
  ]);

  if (quoteError) console.error("solar buildJobContext quote lookup failed", quoteError);

  let repName = "Unassigned";
  if (quote?.representative_id) {
    const { data: rep } = await supabase.from("profiles").select("full_name").eq("id", quote.representative_id).maybeSingle();
    repName = rep?.full_name || repName;
  }

  const panels = Number((quote?.key_details as { panels?: unknown } | null)?.panels);

  return {
    job: {
      quoteId: quote?.id ?? "",
      reference: quote?.reference || quote?.id || "",
      repName,
      customerName: quote?.customer_name ?? "",
      phone: quote?.customer_phone ?? "",
      email: quote?.customer_email ?? "",
      addressLines: quote?.customer_address_lines ?? [],
      ...splitCustomerName(quote?.customer_name ?? ""),
      address: splitSolarSurveyAddress(quote?.customer_address_lines ?? [], quote?.postcode ?? ""),
      panelModel: findItemName((arrays ?? []) as { items: unknown }[], /panel/i),
      mountingSystem: findItemName((arrays ?? []) as { items: unknown }[], /mounting|fastensol|framework|roof ?kit/i),
      panelQuantity: Number.isFinite(panels) && panels > 0 ? panels : null,
    },
    mpan: quote ? mapSolarPropertyDetails(quote.property_details).mpan : "",
  };
}

/**
 * Looks up a solar survey by its unguessable `access_token`. Returns
 * `undefined` for an unknown token — the page then falls back to the boiler
 * survey lookup, and ultimately a generic "link not found" state.
 *
 * Pre-fills the MPAN from the quote's property details when the survey hasn't
 * got one yet, so the customer isn't asked for something the rep already has.
 */
export async function getPublicSolarSurvey(token: string): Promise<PublicSolarSurvey | undefined> {
  if (!token) return undefined;
  const supabase = createServiceRoleClient();

  const { data: row, error } = await supabase.from("solar_surveys").select(SURVEY_COLUMNS).eq("access_token", token).maybeSingle();

  if (error) console.error("getPublicSolarSurvey failed", error);
  if (!row) return undefined;

  const surveyRow = row as SurveyRow;
  const [{ job, mpan }, files] = await Promise.all([
    buildJobContext(supabase, surveyRow.quote_id),
    loadSignedFiles(supabase, surveyRow.id),
  ]);

  const answers = normalizeSolarSurveyAnswers(surveyRow.answers);
  if (!answers.mpan && mpan) answers.mpan = mpan;

  return { surveyId: surveyRow.id, status: surveyRow.status, answers, files, job };
}

// ─────────────────────────────────────────────────────────────────────────
// Staff tools (PDF / ZIP / online view / gallery) — authenticated.
// ─────────────────────────────────────────────────────────────────────────

/**
 * The survey plus its job context for one quote, for the "Survey" modal's
 * tools. RLS lets every signed-in user read every survey, so the rep
 * ownership rule (a rep only sees their own quotes — see
 * `assertQuoteOwnedByUser`) is enforced here. Returns `undefined` for a
 * missing quote, a quote the rep doesn't own, or a quote with no survey yet,
 * which callers treat as a 404.
 */
export async function getSolarSurveyBundle(
  quoteId: string,
  user: CurrentUser,
): Promise<{ survey: SolarSurveyDetail; job: SolarSurveyJobContext } | undefined> {
  const supabase = await createClient();

  const { data: quote } = await supabase.from("quotes").select("representative_id").eq("id", quoteId).maybeSingle();
  if (!quote) return undefined;
  if (user.role === "rep" && quote.representative_id !== user.id) return undefined;

  const survey = await getSolarSurveyForQuote(quoteId);
  if (!survey) return undefined;

  const { job } = await buildJobContext(supabase, quoteId);
  if (!canViewCustomerPhone(user)) job.phone = "";
  return { survey, job };
}

export interface SolarSurveyFileBytes {
  id: string;
  itemKey: string;
  fileName: string;
  contentType: string;
  bytes: Buffer;
}

/** Downloads every uploaded file's raw bytes, for the PDF (embedded photos) and the ZIP. */
export async function loadSolarSurveyFileBytes(surveyId: string): Promise<SolarSurveyFileBytes[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("solar_survey_files")
    .select("id, item_key, storage_path, file_name, content_type")
    .eq("survey_id", surveyId)
    .order("uploaded_at", { ascending: true });

  if (error) {
    console.error("loadSolarSurveyFileBytes failed", error);
    return [];
  }

  const files = await Promise.all(
    ((rows ?? []) as { id: string; item_key: string; storage_path: string; file_name: string; content_type: string }[]).map(
      async (row): Promise<SolarSurveyFileBytes | null> => {
        const { data, error: downloadError } = await supabase.storage.from(SOLAR_SURVEY_BUCKET).download(row.storage_path);
        if (downloadError || !data) {
          console.error("loadSolarSurveyFileBytes: download failed", row.storage_path, downloadError);
          return null;
        }
        return {
          id: row.id,
          itemKey: row.item_key,
          fileName: row.file_name || row.id,
          contentType: row.content_type,
          bytes: Buffer.from(await data.arrayBuffer()),
        };
      },
    ),
  );
  return files.filter((file): file is SolarSurveyFileBytes => file !== null);
}
