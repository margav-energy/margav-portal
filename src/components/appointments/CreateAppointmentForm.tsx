"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { FormSection } from "@/components/ui/FormSection";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { APPOINTMENT_PRODUCTS } from "@/lib/appointment-products";
import { createAppointmentAction } from "@/components/appointments/actions";
import {
  getAddressDetailsAction,
  searchAddressesAction,
} from "@/components/appointments/address-lookup-actions";
import type { AddressSuggestion } from "@/lib/address-lookup";
import { cn, formatUkPhone, formatUkPostcode, isValidEmail, isValidUkPhone, normalizeEmail, toTitleCase } from "@/lib/utils";

interface FormValues {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  postcode: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  city: string;
  county: string;
  source: string;
  medium: string;
  term: string;
  notes: string;
  product: string;
  date: string;
  time: string;
}

const EMPTY_FORM: FormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  postcode: "",
  addressLine1: "",
  addressLine2: "",
  addressLine3: "",
  city: "",
  county: "",
  source: "",
  medium: "",
  term: "",
  notes: "",
  product: APPOINTMENT_PRODUCTS[1],
  date: "",
  time: "",
};

const REQUIRED_FIELDS: (keyof FormValues)[] = [
  "firstName",
  "lastName",
  "phone",
  "email",
  "postcode",
  "addressLine1",
  "city",
  "notes",
  "product",
  "date",
  "time",
];

const FIELD_LABELS: Record<keyof FormValues, string> = {
  firstName: "First name",
  lastName: "Last name",
  phone: "Phone number",
  email: "Email address",
  postcode: "Postcode",
  addressLine1: "Address line 1",
  addressLine2: "Address line 2",
  addressLine3: "Address line 3",
  city: "City",
  county: "County",
  source: "Source",
  medium: "Medium",
  term: "Term",
  notes: "Notes",
  product: "Product",
  date: "Date",
  time: "Time",
};

type FormErrors = Partial<Record<keyof FormValues, string>>;

