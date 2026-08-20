import "server-only";

/**
 * getAddress.io integration (https://getaddress.io) — postcode → address
 * autocomplete for `CreateAppointmentForm`'s "Find address" button. Called
 * server-side only (via `src/components/appointments/address-lookup-actions.ts`)
 * so the API key never reaches the browser — getAddress.io's own docs flag
 * this as the reason "Domain Tokens" exist, but a plain server-side proxy
 * avoids needing one at all.
 *
 * Add `GETADDRESS_API_KEY` to `.env.local` to enable this — see
 * `.env.local.example`. Until it's set, `isAddressLookupConfigured()`
 * returns false and the form falls back to manual entry, same as before.
 */

const GETADDRESS_BASE_URL = "https://api.getAddress.io";

export function isAddressLookupConfigured(): boolean {
  return Boolean(process.env.GETADDRESS_API_KEY);
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
  suggestions?: { id: string; address: string; url: string }[];
}

interface GetAddressResponse {
  postcode?: string;
  line_1?: string;
  line_2?: string;
  line_3?: string;
  town_or_city?: string;
  county?: string;
}

/**
 * Full postcode searches return every address at that postcode (getAddress.io's
 * `all` param defaults to true for postcode-shaped terms), which matches this
 * form's "type a postcode, pick your house" flow.
 */
export async function searchAddresses(term: string): Promise<AddressSuggestion[]> {
  const apiKey = process.env.GETADDRESS_API_KEY;
  const trimmed = term.trim();
  if (!apiKey || !trimmed) return [];

  try {
    const response = await fetch(
      `${GETADDRESS_BASE_URL}/autocomplete/${encodeURIComponent(trimmed)}?api-key=${apiKey}`,
    );

    if (!response.ok) {
      console.error("getAddress.io autocomplete failed", response.status, await response.text());
      return [];
    }

    const data = (await response.json()) as AutocompleteResponse;
    return (data.suggestions ?? []).map((suggestion) => ({ id: suggestion.id, address: suggestion.address }));
  } catch (error) {
    console.error("getAddress.io autocomplete request failed", error);
    return [];
  }
}

export async function getAddressDetails(id: string): Promise<AddressDetails | null> {
  const apiKey = process.env.GETADDRESS_API_KEY;
  if (!apiKey || !id) return null;

  try {
    const response = await fetch(`${GETADDRESS_BASE_URL}/get/${encodeURIComponent(id)}?api-key=${apiKey}`);

    if (!response.ok) {
      console.error("getAddress.io get failed", response.status, await response.text());
      return null;
    }

    const data = (await response.json()) as GetAddressResponse;
    return {
      postcode: data.postcode ?? "",
      line1: data.line_1 ?? "",
      line2: data.line_2 ?? "",
      line3: data.line_3 ?? "",
      townOrCity: data.town_or_city ?? "",
      county: data.county ?? "",
    };
  } catch (error) {
    console.error("getAddress.io get request failed", error);
    return null;
  }
}
