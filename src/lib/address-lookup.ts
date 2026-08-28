import "server-only";

/**
 * Google Places API — postcode/address autocomplete for `CreateAppointmentForm`'s
 * "Find address" button. Called server-side only (via
 * `src/components/appointments/address-lookup-actions.ts`) so the API key
 * never reaches the browser.
 *
 * Replaces the earlier getAddress.io integration (same `GOOGLE_MAPS_API_KEY`
 * used by `src/lib/google-street-view.ts` — one Google Cloud project/key
 * covers both, as long as the key's API restrictions allow "Places API").
 * Until it's set, `isAddressLookupConfigured()` returns false and the form
 * falls back to manual entry, same as before.
 */

const PLACES_BASE_URL = "https://maps.googleapis.com/maps/api/place";

export function isAddressLookupConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

export interface AddressSuggestion {
  id: string;
  address: string;
}

export interface AddressDetails {
  postcode: string;
  line1: string;
  line2: string;
  line3: string;
  townOrCity: string;
  county: string;
}

interface AutocompleteResponse {
  status: string;
  predictions?: { place_id: string; description: string }[];
}

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface PlaceDetailsResponse {
  status: string;
  result?: { address_components?: AddressComponent[] };
}

function componentsByType(components: AddressComponent[], type: string): AddressComponent | undefined {
  return components.find((component) => component.types.includes(type));
}

/**
 * Restricted to GB. No `types` filter — Google classifies a bare UK
 * postcode as `postal_code`, not `address`, so filtering to `types=address`
 * silently zeroes out the exact "type a postcode" input this flow expects
 * (unlike getAddress.io, Google doesn't enumerate every individual property
 * at a postcode either way — it predicts against whatever's typed, so
 * fuller free text like a house number + street name returns better/more
 * specific results than a postcode alone).
 */
export async function searchAddresses(term: string): Promise<AddressSuggestion[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const trimmed = term.trim();
  if (!apiKey || !trimmed) return [];

  try {
    const url =
      `${PLACES_BASE_URL}/autocomplete/json?input=${encodeURIComponent(trimmed)}` +
      `&components=country:gb&key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error("Places autocomplete request failed", response.status, await response.text());
      return [];
    }

    const data = (await response.json()) as AutocompleteResponse;
    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Places autocomplete returned an error status", data.status);
      return [];
    }

    return (data.predictions ?? []).map((prediction) => ({
      id: prediction.place_id,
      address: prediction.description,
    }));
  } catch (error) {
    console.error("Places autocomplete request failed", error);
    return [];
  }
}

/**
 * Google returns a flat `address_components[]` array tagged with types
 * (`street_number`, `route`, `postal_town`, ...) rather than getAddress.io's
 * ready-made `line_1`/`line_2`/`town_or_city` fields, so this assembles the
 * same shape the rest of the app already expects from those component types.
 */
export async function getAddressDetails(id: string): Promise<AddressDetails | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey || !id) return null;

  try {
    const url =
      `${PLACES_BASE_URL}/details/json?place_id=${encodeURIComponent(id)}` +
      `&fields=address_component&key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error("Places details request failed", response.status, await response.text());
      return null;
    }

    const data = (await response.json()) as PlaceDetailsResponse;
    const components = data.result?.address_components;
    if (data.status !== "OK" || !components) {
      console.error("Places details returned an error status", data.status);
      return null;
    }

    const streetNumber = componentsByType(components, "street_number")?.long_name ?? "";
    const route = componentsByType(components, "route")?.long_name ?? "";
    const line1 = [streetNumber, route].filter(Boolean).join(" ");

    return {
      postcode: componentsByType(components, "postal_code")?.long_name ?? "",
      line1,
      line2: componentsByType(components, "sublocality")?.long_name ?? "",
      line3: "",
      townOrCity:
        componentsByType(components, "postal_town")?.long_name ??
        componentsByType(components, "locality")?.long_name ??
        "",
      county: componentsByType(components, "administrative_area_level_2")?.long_name ?? "",
    };
  } catch (error) {
    console.error("Places details request failed", error);
    return null;
  }
}
