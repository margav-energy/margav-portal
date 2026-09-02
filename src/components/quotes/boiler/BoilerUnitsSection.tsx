"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { formatCurrency } from "@/lib/format";
import { createBoilerUnit, deleteBoilerUnit, updateBoilerUnit } from "@/components/quotes/actions";
import { BOILER_MAKE_OPTIONS, modelsForMake, withLegacyOption } from "@/lib/boiler-catalog";
import { DEFAULT_BOILER_SELL_PRICE } from "@/lib/boiler-install-cost";
import type { BoilerUnit, FuelType, FlueType, BoilerInstallType } from "@/types/boiler-quote";
import type { LineItem } from "@/types/quote-detail-shared";
import { clearDraft, useAutosaveDraft, useDraftRestore } from "@/hooks/useAutosaveDraft";

const FUEL_TYPES: FuelType[] = ["Mains Gas", "LPG", "Oil"];
const FLUE_TYPES: FlueType[] = ["Horizontal", "Vertical"];
const INSTALL_TYPES: BoilerInstallType[] = ["Combi", "System", "Open Vent"];
/** The only output sizes Margav stocks. */
const OUTPUT_KW_OPTIONS = [24, 30, 36];
/** Common cylinder sizes — combi boilers leave this unset instead. */
const CYLINDER_LITRE_OPTIONS = [120, 150, 180, 210, 250, 300];

/**
 * Starting suggestion for a System/Open Vent unit's cylinder, keyed off
 * output (kW) — the only structured "size" signal this form has. Bedrooms/
 * bathrooms are the more precise real-world driver for cylinder sizing, but
 * the boiler still has to be able to reheat whatever cylinder it's paired
 * with in a reasonable time, so the two aren't unrelated. Loosely follows
 * standard UK unvented-cylinder sizing guidance for the property size each
 * output typically serves:
 *   24kW ≈ 2-3 bed, 1-2 bathrooms  → 180L
 *   30kW ≈ 3-4 bed, 2 bathrooms    → 210L
 *   36kW ≈ 4-5+ bed, 2-3 bathrooms → 250L
 * Always just a starting point — the dropdown stays fully editable.
 */
const SUGGESTED_CYLINDER_LITRES_BY_KW: Record<number, number> = {
  24: 180,
  30: 210,
  36: 250,
};

let localIdCounter = 0;

/** Preset options plus a legacy value that predates the preset list, so editing an old unit never silently changes it. */
function withLegacyValue(options: number[], current: string): number[] {
  const parsed = Number(current);
  if (!current || !Number.isFinite(parsed) || options.includes(parsed)) return options;
  return [...options, parsed].sort((a, b) => a - b);
}

function specLine(unit: BoilerUnit): string {
  const parts = [`${unit.outputKw}kW`, unit.installType, unit.fuelType, `${unit.flueType} Flue`];
  if (unit.cylinderLitres) parts.push(`${unit.cylinderLitres}L Cylinder`);
  parts.push(`${unit.warrantyYears}yr Warranty`);
  return parts.join(" · ");
}

type UnitForm = Omit<BoilerUnit, "id" | "outputKw" | "cylinderLitres" | "warrantyYears" | "price" | "items"> & {
  outputKw: string;
  cylinderLitres: string;
  warrantyYears: string;
  price: string;
  items: LineItem[];
};

type UnitFormErrors = Partial<Record<"make" | "model", string>>;

