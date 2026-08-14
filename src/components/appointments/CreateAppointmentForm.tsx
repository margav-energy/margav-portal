"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { FormSection } from "@/components/ui/FormSection";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { APPOINTMENT_PRODUCTS } from "@/lib/appointment-products";
import { cn } from "@/lib/utils";

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

export function CreateAppointmentForm() {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [addressNoticeVisible, setAddressNoticeVisible] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  function update<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setIsSaved(false);
  }

  function handleFindAddress() {
    setAddressNoticeVisible(true);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const nextErrors: FormErrors = {};
    for (const field of REQUIRED_FIELDS) {
      if (!values[field].trim()) {
        nextErrors[field] = `${FIELD_LABELS[field]} is required`;
      }
    }
    if (values.email && !/^\S+@\S+\.\S+$/.test(values.email)) {
      nextErrors.email = "Enter a valid email address";
    }
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setIsSaved(false);
      return;
    }

    // No backend yet — this just confirms the form was filled in correctly.
    setIsSaved(true);
    setValues(EMPTY_FORM);
    setAddressNoticeVisible(false);
  }

  function handleCancel() {
    setValues(EMPTY_FORM);
    setErrors({});
    setAddressNoticeVisible(false);
    setIsSaved(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {isSaved && (
        <div className="flex items-center gap-2 rounded-lg border border-brand-green-mid/20 bg-brand-green-mid/10 px-4 py-3 text-sm font-medium text-brand-green-mid">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Appointment saved.
        </div>
      )}

      <FormSection title="Customer Details">
        <FormField label="First name" required htmlFor="firstName" error={errors.firstName}>
          <input
            id="firstName"
            className={inputClassName}
            value={values.firstName}
            onChange={(event) => update("firstName", event.target.value)}
          />
        </FormField>
        <FormField label="Last name" required htmlFor="lastName" error={errors.lastName}>
          <input
            id="lastName"
            className={inputClassName}
            value={values.lastName}
            onChange={(event) => update("lastName", event.target.value)}
          />
        </FormField>
        <FormField label="Phone number" required htmlFor="phone" error={errors.phone}>
          <input
            id="phone"
            type="tel"
            className={inputClassName}
            value={values.phone}
            onChange={(event) => update("phone", event.target.value)}
          />
        </FormField>
        <FormField label="Email address" required htmlFor="email" error={errors.email}>
          <input
            id="email"
            type="email"
            className={inputClassName}
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
          />
        </FormField>
        <FormField label="Postcode" required htmlFor="postcode" error={errors.postcode}>
          <div className="flex gap-2">
            <input
              id="postcode"
              className={cn(inputClassName, "max-w-[160px]")}
              value={values.postcode}
              onChange={(event) => update("postcode", event.target.value)}
            />
            <Button type="button" variant="secondary" onClick={handleFindAddress}>
              Find address
            </Button>
          </div>
          {addressNoticeVisible && (
            <p className="text-xs text-slate-400">
              Address lookup isn&rsquo;t connected yet — enter the address manually below.
            </p>
          )}
        </FormField>
        <FormField label="Address line 1" required htmlFor="addressLine1" error={errors.addressLine1}>
          <input
            id="addressLine1"
            className={inputClassName}
            value={values.addressLine1}
            onChange={(event) => update("addressLine1", event.target.value)}
          />
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

      <FormSection title="Marketing details">
        <FormField label="Source" htmlFor="source">
          <input
            id="source"
            className={inputClassName}
            value={values.source}
            onChange={(event) => update("source", event.target.value)}
          />
        </FormField>
        <FormField label="Medium" htmlFor="medium">
          <input
            id="medium"
            className={inputClassName}
            value={values.medium}
            onChange={(event) => update("medium", event.target.value)}
          />
        </FormField>
        <FormField label="Term" htmlFor="term">
          <input
            id="term"
            className={inputClassName}
            value={values.term}
            onChange={(event) => update("term", event.target.value)}
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
        <Button type="button" variant="secondary" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="success">
          Save appointment
        </Button>
      </div>
    </form>
  );
}
