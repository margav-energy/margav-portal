import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Dropbox Sign calls this once a quote sent via "Send Quote"
 * (src/components/quotes/actions.ts → sendQuote) is fully signed, so the
 * portal can flip it to "Signed" with no manual step. First Route Handler
 * in this app — a plain HTTP endpoint, not a Server Action, since an
 * external service (not a signed-in user) is calling it. Exempted from the
 * login gate in src/lib/supabase/proxy.ts.
 *
 * There is no Supabase session on an inbound webhook, so this uses the
 * service-role client (src/lib/supabase/service.ts) and writes directly to
 * `quote_history`/`activities`/`notifications`, matching the pattern
 * already established by src/app/survey/[token]/actions.ts, rather than
 * the session-bound helpers in src/components/quotes/actions.ts.
 *
 * Payload/verification mechanics below are per Dropbox Sign's current
 * official docs (events-and-callbacks walkthrough), confirmed during
 * planning — not guessed:
 *   - multipart/form-data with a single `json` field holding the event as
 *     a JSON string.
 *   - authenticity: event_hash = HMAC-SHA256(key = API key,
 *     message = event.event_time + event.event_type), hex digest.
 *   - every callback (including the dashboard's one-off "test" button)
 *     must get back HTTP 200 with the literal body "Hello API Event
 *     Received", Content-Type: text/plain — anything else and Dropbox
 *     Sign treats delivery as failed and retries repeatedly.
 */

const SUCCESS_BODY = "Hello API Event Received";

function successResponse(): Response {
  return new Response(SUCCESS_BODY, { status: 200, headers: { "Content-Type": "text/plain" } });
}

interface DropboxSignEvent {
  event_type?: string;
  event_time?: string;
  event_hash?: string;
}

interface DropboxSignWebhookPayload {
  event?: DropboxSignEvent;
  signature_request?: {
    metadata?: Record<string, unknown> | null;
  };
}

function isValidEventHash(event: DropboxSignEvent, apiKey: string): boolean {
  if (!event.event_hash || !event.event_time || !event.event_type) return false;

  const expected = createHmac("sha256", apiKey)
    .update(event.event_time + event.event_type)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(event.event_hash, "utf8");
  if (expectedBuffer.length !== actualBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.DROPBOX_SIGN_API_KEY;
  if (!apiKey) {
    console.error("dropbox-sign webhook: DROPBOX_SIGN_API_KEY is not set — cannot verify callback authenticity.");
    return new Response("Not configured", { status: 500 });
  }

  let payload: DropboxSignWebhookPayload;
  try {
    const formData = await request.formData();
    const raw = formData.get("json");
    if (typeof raw !== "string") throw new Error("Missing 'json' form field.");
    payload = JSON.parse(raw) as DropboxSignWebhookPayload;
  } catch (error) {
    console.error("dropbox-sign webhook: failed to parse request body", error);
    return new Response("Bad request", { status: 400 });
  }

  const event = payload.event;
  if (!event || !isValidEventHash(event, apiKey)) {
    console.error("dropbox-sign webhook: event_hash verification failed — rejecting.");
    return new Response("Unauthorized", { status: 401 });
  }

  if (event.event_type === "signature_request_all_signed") {
    const quoteId = payload.signature_request?.metadata?.quoteId;
    if (typeof quoteId === "string" && quoteId) {
      await markQuoteSigned(quoteId);
    } else {
      console.error("dropbox-sign webhook: signature_request_all_signed with no metadata.quoteId", payload);
    }
  }

  // Every other event type (e.g. individual-signer-completed, declined,
  // downloadable) is accepted but intentionally not acted on yet.
  return successResponse();
}

async function markQuoteSigned(quoteId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: quote, error: fetchError } = await supabase
    .from("quotes")
    .select("customer_name, representative_id")
    .eq("id", quoteId)
    .maybeSingle();

  if (fetchError) {
    console.error("dropbox-sign webhook: failed to look up quote", quoteId, fetchError);
    return;
  }
  if (!quote) {
    console.error("dropbox-sign webhook: signed event for unknown quote id", quoteId);
    return;
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ stage: "signed", signed_date: new Date().toISOString().slice(0, 10) })
    .eq("id", quoteId);

  if (updateError) {
    console.error("dropbox-sign webhook: failed to update quote", quoteId, updateError);
    return;
  }

  const description = "The customer signed via Dropbox Sign";
  await Promise.all([
    supabase.from("quote_history").insert({ quote_id: quoteId, is_system: true, description }),
    supabase.from("activities").insert({
      is_system: true,
      customer_name: quote.customer_name,
      description: `${description} — ${quote.customer_name}`,
      status: "allocated",
      entity_type: "quote",
      entity_id: quoteId,
    }),
    quote.representative_id
      ? supabase.from("notifications").insert({
          user_id: quote.representative_id,
          title: "Quote signed",
          body: `${quote.customer_name}'s quote has been signed.`,
        })
      : Promise.resolve(),
  ]);

  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
}
