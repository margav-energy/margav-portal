import "server-only";
import { Resend } from "resend";

/**
 * Powers the "Communications" button on a quote's detail page
 * (`src/components/quotes/actions.ts` → `sendCommunicationEmail`) — the one
 * flow in the portal that sends a real email to a customer. Mirrors
 * `src/lib/dropbox-sign.ts`'s "fail loudly with a helpful message" pattern.
 *
 * Every email sends from this one address regardless of who's logged in —
 * Margav's instruction was that all portal email comes from Lucy.
 */
export const EMAIL_FROM = "Margav Energy <lucy@margav.energy>";

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

let client: Resend | undefined;

function getClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing RESEND_API_KEY. Copy .env.local.example to .env.local and add a Resend API key " +
        "(sign up at https://resend.com, verify the margav.energy domain, then create a key under API Keys).",
    );
  }
  // Cached across calls within the same server process — the API key can't
  // change without a restart, so there's no reason to rebuild this per send.
  client ??= new Resend(apiKey);
  return client;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  /** Plain text — the Communications modal only collects a plain message, no rich text/HTML editor yet. */
  text: string;
}

/** Returns the provider's message id (for audit/support lookup). */
export async function sendEmail(params: SendEmailParams): Promise<string> {
  const resend = getClient();

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    text: params.text,
  });

  if (error || !data) {
    throw new Error(`Resend failed to send: ${error?.message ?? "no message id returned"}`);
  }

  return data.id;
}
