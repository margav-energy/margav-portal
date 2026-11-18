import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Paths per request - keeps each request body small while still turning ~150 round trips into a couple. */
const SIGN_BATCH_SIZE = 100;

/**
 * Signs many Storage paths with one request per `SIGN_BATCH_SIZE` instead of one
 * request per file. A quote page with a few dozen survey files and checklist
 * photos used to fire 150+ separate sign calls at once, which is what made it
 * slow (and, under load, time out). Paths that fail to sign are simply absent
 * from the result.
 */
export async function signStoragePaths(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the server client and the service-role client resolve to different generic instantiations.
  supabase: SupabaseClient<any>,
  bucket: string,
  paths: string[],
  expiresInSeconds = 60 * 60,
): Promise<Map<string, string>> {
  const signed = new Map<string, string>();
  const unique = [...new Set(paths)];
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += SIGN_BATCH_SIZE) batches.push(unique.slice(i, i + SIGN_BATCH_SIZE));

  await Promise.all(
    batches.map(async (batch) => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(batch, expiresInSeconds);
      if (error || !data) {
        console.error("signStoragePaths failed", error);
        return;
      }
      for (const entry of data) {
        if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
        else if (entry.error) console.error("signStoragePaths: could not sign", entry.path, entry.error);
      }
    }),
  );
  return signed;
}

/**
 * Turns a signed (display) URL into one that downloads under `fileName`. The
 * Storage client does exactly this - it appends `download=<name>` to the signed
 * URL after signing, the signature itself doesn't cover it - so no second
 * signing request is needed.
 */
export function asDownloadUrl(signedUrl: string, fileName?: string): string {
  return `${signedUrl}${signedUrl.includes("?") ? "&" : "?"}download=${fileName ? encodeURIComponent(fileName) : ""}`;
}
