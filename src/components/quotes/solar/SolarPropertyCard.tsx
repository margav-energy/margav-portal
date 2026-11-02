"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { updateQuotePropertyDetails } from "@/components/quotes/actions";
import type { SolarPropertyDetails } from "@/types/solar-quote";
import { clearDraft, useAutosaveDraft, useDraftRestore } from "@/hooks/useAutosaveDraft";

// Electric unit rates carry more precision than `formatCurrency` shows
// (which rounds to 2dp) — e.g. "£0.2467" rather than "£0.25".
function formatUnitRate(rate: number): string {
  return `£${rate.toFixed(4)}`;
}

type SurveyFieldKey =
  | "propertyType"
  | "energySupplier"
  | "meterPhase"
  | "roofCount"
  | "rearAccess"
  | "hasWifi"
  | "hasPets"
  | "existingEvCharger"
  | "existingSolarOrBattery";

/** Property details the customer's survey fills in (see `buildPropertyPatchFromSurvey`) — shown read-only under the rep-entered ones. */
const SURVEY_FIELDS: { key: SurveyFieldKey; label: string }[] = [
  { key: "propertyType", label: "Property Type" },
  { key: "energySupplier", label: "Energy Supplier" },
  { key: "meterPhase", label: "Meter Phase" },
  { key: "roofCount", label: "Roofs With Panels" },
  { key: "rearAccess", label: "Rear Access" },
  { key: "hasWifi", label: "Wi-Fi" },
  { key: "hasPets", label: "Pets" },
  { key: "existingEvCharger", label: "Existing EV Charger" },
  { key: "existingSolarOrBattery", label: "Existing Solar / Battery" },
];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

const OCCUPANCY_OPTIONS = ["In most of the day", "In half of the day", "Out most of the day"];
const TARIFF_OPTIONS = ["Standard", "Economy7", "Fixed rate", "Commercial"];
const ESTIMATED_REASON_OPTIONS = [
  "Customer has just moved in",
  "Customer has just added a high load item such as an EV charger or heat pump",
  "Customer has no usable bills or meter readings",
];

/** The current value is kept as an option so a legacy free-text entry isn't lost when it isn't in the list. */
function withCurrent(options: string[], current: string): string[] {
  return current && !options.includes(current) ? [current, ...options] : options;
}

/** The average annual consumption used for an estimated bill (also MGD 003 §4.3.5's default). */
const ESTIMATED_CONSUMPTION_KWH = 3500;

