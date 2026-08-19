import "server-only";
import {
  SignatureRequestApi,
  type SignatureRequestSendWithTemplateRequest,
  type SubCustomField,
} from "@dropbox/sign";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Quote } from "@/types/quote";
import type { BoilerQuoteDetail } from "@/types/boiler-quote";
import type { SolarQuoteDetail } from "@/types/solar-quote";

/**
 * Powers "Send Quote" (`src/components/quotes/actions.ts` → `sendQuote`) —
 * sends a quote to the customer for e-signature via a shared Dropbox Sign
 * Template (one template covers both boiler and solar quotes). Mirrors
 * `src/lib/cloudconvert.ts`'s "fail loudly with a helpful message" pattern.
 *
 * There is no in-app PDF/quote-document generation, so this relies on a
 * Template built manually in the Dropbox Sign dashboard with a signer role
 * named exactly "Client" and the custom fields listed in `buildMergeFields`
 * below (field names there must match the template's field names exactly).
 */

export function isDropboxSignConfigured(): boolean {
  return Boolean(process.env.DROPBOX_SIGN_API_KEY && process.env.DROPBOX_SIGN_TEMPLATE_ID);
}

function getApiKey(): string {
  const key = process.env.DROPBOX_SIGN_API_KEY;
  if (!key) {
    throw new Error(
      "Missing DROPBOX_SIGN_API_KEY. Copy .env.local.example to .env.local and add a Dropbox Sign " +
        "API key (sign up at https://app.hellosign.com, then Settings → API).",
    );
  }
  return key;
}

function getTemplateId(): string {
  const id = process.env.DROPBOX_SIGN_TEMPLATE_ID;
  if (!id) {
    throw new Error(
      "Missing DROPBOX_SIGN_TEMPLATE_ID. Copy .env.local.example to .env.local and add your Dropbox " +
        "Sign template's ID (dashboard → Templates → your template → Details).",
    );
  }
  return id;
}

/** Test-mode requests don't count against quota and don't need a real signature to complete — defaults on until explicitly turned off via `.env`. */
function isTestMode(): boolean {
  return process.env.DROPBOX_SIGN_TEST_MODE !== "false";
}

function productTypeLabel(productType: Quote["productType"]): string {
  return productType === "boiler" ? "Boiler" : "Solar PV";
}

function paymentMethodLabel(detail: BoilerQuoteDetail | SolarQuoteDetail): string {
  if (detail.selectedPaymentMethod === "monthly_plan") {
    const years = detail.monthlyPlanTermYears;
    return years ? `Monthly Plan (${years} years)` : "Monthly Plan";
  }
  return "BACS";
}

/**
 * The exact set of custom fields the shared Dropbox Sign Template must
 * define (case-sensitive names) — see the integration plan for the full
 * spec handed to whoever builds that template.
 */
export function buildMergeFields(quote: Quote, detail: BoilerQuoteDetail | SolarQuoteDetail): SubCustomField[] {
  const lineItems = detail.pricingBreakdown
    .map((item) => `${item.name}: ${formatCurrency(item.quantity * item.unitPrice)}`)
    .join("\n");

  const fields: Record<string, string> = {
    customer_name: detail.customer.name,
    customer_address: detail.customer.addressLines.join(", "),
    quote_reference: detail.reference,
    product_type: productTypeLabel(quote.productType),
    total_price: formatCurrency(quote.amount),
    payment_method: paymentMethodLabel(detail),
    key_line_items: lineItems,
    sent_date: formatDate(quote.sentDate),
  };

  return Object.entries(fields).map(([name, value]) => ({ name, value }));
}

export interface SendQuoteForSignatureParams {
  quoteId: string;
  signerName: string;
  signerEmail: string;
  customFields: SubCustomField[];
}

/** Returns the new signature request's id (for audit/support lookup — the webhook does not depend on it, see `metadata` below). */
export async function sendQuoteForSignature(params: SendQuoteForSignatureParams): Promise<string> {
  const apiCaller = new SignatureRequestApi();
  apiCaller.username = getApiKey();

  const request: SignatureRequestSendWithTemplateRequest = {
    templateIds: [getTemplateId()],
    signers: [{ role: "Client", name: params.signerName, emailAddress: params.signerEmail }],
    customFields: params.customFields,
    metadata: { quoteId: params.quoteId },
    testMode: isTestMode(),
  };

  const response = await apiCaller.signatureRequestSendWithTemplate(request);
  const signatureRequestId = response.body.signatureRequest.signatureRequestId;
  if (!signatureRequestId) {
    throw new Error("Dropbox Sign accepted the request but returned no signature_request_id.");
  }
  return signatureRequestId;
}