export function CreateAppointmentForm({
  initialFirstName,
  initialLastName,
  rebookFrom,
}: {
  initialFirstName?: string;
  initialLastName?: string;
  rebookFrom?: string;
} = {}) {
  const [values, setValues] = useState<FormValues>(() => ({
    ...EMPTY_FORM,
    firstName: initialFirstName ?? "",
    lastName: initialLastName ?? "",
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [addressNoticeVisible, setAddressNoticeVisible] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLookingUpAddress, setIsLookingUpAddress] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const addressSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setIsSaved(false);
    setSaveError(null);
  }

  /** Auto-fixes casing on blur rather than every keystroke, so it doesn't
   *  fight the rep mid-type (e.g. capitalizing before they've typed a
   *  hyphenated second half). */
  function handleNameBlur(field: "firstName" | "lastName") {
    setValues((current) => ({ ...current, [field]: toTitleCase(current[field]) }));
  }

  function handlePostcodeBlur() {
    setValues((current) => ({ ...current, postcode: formatUkPostcode(current.postcode) }));
  }

  function handleEmailBlur() {
    setValues((current) => ({ ...current, email: normalizeEmail(current.email) }));
  }

  function handlePhoneBlur() {
    setValues((current) => ({ ...current, phone: formatUkPhone(current.phone) }));
  }

  /**
   * Live search as the rep types the address itself, not the postcode —
   * Google's autocomplete predicts against place/street text, so a bare
   * postcode alone only resolves to the postcode area (no house-level
   * data to fill Address line 1 with). Typing the house name/number +
   * street here is what returns full, specific address matches, same as
   * typing into Google Maps' own search box.
   */
  function handleAddressLine1Change(value: string) {
    update("addressLine1", value);
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
          // No GOOGLE_MAPS_API_KEY set yet — same manual-entry fallback as before.
          setAddressNoticeVisible(true);
          setAddressSuggestions([]);
          return;
        }
        setAddressSuggestions(suggestions);
      });
    }, 300);
  }

  async function handleSelectAddress(suggestion: AddressSuggestion) {
    setIsLookingUpAddress(true);
    const details = await getAddressDetailsAction(suggestion.id);
    setIsLookingUpAddress(false);
    setAddressSuggestions([]);
    if (!details) return;

    setValues((current) => ({
      ...current,
      postcode: details.postcode || current.postcode,
      addressLine1: details.line1,
      addressLine2: details.line2,
      addressLine3: details.line3,
      city: details.townOrCity,
      county: details.county,
    }));
    setErrors((current) => ({
      ...current,
      addressLine1: undefined,
      city: undefined,
    }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    for (const field of REQUIRED_FIELDS) {
      if (!values[field].trim()) {
        nextErrors[field] = `${FIELD_LABELS[field]} is required`;
      }
    }
    if (values.email && !isValidEmail(values.email)) {
      nextErrors.email = "Enter a valid email address";
    }
    if (values.phone && !isValidUkPhone(values.phone)) {
      nextErrors.phone = "Enter a valid UK phone number";
    }
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setIsSaved(false);
      return;
    }

    setSaveError(null);
    startTransition(async () => {
      const result = await createAppointmentAction({
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone,
        email: values.email,
        postcode: values.postcode,
        addressLine1: values.addressLine1,
        addressLine2: values.addressLine2,
        addressLine3: values.addressLine3,
        city: values.city,
        county: values.county,
        source: values.source,
        medium: values.medium,
        term: values.term,
        notes: values.notes,
        product: values.product,
        date: values.date,
        time: values.time,
        rebookedFromId: rebookFrom ?? null,
      });

      if (!result.ok) {
        setSaveError(result.error ?? "Could not save the appointment. Please try again.");
        return;
      }

      setIsSaved(true);
      setValues(EMPTY_FORM);
      setAddressNoticeVisible(false);
      setAddressSuggestions([]);
    });
  }

  function handleCancel() {
    setValues(EMPTY_FORM);
    setErrors({});
    setAddressNoticeVisible(false);
    setAddressSuggestions([]);
    setIsSaved(false);
    setSaveError(null);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {isSaved && (
        <div className="flex items-center gap-2 rounded-lg border border-brand-green-mid/20 bg-brand-green-mid/10 px-4 py-3 text-sm font-medium text-brand-green-mid">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Appointment saved.
        </div>
      )}
      {saveError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          <XCircle className="h-4 w-4 shrink-0" />
          {saveError}
        </div>
      )}

      <FormSection title="Customer Details">
        <FormField label="First name" required htmlFor="firstName" error={errors.firstName}>
          <input
            id="firstName"
            className={inputClassName}
            value={values.firstName}
            onChange={(event) => update("firstName", event.target.value)}
            onBlur={() => handleNameBlur("firstName")}
          />
        </FormField>
        <FormField label="Last name" required htmlFor="lastName" error={errors.lastName}>
          <input
            id="lastName"
            className={inputClassName}
            value={values.lastName}
            onChange={(event) => update("lastName", event.target.value)}
            onBlur={() => handleNameBlur("lastName")}
          />
        </FormField>
        <FormField label="Phone number" required htmlFor="phone" error={errors.phone}>
          <input
            id="phone"
            type="tel"
            className={inputClassName}
            value={values.phone}
            onChange={(event) => update("phone", event.target.value)}
            onBlur={handlePhoneBlur}
          />
        </FormField>
        <FormField label="Email address" required htmlFor="email" error={errors.email}>
          <input
            id="email"
            type="email"
            className={inputClassName}
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            onBlur={handleEmailBlur}
          />
        </FormField>
        <FormField label="Postcode" required htmlFor="postcode" error={errors.postcode}>
          <input
            id="postcode"
            className={cn(inputClassName, "max-w-[160px]")}
            value={values.postcode}
            onChange={(event) => update("postcode", event.target.value)}
            onBlur={handlePostcodeBlur}
          />
        </FormField>
        <FormField label="Address line 1" required htmlFor="addressLine1" error={errors.addressLine1}>
          <div className="relative">
            <input
              id="addressLine1"
              autoComplete="off"
              placeholder="Start typing the house name/number and street…"
              className={inputClassName}
              value={values.addressLine1}
              onChange={(event) => handleAddressLine1Change(event.target.value)}
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
              Address lookup isn&rsquo;t connected yet — enter the address manually below.
            </p>
          )}
        </FormField>
        <FormField label="Address line 2" htmlFor="addressLine2">
          <input
            id="addressLine2"
            className={inputClassName}
            value={values.addressLine2}
            onChange={(event) => update("addressLine2", event.target.value)}
          />
        </FormField>
        <FormField label="Address line 3" htmlFor="addressLine3">
          <input
            id="addressLine3"
            className={inputClassName}
            value={values.addressLine3}
            onChange={(event) => update("addressLine3", event.target.value)}
          />
        </FormField>
        <FormField label="City" required htmlFor="city" error={errors.city}>
          <input
            id="city"
            className={inputClassName}
            value={values.city}
            onChange={(event) => update("city", event.target.value)}
          />
        </FormField>
        <FormField label="County" htmlFor="county">
          <input
            id="county"
            className={inputClassName}
            value={values.county}
            onChange={(event) => update("county", event.target.value)}
          />
        </FormField>
      </FormSection>

      <FormSection title="Lead notes">
        <FormField label="Notes" required htmlFor="notes" error={errors.notes}>
          <textarea
            id="notes"
            rows={5}
            className={cn(inputClassName, "resize-y")}
            value={values.notes}
            onChange={(event) => update("notes", event.target.value)}
          />
        </FormField>
      </FormSection>

      <FormSection title="Lead details">
        <FormField label="Product" required htmlFor="product" error={errors.product}>
          <select
            id="product"
            className={inputClassName}
            value={values.product}
            onChange={(event) => update("product", event.target.value)}
          >
            {APPOINTMENT_PRODUCTS.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))}
          </select>
        </FormField>
      </FormSection>

      <FormSection title="Appointment details">
        <FormField label="Date" required htmlFor="date" error={errors.date}>
          <input
            id="date"
            type="date"
            className={cn(inputClassName, "max-w-[220px]")}
            value={values.date}
            onChange={(event) => update("date", event.target.value)}
          />
        </FormField>
        <FormField label="Time" required htmlFor="time" error={errors.time}>
          <input
            id="time"
            type="time"
            className={cn(inputClassName, "max-w-[220px]")}
            value={values.time}
            onChange={(event) => update("time", event.target.value)}
          />
        </FormField>
      </FormSection>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={handleCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" variant="success" disabled={isPending}>
          {isPending ? "Saving…" : "Save appointment"}
        </Button>
      </div>
    </form>
  );
}
