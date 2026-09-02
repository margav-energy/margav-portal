"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { updateQuotePropertyDetails } from "@/components/quotes/actions";
import type { SolarPropertyDetails } from "@/types/solar-quote";
import { clearDraft, useAutosaveDraft, useDraftRestore } from "@/hooks/useAutosaveDraft";

// Electric unit rates carry more precision than `formatCurrency` shows
// (which rounds to 2dp) — e.g. "£0.2467" rather than "£0.25".
function formatUnitRate(rate: number): string {
  return `£${rate.toFixed(4)}`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function EditPropertyModal({
  quoteId,
  property,
  onClose,
  onSave,
}: {
  quoteId: string;
  property: SolarPropertyDetails;
  onClose: () => void;
  onSave: (property: SolarPropertyDetails) => void;
}) {
  // Autosaved locally so an in-progress edit survives a crash/restart before Save is clicked.
  const draftKey = `solar-property-draft-${quoteId}`;
  const [form, setForm] = useState(property);
  const draftRestored = useDraftRestore<SolarPropertyDetails>(draftKey, setForm);

  useAutosaveDraft(draftKey, form);

  function set<K extends keyof SolarPropertyDetails>(key: K, value: SolarPropertyDetails[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleClose() {
    clearDraft(draftKey);
    onClose();
  }

  function handleSave() {
    onSave(form);
    clearDraft(draftKey);
    onClose();
  }

  return (
    <Modal title="Edit property details" onClose={handleClose}>
      <div className="flex flex-col gap-4 px-5 py-5">
        {draftRestored && (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Unsaved changes from your last session were restored.
          </div>
        )}
        <FormField label="Occupancy Archetype" htmlFor="occupancyArchetype">
          <input
            id="occupancyArchetype"
            className={inputClassName}
            value={form.occupancyArchetype}
            onChange={(event) => set("occupancyArchetype", event.target.value)}
          />
        </FormField>
        <FormField label="Annual Consumption (kWh)" htmlFor="annualConsumptionKwh">
          <input
            id="annualConsumptionKwh"
            type="number"
            className={inputClassName}
            value={form.annualConsumptionKwh}
            onChange={(event) => set("annualConsumptionKwh", Number(event.target.value))}
          />
        </FormField>
        <FormField label="Electric Unit Rate (£)" htmlFor="electricUnitRate">
          <input
            id="electricUnitRate"
            type="number"
            step="0.0001"
            className={inputClassName}
            value={form.electricUnitRate}
            onChange={(event) => set("electricUnitRate", Number(event.target.value))}
          />
        </FormField>
        <FormField label="Estimated Bill" htmlFor="estimatedBill">
          <select
            id="estimatedBill"
            className={inputClassName}
            value={form.estimatedBill}
            onChange={(event) => set("estimatedBill", event.target.value as "Yes" | "No")}
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </FormField>
        <FormField label="Estimated Reason" htmlFor="estimatedReason">
          <input
            id="estimatedReason"
            className={inputClassName}
            value={form.estimatedReason}
            onChange={(event) => set("estimatedReason", event.target.value)}
          />
        </FormField>
        <FormField label="Spray Foam" htmlFor="sprayFoam">
          <select
            id="sprayFoam"
            className={inputClassName}
            value={form.sprayFoam}
            onChange={(event) => set("sprayFoam", event.target.value as "Yes" | "No")}
          >
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </FormField>
        <FormField label="MPAN" htmlFor="mpan">
          <input
            id="mpan"
            className={inputClassName}
            value={form.mpan}
            onChange={(event) => set("mpan", event.target.value)}
          />
        </FormField>
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button variant="success" onClick={handleSave}>
          Save
        </Button>
      </div>
    </Modal>
  );
}

export function SolarPropertyCard({
  quoteId,
  customerName,
  property,
  onUpdated,
}: {
  quoteId: string;
  customerName: string;
  property: SolarPropertyDetails;
  onUpdated: (property: SolarPropertyDetails) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);

  function handleSave(updated: SolarPropertyDetails) {
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
        <Field label="Occupancy Archetype" value={property.occupancyArchetype} />
        <Field label="Annual Electric Consumption" value={`${property.annualConsumptionKwh.toLocaleString()} kWh`} />
        <Field label="Electric Unit Rate" value={formatUnitRate(property.electricUnitRate)} />
        <Field label="Estimated Bill" value={property.estimatedBill} />
        <Field label="Estimated Reason" value={property.estimatedReason} />
        <Field label="Spray Foam" value={property.sprayFoam} />
        <Field label="MPAN" value={property.mpan} />
      </div>

      {isEditing && (
        <EditPropertyModal quoteId={quoteId} property={property} onClose={() => setIsEditing(false)} onSave={handleSave} />
      )}
    </Card>
  );
}
