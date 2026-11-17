import { buildSolarAgreementPdf } from "@/lib/esignature/solar-agreement-pdf";

/**
 * Serves the unsigned Solar PV Installation Agreement so `/sign/[token]` (public, unauthenticated) and the quote page can
 * link to it. The wording has nothing customer-specific (the customer's name only appears on the signature page once they
 * sign), so serving it without a token is fine — same as the boiler agreement route. Exempted from the login gate via
 * `PUBLIC_PATHS` in `src/lib/supabase/proxy.ts`.
 */
// The unsigned agreement never changes between requests, so it is built once per server instance rather than on every hit.
let cached: Promise<Buffer> | undefined;

export async function GET() {
  cached ??= buildSolarAgreementPdf({ quoteId: "", reference: "", customerName: "", customerAddressLines: [] }).catch((error) => {
    cached = undefined;
    throw error;
  });
  const bytes = await cached;

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Margav-Solar-PV-Installation-Agreement.pdf"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