/** An estimated bill without Custom is the average figure — keep consumption on it. */
function withEstimatedConsumption(property: SolarPropertyDetails): SolarPropertyDetails {
  if (property.estimatedBill !== "Yes" || (property.customEstimate ?? true)) return property;
  return { ...property, annualConsumptionKwh: ESTIMATED_CONSUMPTION_KWH };
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[200px_1fr] sm:items-start sm:gap-6">
      <label className="text-sm font-medium text-slate-600 sm:pt-2 sm:text-right">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Stepper({
  id,
  value,
  step,
  prefix,
  suffix,
  decimals = 0,
  disabled = false,
  onChange,
}: {
  id: string;
  value: number;
  step: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  function bump(direction: 1 | -1) {
    onChange(Math.max(0, Number((value + direction * step).toFixed(decimals))));
  }
  const buttonClassName = "px-2 text-lg leading-none text-slate-400 hover:text-slate-700";
  return (
    <div className={`flex w-fit items-center gap-1 rounded-lg bg-slate-100 px-2 py-2 ${disabled ? "opacity-60" : ""}`}>
      <button type="button" aria-label="Decrease" className={buttonClassName} disabled={disabled} onClick={() => bump(-1)}>
        −
      </button>
      {prefix && <span className="text-sm text-slate-500">{prefix}</span>}
      <input
        id={id}
        type="number"
        step="any"
        min={0}
        disabled={disabled}
        className="w-24 [appearance:textfield] bg-transparent text-center text-sm font-medium text-slate-900 outline-none [&::-webkit-inner-spin-button]:appearance-none"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {suffix && <span className="text-sm text-slate-500">{suffix}</span>}
      <button type="button" aria-label="Increase" className={buttonClassName} disabled={disabled} onClick={() => bump(1)}>
        +
      </button>
    </div>
  );
}

const selectClassName =
  "w-full max-w-md rounded-lg bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-brand-blue";

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
  // Merged over the current values so a draft saved before a field existed can't leave it undefined.
  const draftRestored = useDraftRestore<SolarPropertyDetails>(draftKey, (draft) =>
    setForm((current) => ({ ...current, ...draft })),
  );

  useAutosaveDraft(draftKey, form);

  function set<K extends keyof SolarPropertyDetails>(key: K, value: SolarPropertyDetails[K]) {
    setForm((current) => withEstimatedConsumption({ ...current, [key]: value }));
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

  const estimated = form.estimatedBill === "Yes";
  // The Custom toggle only exists for estimated bills; otherwise the figures are always editable.
  const custom = estimated ? (form.customEstimate ?? true) : true;

  return (
    <Modal title="Update quote property details" onClose={handleClose} maxWidthClassName="max-w-3xl">
      <div className="flex flex-col gap-5 px-5 py-6 sm:px-8">
        {draftRestored && (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Unsaved changes from your last session were restored.
          </div>
        )}

        <div className="sm:pl-[224px]">
          <ToggleSwitch
            checked={estimated}
            onChange={(value) => {
              set("estimatedBill", value ? "Yes" : "No");
              if (value) set("customEstimate", false);
            }}
            label="Estimated electric bill"
          />
        </div>

        <FormRow label="Occupancy archetype">
          <select
            className={selectClassName}
            value={form.occupancyArchetype}
            onChange={(event) => set("occupancyArchetype", event.target.value)}
          >
            {!form.occupancyArchetype && <option value="">Select…</option>}
            {withCurrent(OCCUPANCY_OPTIONS, form.occupancyArchetype).map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </FormRow>

        <hr className="border-slate-100" />

        <FormRow label="Annual electric consumption">
          <Stepper
            id="annualConsumptionKwh"
            value={form.annualConsumptionKwh}
            step={100}
            suffix="kWh"
            disabled={!custom}
            onChange={(value) => set("annualConsumptionKwh", value)}
          />
          {estimated && (
            <ToggleSwitch checked={custom} onChange={(value) => set("customEstimate", value)} label="Custom" />
          )}
          {!custom && (
            <p className="text-xs text-slate-500">Average figure of {ESTIMATED_CONSUMPTION_KWH.toLocaleString()} kWh. Turn on Custom to enter kWh yourself.</p>
          )}
        </FormRow>

        <FormRow label="Tariff type">
          <select
            className={selectClassName}
            value={form.tariffType ?? "Standard"}
            onChange={(event) => set("tariffType", event.target.value)}
          >
            {withCurrent(TARIFF_OPTIONS, form.tariffType ?? "").map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </FormRow>

        <FormRow label="Electric unit rate">
          <Stepper
            id="electricUnitRate"
            value={form.electricUnitRate}
            step={0.01}
            decimals={4}
            prefix="£"
            onChange={(value) => set("electricUnitRate", value)}
          />
        </FormRow>

        {estimated && (
          <FormRow label="Estimated reason">
            <select
              className={`${selectClassName} max-w-xl`}
              value={form.estimatedReason}
              onChange={(event) => set("estimatedReason", event.target.value)}
            >
              {!form.estimatedReason && <option value="">Select…</option>}
              {withCurrent(ESTIMATED_REASON_OPTIONS, form.estimatedReason).map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </FormRow>
        )}

        <hr className="border-slate-100" />

        <FormRow label="MPAN">
          <input
            id="mpan"
            className="w-full max-w-xl rounded-lg bg-slate-100 px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-1 focus:ring-brand-blue"
            value={form.mpan}
            onChange={(event) => set("mpan", event.target.value)}
          />
          <p className="text-sm text-slate-500">This is mandatory as there is an inverter requiring an LOA</p>
        </FormRow>

        <div className="sm:pl-[224px]">
          <ToggleSwitch
            checked={form.sprayFoam === "Yes"}
            onChange={(value) => set("sprayFoam", value ? "Yes" : "No")}
            label="Spray foam"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 px-5 pb-6 sm:px-8">
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button variant="success" onClick={handleSave}>
          Save these details
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
  locked = false,
}: {
  quoteId: string;
  customerName: string;
  property: SolarPropertyDetails;
  onUpdated: (property: SolarPropertyDetails) => void;
  /** Mirrors the quote's Lock/Unlock toggle (QuoteHeader.tsx) — disables Edit while locked. */
  locked?: boolean;
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
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          onClick={() => setIsEditing(true)}
          disabled={locked}
          title={locked ? "Unlock this quote to make changes" : undefined}
        >
          Edit
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="Occupancy Archetype" value={property.occupancyArchetype} />
        <Field label="Annual Electric Consumption" value={`${property.annualConsumptionKwh.toLocaleString()} kWh`} />
        <Field label="Electric Unit Rate" value={formatUnitRate(property.electricUnitRate)} />
        <Field label="Estimated Bill" value={property.estimatedBill} />
        <Field label="Tariff Type" value={property.tariffType || "Standard"} />
        <Field label="Estimated Reason" value={property.estimatedReason} />
        <Field label="Spray Foam" value={property.sprayFoam} />
        <Field label="MPAN" value={property.mpan} />
      </div>

      {SURVEY_FIELDS.some(({ key }) => property[key]) && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">From the survey</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            {SURVEY_FIELDS.map(({ key, label }) => (
              <Field key={key} label={label} value={property[key] || "—"} />
            ))}
          </div>
        </div>
      )}

      {isEditing && (
        <EditPropertyModal quoteId={quoteId} property={property} onClose={() => setIsEditing(false)} onSave={handleSave} />
      )}
    </Card>
  );
}
