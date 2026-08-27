import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Serves the static Cooling-Off Waiver template so `/sign/[token]` (public,
 * unauthenticated) can link/embed it — the template itself has no
 * customer-specific data (see `src/lib/esignature/waiver-pdf.tsx`), so
 * serving it without a token is fine. Exempted from the login gate via
 * `PUBLIC_PATHS` in `src/lib/supabase/proxy.ts`.
 */
export async function GET() {
  const filePath = path.join(process.cwd(), "assets", "agreement-templates", "cooling-off-waiver.pdf");
  const bytes = await readFile(filePath);

  return new Response(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Margav-Cooling-Off-Waiver.pdf"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
