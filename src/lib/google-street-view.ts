import "server-only";

/**
 * Google Maps Platform's Street View Static API — auto-fetches a photo of
 * a property from its address for a quote's Property Photo card (see
 * `src/data/property-photo-service.ts`'s `fetchStreetViewPhotoForQuote`),
 * so a rep doesn't have to take/upload one themselves.
 *
 * Add `GOOGLE_MAPS_API_KEY` to `.env.local` to enable this — see
 * `.env.local.example`. Until it's set, `isStreetViewConfigured()` returns
 * false and callers fall back to manual upload only, same as before this
 * was wired up.
 */

const STREET_VIEW_BASE_URL = "https://maps.googleapis.com/maps/api/streetview";
const IMAGE_SIZE = "640x400";

export function isStreetViewConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

interface StreetViewMetadataResponse {
  status: string;
}

/**
 * Street View Static API always returns *an* image for a `location` — a
 * generic gray "no imagery here" graphic when there's no real coverage,
 * not an error — so this free metadata check comes first to tell the two
 * apart. Any status other than "OK" (no coverage, a malformed address,
 * ...) means "don't bother fetching the image".
 */
async function hasStreetViewCoverage(address: string, apiKey: string): Promise<boolean> {
  try {
    const url = `${STREET_VIEW_BASE_URL}/metadata?location=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return false;

    const data = (await response.json()) as StreetViewMetadataResponse;
    return data.status === "OK";
  } catch (error) {
    console.error("hasStreetViewCoverage request failed", error);
    return false;
  }
}

export interface StreetViewPhoto {
  bytes: Buffer;
  contentType: string;
}

/** `null` whenever a photo can't be produced — not configured, no coverage for this address, or the request itself failed — so callers can always fall back to "no photo yet" rather than handling an error. */
export async function fetchStreetViewPhoto(address: string): Promise<StreetViewPhoto | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const trimmed = address.trim();
  if (!apiKey || !trimmed) return null;

  try {
    if (!(await hasStreetViewCoverage(trimmed, apiKey))) return null;

    const url = `${STREET_VIEW_BASE_URL}?size=${IMAGE_SIZE}&location=${encodeURIComponent(trimmed)}&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error("fetchStreetViewPhoto: image request failed", response.status, await response.text());
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const bytes = Buffer.from(await response.arrayBuffer());
    return { bytes, contentType };
  } catch (error) {
    console.error("fetchStreetViewPhoto request failed", error);
    return null;
  }
}
