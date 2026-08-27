import "server-only";
import { Resend } from "resend";

/**
 * Powers the "Communications" button and the self-hosted e-signature flow's
 * signing-link email on a quote's detail page (`src/components/quotes/actions.ts`
 * → `sendCommunicationEmail`/`sendQuote`) — this is how the portal sends
 * real emails to customers. "Fail loudly with a helpful message" if
 * unconfigured, same pattern as `src/lib/address-lookup.ts`.
 *
 * Every email sends from this one address regardless of who's logged in —
 * Margav's instruction was that all portal email comes from Lucy.
 */
export const EMAIL_FROM = "Margav Heating <lucy@margav.energy>";

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

export interface SendEmailAttachment {
  filename: string;
  content: Buffer;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  /** Plain text — always sent as the fallback for clients that don't render HTML. */
  text: string;
  /** Optional rich version (e.g. the "Sign your quote" button) — the Communications modal doesn't use this, only a plain message. */
  html?: string;
  attachments?: SendEmailAttachment[];
}

/** Returns the provider's message id (for audit/support lookup). */
export async function sendEmail(params: SendEmailParams): Promise<string> {
  const resend = getClient();

  const { data, error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    text: params.text,
    ...(params.html ? { html: params.html } : {}),
    ...(params.attachments ? { attachments: params.attachments } : {}),
  });

  if (error || !data) {
    throw new Error(`Resend failed to send: ${error?.message ?? "no message id returned"}`);
  }

  return data.id;
}
