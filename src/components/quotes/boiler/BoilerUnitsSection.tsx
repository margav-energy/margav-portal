"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { formatCurrency } from "@/lib/format";
import { createBoilerUnit, deleteBoilerUnit, updateBoilerUnit } from "@/components/quotes/actions";
import type { BoilerUnit, FuelType, FlueType, BoilerInstallType } from "@/types/boiler-quote";
import type { LineItem } from "@/types/quote-detail-shared";

const FUEL_TYPES: FuelType[] = ["Mains Gas", "LPG", "Oil"];
const FLUE_TYPES: FlueType[] = ["Horizontal", "Vertical"];
const INSTALL_TYPES: BoilerInstallType[] = ["Combi", "System", "Open Vent"];

let localIdCounter = 0;

function specLine(unit: BoilerUnit): string {
  const parts = [`${unit.outputKw}kW`, unit.installType, unit.fuelType, `${unit.flueType} Flue`];
  if (unit.cylinderLitres) parts.push(`${unit.cylinderLitres}L Cylinder`);
  parts.push(`${unit.warrantyYears}yr Warranty`);
  return parts.join(" · ");
}

type UnitForm = Omit<BoilerUnit, "id" | "outputKw" | "cylinderLitres" | "warrantyYears" | "items"> & {
  outputKw: string;
  cylinderLitres: string;
  warrantyYears: string;
  items: LineItem[];
};

function toForm(unit?: BoilerUnit): UnitForm {
  return {
    label: unit?.label ?? "",
    make: unit?.make ?? "",
    model: unit?.model ?? "",
    outputKw: unit ? String(unit.outputKw) : "",
    fuelType: unit?.fuelType ?? "Mains Gas",
    flueType: unit?.flueType ?? "Horizontal",
    installType: unit?.installType ?? "Combi",
    cylinderLitres: unit?.cylinderLitres != null ? String(unit.cylinderLitres) : "",
    warrantyYears: unit ? String(unit.warrantyYears) : "",
    items: unit?.items ?? [],
  };
}

function UnitFormModal({
  title,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  initial?: BoilerUnit;
  onClose: () => void;
  onSave: (unit: Omit<BoilerUnit, "id">) => void;
}) {
  const [form, setForm] = useState<UnitForm>(() => toForm(initial));

  function set<K extends keyof UnitForm>(key: K, value: UnitForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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

  function handleSave() {
    if (!form.label.trim()) return;
    onSave({
      label: form.label.trim(),
      make: form.make.trim(),
      model: form.model.trim(),
      outputKw: Number(form.outputKw) || 0,
      fuelType: form.fuelType,
      flueType: form.flueType,
      installType: form.installType,
      cylinderLitres: form.cylinderLitres ? Number(form.cylinderLitres) : undefined,
      warrantyYears: Number(form.warrantyYears) || 0,
      items: form.items.filter((item) => item.name.trim().length > 0),
    });
    onClose();
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-4 px-5 py-5">
        <FormField label="Label" htmlFor="unit-label" required>
          <input
            id="unit-label"
            className={inputClassName}
            value={form.label}
            onChange={(event) => set("label", event.target.value)}
          />
        </FormField>
        <FormField label="Make" htmlFor="unit-make">
          <input
            id="unit-make"
            className={inputClassName}
            value={form.make}
            onChange={(event) => set("make", event.target.value)}
          />
        </FormField>
        <FormField label="Model" htmlFor="unit-model">
          <input
            id="unit-model"
            className={inputClassName}
            value={form.model}
            onChange={(event) => set("model", event.target.value)}
          />
        </FormField>
        <FormField label="Output (kW)" htmlFor="unit-output">
          <input
            id="unit-output"
            type="number"
            className={inputClassName}
            value={form.outputKw}
            onChange={(event) => set("outputKw", event.target.value)}
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
            onChange={(event) => set("installType", event.target.value as BoilerInstallType)}
          >
            {INSTALL_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Cylinder (L)" htmlFor="unit-cylinder">
          <input
            id="unit-cylinder"
            type="number"
            className={inputClassName}
            value={form.cylinderLitres}
            onChange={(event) => set("cylinderLitres", event.target.value)}
            placeholder="Leave blank for combi"
          />
        </FormField>
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
                {unit.label} &middot; {unit.make} {unit.model}
              </p>
              <p className="text-sm text-slate-500">{specLine(unit)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="primary" className="px-3 py-1.5 text-xs" onClick={() => setEditingUnit(unit)}>
                Edit
              </Button>
              <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => handleRemove(unit)}>
                Remove
              </Button>
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
        <UnitFormModal title="Add boiler" onClose={() => setIsAdding(false)} onSave={handleAdd} />
      )}
      {editingUnit && (
        <UnitFormModal
          title="Edit boiler"
          initial={editingUnit}
          onClose={() => setEditingUnit(null)}
          onSave={handleEdit}
        />
      )}
    </div>
  );
}
