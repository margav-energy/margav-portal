import CloudConvert from "cloudconvert";

/**
 * Powers the admin "upload a sales deck" flow (`src/app/settings/presenter-deck/`)
 * — converts an uploaded .pptx or .pdf into one PNG per slide. Mirrors
 * `src/lib/supabase/env.ts`'s "fail loudly with a helpful message" pattern.
 */

export function isCloudConvertConfigured(): boolean {
  return Boolean(process.env.CLOUDCONVERT_API_KEY);
}

export function getCloudConvertClient(): CloudConvert {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing CLOUDCONVERT_API_KEY. Copy .env.local.example to .env.local and add a CloudConvert " +
        "API key (sign up at https://cloudconvert.com, then Dashboard → API Keys).",
    );
  }
  return new CloudConvert(apiKey);
}
