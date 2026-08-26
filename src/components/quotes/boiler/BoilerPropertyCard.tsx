"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { updateQuotePropertyDetails } from "@/components/quotes/actions";
import type { BoilerPropertyDetails } from "@/types/boiler-quote";

/** Standard UK property archetypes — covers the vast majority of jobs. Not
 *  a strict enum on `BoilerPropertyDetails.propertyType` (still plain
 *  `string`): older quotes may already have a free-text value entered
 *  before this became a dropdown, and that value shouldn't silently
 *  disappear or get overwritten just because it isn't on this list. */
const PROPERTY_TYPE_OPTIONS = [
  "Detached",
  "Semi-Detached",
  "Terraced",
  "End Terrace",
  "Bungalow",
  "Flat / Apartment",
  "Maisonette",
  "Other",
];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function EditPropertyModal({
  property,
  onClose,
  onSave,
}: {
  property: BoilerPropertyDetails;
  onClose: () => void;
  onSave: (property: BoilerPropertyDetails) => void;
}) {
  const [form, setForm] = useState(property);

  function set<K extends keyof BoilerPropertyDetails>(key: K, value: BoilerPropertyDetails[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    onSave(form);
    onClose();
  }

  return (
    <Modal title="Edit property details" onClose={onClose}>
      <div className="flex flex-col gap-4 px-5 py-5">
        <FormField label="Property Type" htmlFor="propertyType">
          <select
            id="propertyType"
            className={inputClassName}
            value={form.propertyType}
            onChange={(event) => set("propertyType", event.target.value)}
          >
            {!form.propertyType && <option value="">Select a property type</option>}
            {/* Keeps a pre-existing free-text value selectable/visible even
                though it isn't one of the standard options below. */}
            {form.propertyType && !PROPERTY_TYPE_OPTIONS.includes(form.propertyType) && (
              <option value={form.propertyType}>{form.propertyType}</option>
            )}
            {PROPERTY_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Bedrooms" htmlFor="bedrooms">
          <input
            id="bedrooms"
            type="number"
            className={inputClassName}
            value={form.bedrooms}
            onChange={(event) => set("bedrooms", Number(event.target.value))}
          />
        </FormField>
        <FormField label="Radiators" htmlFor="radiators">
          <input
            id="radiators"
            type="number"
            className={inputClassName}
            value={form.radiators}
            onChange={(event) => set("radiators", Number(event.target.value))}
          />
        </FormField>
        <FormField label="Current Boiler Type" htmlFor="currentBoilerType">
          <input
            id="currentBoilerType"
            className={inputClassName}
            value={form.currentBoilerType}
            onChange={(event) => set("currentBoilerType", event.target.value)}
          />
        </FormField>
        <FormField label="Current Boiler Age" htmlFor="currentBoilerAge">
          <input
            id="currentBoilerAge"
            className={inputClassName}
            value={form.currentBoilerAge}
            onChange={(event) => set("currentBoilerAge", event.target.value)}
          />
        </FormField>
        <FormField label="Boiler Location" htmlFor="boilerLocation">
          <input
            id="boilerLocation"
            className={inputClassName}
            value={form.boilerLocation}
            onChange={(event) => set("boilerLocation", event.target.value)}
          />
        </FormField>
        <FormField label="Gas Supply Confirmed" htmlFor="gasSupplyConfirmed">
          <select
            id="gasSupplyConfirmed"
            className={inputClassName}
            value={form.gasSupplyConfirmed}
            onChange={(event) => set("gasSupplyConfirmed", event.target.value as "Yes" | "No")}
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </FormField>
        <FormField label="MPRN" htmlFor="mprn">
          <input
            id="mprn"
            className={inputClassName}
            value={form.mprn}
            onChange={(event) => set("mprn", event.target.value)}
          />
        </FormField>
        <FormField label="Access Notes" htmlFor="accessNotes">
          <textarea
            id="accessNotes"
            rows={3}
            className={inputClassName}
            value={form.accessNotes}
            onChange={(event) => set("accessNotes", event.target.value)}
          />
        </FormField>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="success" onClick={handleSave}>
          Save
        </Button>
      </div>
    </Modal>
  );
}

export function BoilerPropertyCard({
  quoteId,
  customerName,
  property,
  onUpdated,
}: {
  quoteId: string;
  customerName: string;
  property: BoilerPropertyDetails;
  onUpdated: (property: BoilerPropertyDetails) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  function handleSave(updated: BoilerPropertyDetails) {
    onUpdated(updated);
    void updateQuotePropertyDetails(quoteId, updated, customerName);
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Property details</h3>
        <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setIsEditing(true)}>
          Edit
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="Property Type" value={property.propertyType} />
        <Field label="Bedrooms" value={property.bedrooms} />
        <Field label="Radiators" value={property.radiators} />
        <Field label="Current Boiler Type" value={property.currentBoilerType} />
        <Field label="Current Boiler Age" value={property.currentBoilerAge} />
        <Field label="Boiler Location" value={property.boilerLocation} />
        <Field label="Gas Supply Confirmed" value={property.gasSupplyConfirmed} />
        <Field label="MPRN" value={property.mprn} />
        <Field label="Access Notes" value={property.accessNotes} />
      </div>

      {isEditing && (
        <EditPropertyModal property={property} onClose={() => setIsEditing(false)} onSave={handleSave} />
      )}
    </Card>
  );
}
