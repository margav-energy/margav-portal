"use server";

import {
  getAddressDetails,
  isAddressLookupConfigured,
  searchAddresses,
  type AddressDetails,
  type AddressSuggestion,
} from "@/lib/address-lookup";

export interface AddressSearchResult {
  configured: boolean;
  suggestions: AddressSuggestion[];
}

export async function searchAddressesAction(term: string): Promise<AddressSearchResult> {
  if (!isAddressLookupConfigured()) return { configured: false, suggestions: [] };
  return { configured: true, suggestions: await searchAddresses(term) };
}

export async function getAddressDetailsAction(id: string): Promise<AddressDetails | null> {
  return getAddressDetails(id);
}
