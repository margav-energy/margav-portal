"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { LineItemRows } from "@/components/quotes/detail/LineItemRows";
import { formatCurrency } from "@/lib/format";
import { createSolarEquipment, deleteSolarEquipment, updateSolarEquipment } from "@/components/quotes/actions";
import type { EquipmentKindConfig } from "@/lib/solar-catalog";
import type { LineItem } from "@/types/quote-detail-shared";
import type { SolarEquipment } from "@/types/solar-quote";
import { ActionIcon } from "@/components/ui/ActionIcon";

let localIdCounter = 0;
const CUSTOM = "__custom__";

type EquipmentForm = {
  /** A preset's name, or CUSTOM. */
  product: string;
  customName: string;
  unitPrice: string;
  quantity: string;
  /** Everything under the main product (mounting, application fees, labels, …). */
  accessories: LineItem[];
};

function newId(): string {
  return `local-${localIdCounter++}`;
}

function presetAccessories(accessories: { name: string; quantity: number; unitPrice: number }[]): LineItem[] {
  return accessories.map((accessory) => ({ id: newId(), ...accessory }));
}

function toForm(config: EquipmentKindConfig, entry?: SolarEquipment): EquipmentForm {
  if (!entry || entry.items.length === 0) {
    const first = config.presets[0];
    return first
      ? { product: first.name, customName: "", unitPrice: String(first.unitPrice), quantity: "1", accessories: presetAccessories(first.accessories) }
      : { product: CUSTOM, customName: "", unitPrice: "", quantity: "1", accessories: [] };
  }
  const [main, ...rest] = entry.items;
  const preset = config.presets.find((candidate) => candidate.name === main.name);
  return {
    product: preset ? preset.name : CUSTOM,
    customName: preset ? "" : main.name,
    unitPrice: String(main.unitPrice),
    quantity: String(main.quantity),
    accessories: rest,
  };
}

