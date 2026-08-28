"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { createQuote, type CreateQuoteInput } from "@/components/quotes/actions";
import {
  getAddressDetailsAction,
  searchAddressesAction,
} from "@/components/appointments/address-lookup-actions";
import type { AddressSuggestion } from "@/lib/address-lookup";
import { formatUkPhone, formatUkPostcode, isValidEmail, isValidUkPhone, normalizeEmail, toTitleCase } from "@/lib/utils";

const EMPTY: CreateQuoteInput = {
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  postcode: "",
  address: "",
  productType: "solar",
  amount: 0,
  paymentType: "cash",
};

export function NewQuoteModal({ onClose }: { onClose: () => void }) {
  const [values, setValues] = useState<CreateQuoteInput>(EMPTY);
  const [error, setError] = useState<string | undefined>();
  const [emailError, setEmailError] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [addressNoticeVisible, setAddressNoticeVisible] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLookingUpAddress, setIsLookingUpAddress] = useState(false);
  const router = useRouter();
  const addressSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update<K extends keyof CreateQuoteInput>(field: K, value: CreateQuoteInput[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  /**
   * Same live-search-as-you-type pattern as `CreateAppointmentForm`'s
   * "Address line 1" — see its doc comment (Google predicts against
   * place/street text, not a bare postcode).
   */
  function handleAddressChange(value: string) {
    update("address", value);
    setAddressNoticeVisible(false);

    if (addressSearchDebounceRef.current) clearTimeout(addressSearchDebounceRef.current);
    if (value.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }

    addressSearchDebounceRef.current = setTimeout(() => {
      setIsLookingUpAddress(true);
      searchAddressesAction(value).then(({ configured, suggestions }) => {
        setIsLookingUpAddress(false);
        if (!configured) {
          setAddressNoticeVisible(true);
          setAddressSuggestions([]);
          return;
        }
        setAddressSuggestions(suggestions);
      });
    }, 300);
  }

  /**
   * Quotes only have one flat `address` line + `postcode` (no separate
   * city/county fields like appointments do), so this folds every non-empty
   * part into a single line — same parts, same order, as
   * `combineAddress` in src/data/appointments-service.ts.
   */
  async function handleSelectAddress(suggestion: AddressSuggestion) {
    setIsLookingUpAddress(true);
    const details = await getAddressDetailsAction(suggestion.id);
    setIsLookingUpAddress(false);
    setAddressSuggestions([]);
    if (!details) return;

    const combined = [details.line1, details.line2, details.line3, details.townOrCity, details.county]
      .filter(Boolean)
      .join(", ");

    setValues((current) => ({
      ...current,
      address: combined,
      postcode: details.postcode || current.postcode,
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.customerName.trim()) {
      setError("Customer name is required.");
      return;
    }
    const nextEmailError =
      values.customerEmail?.trim() && !isValidEmail(values.customerEmail) ? "Enter a valid email address" : undefined;
    const nextPhoneError =
      values.customerPhone?.trim() && !isValidUkPhone(values.customerPhone) ? "Enter a valid UK phone number" : undefined;
    setEmailError(nextEmailError);
    setPhoneError(nextPhoneError);
    if (nextEmailError || nextPhoneError) return;

    setIsSaving(true);
    setError(undefined);
    const result = await createQuote(values);
    setIsSaving(false);

    if (result.error || !result.id) {
      setError(result.error ?? "Something went wrong. Please try again.");
      return;
    }

    onClose();
    router.push(`/quotes/${result.id}`);
  }

  return (
    <Modal title="New quote" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <FormField label="Customer name" required htmlFor="customerName">
          <input
            id="customerName"
            className={inputClassName}
            value={values.customerName}
            onChange={(event) => update("customerName", event.target.value)}
            onBlur={() => update("customerName", toTitleCase(values.customerName))}
            autoFocus
          />
        </FormField>
        <FormField label="Email address" htmlFor="customerEmail" error={emailError}>
          <input
            id="customerEmail"
            type="email"
            className={inputClassName}
            value={values.customerEmail}
            onChange={(event) => update("customerEmail", event.target.value)}
            onBlur={() => update("customerEmail", normalizeEmail(values.customerEmail ?? ""))}
          />
        </FormField>
        <FormField label="Phone number" htmlFor="customerPhone" error={phoneError}>
          <input
            id="customerPhone"
            type="tel"
            className={inputClassName}
            value={values.customerPhone}
            onChange={(event) => update("customerPhone", event.target.value)}
            onBlur={() => update("customerPhone", formatUkPhone(values.customerPhone ?? ""))}
          />
        </FormField>
        <FormField label="Postcode" htmlFor="postcode">
          <input
            id="postcode"
            className={inputClassName}
            value={values.postcode}
            onChange={(event) => update("postcode", event.target.value)}
            onBlur={() => update("postcode", formatUkPostcode(values.postcode))}
          />
        </FormField>
        <FormField label="Address" htmlFor="address">
          <div className="relative">
            <input
              id="address"
              autoComplete="off"
              placeholder="Start typing the house name/number and street…"
              className={inputClassName}
              value={values.address}
              onChange={(event) => handleAddressChange(event.target.value)}
            />
            {isLookingUpAddress && (
              <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-slate-400" />
            )}
            {addressSuggestions.length > 0 && (
              <div className="absolute inset-x-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                {addressSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => handleSelectAddress(suggestion)}
                    className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
                  >
                    {suggestion.address}
                  </button>
                ))}
              </div>
            )}
          </div>
          {addressNoticeVisible && (
            <p className="text-xs text-slate-400">
              Address lookup isn&rsquo;t connected yet — enter the address manually.
            </p>
          )}
        </FormField>
        <FormField label="Product" required htmlFor="productType">
          <select
            id="productType"
            className={inputClassName}
            value={values.productType}
            onChange={(event) => update("productType", event.target.value as CreateQuoteInput["productType"])}
          >
            <option value="solar">Solar</option>
            <option value="boiler">Boiler</option>
          </select>
        </FormField>
        <FormField label="Amount" required htmlFor="amount">
          <input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            className={inputClassName}
            value={values.amount}
            onChange={(event) => update("amount", Number(event.target.value))}
          />
        </FormField>
        <FormField label="Payment type" required htmlFor="paymentType">
          <select
            id="paymentType"
            className={inputClassName}
            value={values.paymentType}
            onChange={(event) => update("paymentType", event.target.value as CreateQuoteInput["paymentType"])}
          >
            <option value="cash">Cash</option>
            <option value="finance">Finance</option>
            <option value="card">Card</option>
            <option value="bacs">BACS</option>
          </select>
        </FormField>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="success" disabled={isSaving}>
            {isSaving ? "Creating…" : "Create quote"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