function toForm(unit?: BoilerUnit): UnitForm {
  return {
    // No longer collected in the form — derived from make + model on save
    // (see handleSave) since the two dropdowns already fully identify the
    // unit. Kept on the type/DB (BoilerUnit.label) since it's still what
    // the unit card header and activity log describe the unit as.
    label: unit?.label ?? "",
    make: unit?.make ?? "",
    model: unit?.model ?? "",
    outputKw: unit ? String(unit.outputKw) : String(OUTPUT_KW_OPTIONS[0]),
    fuelType: unit?.fuelType ?? "Mains Gas",
    flueType: unit?.flueType ?? "Horizontal",
    installType: unit?.installType ?? "Combi",
    cylinderLitres: unit?.cylinderLitres != null ? String(unit.cylinderLitres) : "",
    warrantyYears: unit ? String(unit.warrantyYears) : "",
    // Margav sells every boiler at the same price regardless of size —
    // margin comes from the cost side (see boiler-install-cost.ts), not
    // from charging more for a bigger unit — so a new unit starts here
    // rather than blank. Still fully editable for the rare exception.
    price: unit ? String(unit.price) : String(DEFAULT_BOILER_SELL_PRICE),
    items: unit?.items ?? [],
  };
}

function UnitFormModal({
  quoteId,
  title,
  initial,
  onClose,
  onSave,
}: {
  quoteId: string;
  title: string;
  initial?: BoilerUnit;
  onClose: () => void;
  onSave: (unit: Omit<BoilerUnit, "id">) => void;
}) {
  // Autosaved locally so an in-progress add/edit survives a crash/restart before Save is
  // clicked. Keyed by the unit being edited (or "new" while adding) so switching between
  // units never mixes up drafts.
  const draftKey = `boiler-unit-draft-${quoteId}-${initial?.id ?? "new"}`;
  const [form, setForm] = useState<UnitForm>(() => toForm(initial));
  const draftRestored = useDraftRestore<UnitForm>(draftKey, setForm);
  const [errors, setErrors] = useState<UnitFormErrors>({});

  useAutosaveDraft(draftKey, form);

  function set<K extends keyof UnitForm>(key: K, value: UnitForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "make" || key === "model") {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
  }

  /** Model choices depend on the selected make, so switching make always
   *  clears whatever model was previously selected — a model valid for one
   *  make isn't guaranteed to exist for another. */
  function handleMakeChange(value: string) {
    setForm((current) => ({ ...current, make: value, model: "" }));
    setErrors((current) => ({ ...current, make: undefined, model: undefined }));
  }

  /** Intergas model names embed the kW output ("Xclusive 24") — selecting a
   *  model auto-syncs Output so the two can't end up mismatched. Output
   *  stays visible/editable for the rare case a model's trailing number
   *  isn't its kW. */
  function handleModelChange(value: string) {
    set("model", value);
    const outputMatch = value.match(/(\d+)\s*$/);
    if (outputMatch) handleOutputKwChange(outputMatch[1]);
  }

  /** Re-suggests the cylinder for a new output — only while there's actually a cylinder to have (not a Combi). */
  function handleOutputKwChange(value: string) {
    const suggestion = SUGGESTED_CYLINDER_LITRES_BY_KW[Number(value)];
    setForm((current) => ({
      ...current,
      outputKw: value,
      cylinderLitres:
        current.installType === "Combi" || suggestion === undefined ? current.cylinderLitres : String(suggestion),
    }));
  }

  /** Combi never has a cylinder; switching *to* System/Open Vent suggests one, but only if there isn't one set already (e.g. going Open Vent → System keeps whatever cylinder was already chosen). */
  function handleInstallTypeChange(value: BoilerInstallType) {
    setForm((current) => {
      if (value === "Combi") return { ...current, installType: value, cylinderLitres: "" };
      if (current.cylinderLitres) return { ...current, installType: value };
      const suggestion = SUGGESTED_CYLINDER_LITRES_BY_KW[Number(current.outputKw)];
      return { ...current, installType: value, cylinderLitres: suggestion !== undefined ? String(suggestion) : current.cylinderLitres };
    });
  }

  function addItem() {
    set("items", [...form.items, { id: `local-${localIdCounter++}`, name: "", quantity: 1, unitPrice: 0 }]);
  }

  function updateItem(index: number, patch: Partial<LineItem>) {
    set(
      "items",
      form.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(index: number) {
    set(
      "items",
      form.items.filter((_, i) => i !== index),
    );
  }

  function handleClose() {
    clearDraft(draftKey);
    onClose();
  }

  function handleSave() {
    const nextErrors: UnitFormErrors = {};
    if (!form.make.trim()) nextErrors.make = "Select a make";
    if (!form.model.trim()) nextErrors.model = "Select a model";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSave({
      // Derived from make + model rather than asked for separately — the
      // two dropdowns already fully identify the unit (see toForm).
      label: `${form.make.trim()} ${form.model.trim()}`.trim(),
      make: form.make.trim(),
      model: form.model.trim(),
      outputKw: Number(form.outputKw) || 0,
      fuelType: form.fuelType,
      flueType: form.flueType,
      installType: form.installType,
      cylinderLitres: form.cylinderLitres ? Number(form.cylinderLitres) : undefined,
      warrantyYears: Number(form.warrantyYears) || 0,
      price: Number(form.price) || 0,
      items: form.items.filter((item) => item.name.trim().length > 0),
    });
    clearDraft(draftKey);
    onClose();
  }

  return (
    <Modal title={title} onClose={handleClose}>
      <div className="flex flex-col gap-4 px-5 py-5">
        {draftRestored && (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Unsaved changes from your last session were restored.
          </div>
        )}
        <FormField label="Make" htmlFor="unit-make" required error={errors.make}>
          <select
            id="unit-make"
            className={inputClassName}
            value={form.make}
            onChange={(event) => handleMakeChange(event.target.value)}
          >
            <option value="">Select make</option>
            {withLegacyOption(BOILER_MAKE_OPTIONS, form.make).map((make) => (
              <option key={make} value={make}>
                {make}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Model" htmlFor="unit-model" required error={errors.model}>
          <select
            id="unit-model"
            className={`${inputClassName} disabled:cursor-not-allowed disabled:opacity-50`}
            value={form.model}
            disabled={!form.make}
            aria-disabled={!form.make}
            onChange={(event) => handleModelChange(event.target.value)}
          >
            <option value="">Select model</option>
            {withLegacyOption(modelsForMake(form.make), form.model).map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          {!form.make && <p className="text-xs text-slate-400">Select a make first.</p>}
        </FormField>
        <FormField label="Output (kW)" htmlFor="unit-output">
          <select
            id="unit-output"
            className={inputClassName}
            value={form.outputKw}
            onChange={(event) => handleOutputKwChange(event.target.value)}
          >
            {withLegacyValue(OUTPUT_KW_OPTIONS, form.outputKw).map((kw) => (
              <option key={kw} value={kw}>
                {kw}kW
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Price (£)" htmlFor="unit-price">
          <input
            id="unit-price"
            type="number"
            min="0"
            step="0.01"
            className={inputClassName}
            value={form.price}
            onChange={(event) => set("price", event.target.value)}
          />
        </FormField>
        <FormField label="Fuel Type" htmlFor="unit-fuel">
          <select
            id="unit-fuel"
            className={inputClassName}
            value={form.fuelType}
            onChange={(event) => set("fuelType", event.target.value as FuelType)}
          >
            {FUEL_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Flue Type" htmlFor="unit-flue">
          <select
            id="unit-flue"
            className={inputClassName}
            value={form.flueType}
            onChange={(event) => set("flueType", event.target.value as FlueType)}
          >
            {FLUE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Install Type" htmlFor="unit-install">
          <select
            id="unit-install"
            className={inputClassName}
            value={form.installType}
            onChange={(event) => handleInstallTypeChange(event.target.value as BoilerInstallType)}
          >
            {INSTALL_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </FormField>
        {form.installType !== "Combi" && (
          <FormField label="Cylinder (L)" htmlFor="unit-cylinder">
            <select
              id="unit-cylinder"
              className={inputClassName}
              value={form.cylinderLitres}
              onChange={(event) => set("cylinderLitres", event.target.value)}
            >
              <option value="">None</option>
              {withLegacyValue(CYLINDER_LITRE_OPTIONS, form.cylinderLitres).map((litres) => (
                <option key={litres} value={litres}>
                  {litres}L{litres === SUGGESTED_CYLINDER_LITRES_BY_KW[Number(form.outputKw)] ? " (suggested)" : ""}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <FormField label="Warranty (years)" htmlFor="unit-warranty">
          <input
            id="unit-warranty"
            type="number"
            className={inputClassName}
            value={form.warrantyYears}
            onChange={(event) => set("warrantyYears", event.target.value)}
          />
        </FormField>

        <FormField label="Line items" htmlFor="unit-items">
          <div className="flex flex-col gap-2">
            {form.items.map((item, index) => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  className={inputClassName}
                  placeholder="Name"
                  value={item.name}
                  onChange={(event) => updateItem(index, { name: event.target.value })}
                />
                <input
                  type="number"
                  className={`${inputClassName} w-20`}
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })}
                />
                <input
                  type="number"
                  className={`${inputClassName} w-28`}
                  placeholder="Unit price"
                  value={item.unitPrice}
                  onChange={(event) => updateItem(index, { unitPrice: Number(event.target.value) })}
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  aria-label="Remove item"
                  className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button variant="secondary" className="w-fit gap-1 text-xs" onClick={addItem}>
              <Plus className="h-3.5 w-3.5" />
              Add line item
            </Button>
          </div>
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

export function BoilerUnitsSection({
  quoteId,
  customerName,
  units,
  onUnitsChange,
}: {
  quoteId: string;
  customerName: string;
  units: BoilerUnit[];
  onUnitsChange: (units: BoilerUnit[]) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingUnit, setEditingUnit] = useState<BoilerUnit | null>(null);

  async function handleAdd(unit: Omit<BoilerUnit, "id">) {
    const created = await createBoilerUnit(quoteId, unit, customerName);
    if (created) onUnitsChange([...units, created]);
  }

  async function handleEdit(unit: Omit<BoilerUnit, "id">) {
    if (!editingUnit) return;
    const updated: BoilerUnit = { ...unit, id: editingUnit.id };
    onUnitsChange(units.map((current) => (current.id === updated.id ? updated : current)));
    void updateBoilerUnit(quoteId, updated, customerName);
  }

  async function handleRemove(unit: BoilerUnit) {
    onUnitsChange(units.filter((current) => current.id !== unit.id));
    void deleteBoilerUnit(quoteId, unit.id, unit.label, customerName);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Boilers ({units.length})
      </p>

      {units.map((unit) => (
        <Card key={unit.id} className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {unit.make} {unit.model}
              </p>
              <p className="text-sm text-slate-500">{specLine(unit)}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <p className="text-sm font-semibold text-slate-900">{formatCurrency(unit.price)}</p>
              <div className="flex shrink-0 gap-2">
                <Button variant="primary" className="px-3 py-1.5 text-xs" onClick={() => setEditingUnit(unit)}>
                  Edit
                </Button>
                <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => handleRemove(unit)}>
                  Remove
                </Button>
              </div>
            </div>
          </div>
          {unit.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 px-5 py-3 text-sm text-slate-700"
            >
              <span>
                {item.name} <span className="text-slate-400">&times; {item.quantity}</span>
              </span>
              <span className="font-medium text-slate-900">
                {formatCurrency(item.unitPrice * item.quantity)}
              </span>
            </div>
          ))}
        </Card>
      ))}

      <Button variant="secondary" className="w-fit self-center" onClick={() => setIsAdding(true)}>
        Add boiler
      </Button>

      {isAdding && (
        <UnitFormModal quoteId={quoteId} title="Add boiler" onClose={() => setIsAdding(false)} onSave={handleAdd} />
      )}
      {editingUnit && (
        <UnitFormModal
          quoteId={quoteId}
          title="Edit boiler"
          initial={editingUnit}
          onClose={() => setEditingUnit(null)}
          onSave={handleEdit}
        />
      )}
    </div>
  );
}