/** "Inverter #N" with N one above the highest in use, so deleting an entry never causes a duplicate label. */
function nextLabel(singular: string, entries: SolarEquipment[]): string {
  const highest = entries.reduce((max, entry) => {
    const n = Number(/#(\d+)\s*$/.exec(entry.label)?.[1]);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  return `${singular} #${Math.max(highest, entries.length) + 1}`;
}

function EquipmentFormModal({
  config,
  title,
  initial,
  label,
  onClose,
  onSave,
}: {
  config: EquipmentKindConfig;
  title: string;
  initial?: SolarEquipment;
  label: string;
  onClose: () => void;
  onSave: (items: LineItem[]) => void;
}) {
  const [form, setForm] = useState<EquipmentForm>(() => toForm(config, initial));
  const [errors, setErrors] = useState<Partial<Record<"name" | "quantity", string>>>({});

  function set<K extends keyof EquipmentForm>(key: K, value: EquipmentForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectProduct(product: string) {
    const preset = config.presets.find((candidate) => candidate.name === product);
    setForm((current) =>
      preset
        ? { ...current, product, unitPrice: String(preset.unitPrice), accessories: presetAccessories(preset.accessories) }
        : { ...current, product },
    );
  }

  function updateAccessory(index: number, patch: Partial<LineItem>) {
    set(
      "accessories",
      form.accessories.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function handleSave() {
    const quantity = Number(form.quantity);
    const name = form.product === CUSTOM ? form.customName.trim() : form.product;
    const next: typeof errors = {};
    if (!name) next.name = "Enter a product name.";
    if (!Number.isInteger(quantity) || quantity < 1) next.quantity = "Quantity must be a whole number, 1 or more.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    onSave([
      { id: newId(), name, quantity, unitPrice: Number(form.unitPrice) || 0 },
      ...form.accessories.filter((item) => item.name.trim().length > 0),
    ]);
    onClose();
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-5 px-5 py-5">
        <p className="text-xs text-slate-500">{label}</p>
        <section className="flex flex-col gap-4">
          <h4 className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Product</h4>
          <FormField label="Product" htmlFor="equipment-product" required error={errors.name}>
            <select
              id="equipment-product"
              className={inputClassName}
              value={form.product}
              onChange={(event) => selectProduct(event.target.value)}
            >
              {config.presets.map((preset) => (
                <option key={preset.name} value={preset.name}>
                  {preset.name}
                </option>
              ))}
              <option value={CUSTOM}>Custom…</option>
            </select>
          </FormField>
          {form.product === CUSTOM && (
            <FormField label="Product name" htmlFor="equipment-name" required>
              <input
                id="equipment-name"
                className={inputClassName}
                value={form.customName}
                onChange={(event) => set("customName", event.target.value)}
              />
            </FormField>
          )}
          <FormField label="Unit price (£)" htmlFor="equipment-price">
            <input
              id="equipment-price"
              type="number"
              step="0.01"
              className={inputClassName}
              value={form.unitPrice}
              onChange={(event) => set("unitPrice", event.target.value)}
            />
          </FormField>
          <FormField label="Quantity" htmlFor="equipment-quantity" required error={errors.quantity}>
            <input
              id="equipment-quantity"
              type="number"
              min={1}
              step={1}
              className={inputClassName}
              value={form.quantity}
              onChange={(event) => set("quantity", event.target.value)}
            />
          </FormField>
        </section>

        <section className="flex flex-col gap-3">
          <h4 className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Other items</h4>
          <div className="flex flex-col gap-2">
            {form.accessories.map((item, index) => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  className={inputClassName}
                  placeholder="Name"
                  value={item.name}
                  onChange={(event) => updateAccessory(index, { name: event.target.value })}
                />
                <input
                  type="number"
                  className={`${inputClassName} w-20`}
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(event) => updateAccessory(index, { quantity: Number(event.target.value) })}
                />
                <input
                  type="number"
                  className={`${inputClassName} w-28`}
                  placeholder="Unit price"
                  value={item.unitPrice}
                  onChange={(event) => updateAccessory(index, { unitPrice: Number(event.target.value) })}
                />
                <button
                  type="button"
                  onClick={() =>
                    set(
                      "accessories",
                      form.accessories.filter((_, i) => i !== index),
                    )
                  }
                  aria-label="Remove item"
                  className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              variant="secondary"
              className="w-fit gap-1 text-xs"
              onClick={() => set("accessories", [...form.accessories, { id: newId(), name: "", quantity: 1, unitPrice: 0 }])}
            >
              <Plus className="h-3.5 w-3.5" />
              Add item
            </Button>
          </div>
        </section>
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

/** One equipment section (Inverter, Battery, …): its entries, a running total and an Add button. */
export function SolarEquipmentSection({
  quoteId,
  customerName,
  config,
  equipment,
  onEquipmentChange,
  locked = false,
}: {
  quoteId: string;
  customerName: string;
  config: EquipmentKindConfig;
  /** Every equipment entry on the quote — this section shows and edits only its own kind. */
  equipment: SolarEquipment[];
  onEquipmentChange: (equipment: SolarEquipment[]) => void;
  /** Mirrors the quote's Lock/Unlock toggle — disables Add/Edit/Remove while locked. */
  locked?: boolean;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<SolarEquipment | null>(null);
  const entries = equipment.filter((entry) => entry.kind === config.kind);
  const total = entries.flatMap((entry) => entry.items).reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  async function handleAdd(items: LineItem[]) {
    const created = await createSolarEquipment(
      quoteId,
      { kind: config.kind, label: nextLabel(config.singular, entries), items },
      customerName,
    );
    if (created) onEquipmentChange([...equipment, created]);
  }

  function handleEdit(items: LineItem[]) {
    if (!editing) return;
    const updated: SolarEquipment = { ...editing, items };
    onEquipmentChange(equipment.map((entry) => (entry.id === updated.id ? updated : entry)));
    void updateSolarEquipment(quoteId, updated, customerName);
  }

  function handleRemove(entry: SolarEquipment) {
    onEquipmentChange(equipment.filter((current) => current.id !== entry.id));
    void deleteSolarEquipment(quoteId, entry.id, entry.label, customerName);
  }

  const lockedTitle = locked ? "Unlock this quote to make changes" : undefined;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {config.title} ({entries.length})
      </p>

      {entries.map((entry) => (
        <Card key={entry.id} className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 bg-slate-50 px-5 py-3">
            <p className="text-sm font-semibold text-slate-900">{entry.label}</p>
            <div className="flex shrink-0 gap-2">
              <ActionIcon action="edit" onClick={() => setEditing(entry)} disabled={locked} title={lockedTitle} />
              <ActionIcon action="delete" label="Remove" onClick={() => handleRemove(entry)} disabled={locked} title={lockedTitle} />
            </div>
          </div>
          <LineItemRows items={entry.items} foldable />
        </Card>
      ))}

      {entries.length > 0 && (
        <div className="flex items-center justify-end gap-3 px-1 text-sm">
          <span className="text-slate-500">Total</span>
          <span className="font-semibold text-slate-900">{formatCurrency(total)}</span>
        </div>
      )}

      <Button variant="secondary" className="w-fit self-center" onClick={() => setIsAdding(true)} disabled={locked} title={lockedTitle}>
        {config.addLabel}
      </Button>

      {isAdding && (
        <EquipmentFormModal
          config={config}
          title={config.addLabel}
          label={nextLabel(config.singular, entries)}
          onClose={() => setIsAdding(false)}
          onSave={handleAdd}
        />
      )}
      {editing && (
        <EquipmentFormModal
          config={config}
          title={`Edit ${config.singular.toLowerCase()}`}
          initial={editing}
          label={editing.label}
          onClose={() => setEditing(null)}
          onSave={handleEdit}
        />
      )}
    </div>
  );
}
