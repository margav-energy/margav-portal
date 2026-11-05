"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { formatCurrency } from "@/lib/format";
import { LineItemRows } from "@/components/quotes/detail/LineItemRows";
import { createSolarArray, deleteSolarArray, updateSolarArray } from "@/components/quotes/actions";
import type { SolarArray } from "@/types/solar-quote";
import type { LineItem } from "@/types/quote-detail-shared";
import { clearDraft, useAutosaveDraft, useDraftRestore } from "@/hooks/useAutosaveDraft";
import { parseModuleFromItems } from "@/lib/mcs/array-inputs";
import { findSolarPanel, SOLAR_PANELS } from "@/lib/solar-catalog";
import { ActionIcon } from "@/components/ui/ActionIcon";

let localIdCounter = 0;

function specLine(array: SolarArray): string {
  const shade = Number(array.shadeFactor.toFixed(2)).toString();
  return `${shade} Shade · ${array.orientation} · ${array.pitchDegrees}° Pitch`;
}

const OTHER_PRODUCT = "__other__";

/** "Solar Array #N" with N one above the highest in use, so deleting an array never causes a duplicate label. */
function nextArrayLabel(arrays: SolarArray[]): string {
  const highest = arrays.reduce((max, array) => {
    const n = Number(/#(\d+)\s*$/.exec(array.label)?.[1]);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);
  return `Solar Array #${Math.max(highest, arrays.length) + 1}`;
}

/** Roof details and product shown one section each, like Spark's "Manage a solar array" page. */
type ArrayForm = {
  pitchDegrees: string;
  orientationDegrees: string;
  shadeFactor: string;
  /** A catalog panel's name, or OTHER_PRODUCT. */
  product: string;
  otherName: string;
  otherWp: string;
  otherUnitPrice: string;
  quantity: string;
  /** Everything else on the array (scaffolding, cable, installation, …). */
  otherItems: LineItem[];
};

function toForm(array?: SolarArray): ArrayForm {
  const moduleItem = array ? array.items.find((item) => parseModuleFromItems([item])) : undefined;
  const catalogPanel = moduleItem ? findSolarPanel(moduleItem.name) : undefined;
  return {
    pitchDegrees: array ? String(array.pitchDegrees) : "",
    orientationDegrees: array?.orientationDegrees != null ? String(array.orientationDegrees) : "",
    shadeFactor: array ? String(array.shadeFactor) : "1",
    // An existing array with no recognisable panel line makes the user choose one, rather than silently adding a priced default.
    product: !moduleItem ? (array ? "" : (SOLAR_PANELS[0]?.name ?? OTHER_PRODUCT)) : catalogPanel ? catalogPanel.name : OTHER_PRODUCT,
    otherName: moduleItem && !catalogPanel ? moduleItem.name : "",
    otherWp: moduleItem && !catalogPanel ? String(parseModuleFromItems([moduleItem])?.wp ?? "") : "",
    // The panel's unit price, editable for any panel; a new array starts from the catalogue price.
    otherUnitPrice: moduleItem ? String(moduleItem.unitPrice) : array ? "" : String(SOLAR_PANELS[0]?.unitPrice ?? ""),
    quantity: moduleItem ? String(moduleItem.quantity) : array ? "" : "1",
    otherItems: array ? array.items.filter((item) => item !== moduleItem) : [],
  };
}

function isArrayFormDraft(value: unknown): value is ArrayForm {
  if (!value || typeof value !== "object") return false;
  const draft = value as Record<string, unknown>;
  const strings = ["pitchDegrees", "orientationDegrees", "shadeFactor", "product", "otherName", "otherWp", "otherUnitPrice", "quantity"];
  return strings.every((key) => typeof draft[key] === "string") && Array.isArray(draft.otherItems);
}

function ArrayFormModal({
  quoteId,
  title,
  initial,
  nextLabel,
  onClose,
  onSave,
}: {
  quoteId: string;
  title: string;
  initial?: SolarArray;
  /** Name given to a new array, e.g. "Solar Array #2". */
  nextLabel: string;
  onClose: () => void;
  onSave: (array: Omit<SolarArray, "id">) => void;
}) {
  // Autosaved locally so an in-progress add/edit survives a crash/restart before Save is
  // clicked. Keyed by the array being edited (or "new" while adding) so switching between
  // arrays never mixes up drafts.
  // "v2": drafts saved by the earlier form layout have a different shape and must never be restored into this one.
  const draftKey = `solar-array-draft-v2-${quoteId}-${initial?.id ?? "new"}`;
  const [form, setForm] = useState<ArrayForm>(() => toForm(initial));
  const [draftApplied, setDraftApplied] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<"pitch" | "orientation" | "shade" | "product" | "quantity", string>>>({});
  useDraftRestore<ArrayForm>(draftKey, (draft) => {
    // Ignore anything that isn't a complete draft of this form (corrupt or left by an older version).
    if (!isArrayFormDraft(draft)) return;
    setForm(draft);
    setDraftApplied(true);
  });

  useAutosaveDraft(draftKey, form);

  function set<K extends keyof ArrayForm>(key: K, value: ArrayForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectProduct(product: string) {
    const panel = findSolarPanel(product);
    // Choosing a catalogue panel fills in its price; the price stays editable.
    setForm((current) => ({ ...current, product, ...(panel ? { otherUnitPrice: String(panel.unitPrice) } : {}) }));
  }

  function handleClose() {
    clearDraft(draftKey);
    onClose();
  }

  function addItem() {
    set("otherItems", [...form.otherItems, { id: `local-${localIdCounter++}`, name: "", quantity: 1, unitPrice: 0 }]);
  }

  function updateItem(index: number, patch: Partial<LineItem>) {
    set(
      "otherItems",
      form.otherItems.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(index: number) {
    set(
      "otherItems",
      form.otherItems.filter((_, i) => i !== index),
    );
  }

  function handleSave() {
    const pitch = Number(form.pitchDegrees);
    const orientation = Number(form.orientationDegrees);
    const shade = Number(form.shadeFactor);
    const quantity = Number(form.quantity);
    const catalogPanel = findSolarPanel(form.product);
    const next: typeof errors = {};

    if (form.pitchDegrees.trim() === "" || !Number.isInteger(pitch) || pitch < 0 || pitch > 90) next.pitch = "Roof pitch must be a whole number of degrees, 0–90.";
    if (form.orientationDegrees.trim() === "" || !Number.isInteger(orientation) || orientation < 0 || orientation > 175 || orientation % 5 !== 0) {
      next.orientation = "Orientation must be 0–175 degrees from south, in increments of 5.";
    }
    if (form.shadeFactor.trim() === "" || !Number.isFinite(shade) || shade <= 0 || shade > 1) next.shade = "Shading factor must be above 0 and no more than 1.";
    if (!Number.isInteger(quantity) || quantity < 1) next.quantity = "Quantity must be a whole number, 1 or more.";
    if (form.product === "") next.product = "Choose the panel for this array.";
    else if (!catalogPanel && (form.otherName.trim() === "" || !(Number(form.otherWp) > 0))) next.product = "Enter the panel name and its rating in watts.";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const unitPrice = Number(form.otherUnitPrice) || 0;
    const panelItem: LineItem = {
      id: `local-${localIdCounter++}`,
      name: catalogPanel ? catalogPanel.name : form.otherName.trim(),
      quantity,
      unitPrice,
    };

    onSave({
      label: initial?.label ?? nextLabel,
      // Same style as the rest of the quote ("0° South", "90° South"): degrees from due south.
      orientation: `${orientation}° South`,
      orientationDegrees: orientation,
      shadeFactor: shade,
      pitchDegrees: pitch,
      moduleWp: catalogPanel ? catalogPanel.wp : Math.round(Number(form.otherWp)),
      moduleCount: quantity,
      items: [panelItem, ...form.otherItems.filter((item) => item.name.trim().length > 0)],
    });
    clearDraft(draftKey);
    onClose();
  }

  return (
    <Modal title={title} onClose={handleClose}>
      <div className="flex flex-col gap-5 px-5 py-5">
        {draftApplied && (
          <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Unsaved changes from your last session were restored.
          </div>
        )}

        <section className="flex flex-col gap-4">
          <h4 className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Solar array roof details</h4>
          <FormField label="Roof pitch" htmlFor="array-pitch" required error={errors.pitch}>
            <input
              id="array-pitch"
              type="number"
              min={0}
              max={90}
              step={1}
              className={inputClassName}
              value={form.pitchDegrees}
              onChange={(event) => set("pitchDegrees", event.target.value)}
            />
            <p className="text-xs text-slate-500">In increments of 1°</p>
          </FormField>
          <FormField label="Orientation" htmlFor="array-orientation" required error={errors.orientation}>
            <input
              id="array-orientation"
              type="number"
              min={0}
              max={175}
              step={5}
              className={inputClassName}
              value={form.orientationDegrees}
              onChange={(event) => set("orientationDegrees", event.target.value)}
            />
            <p className="text-xs text-slate-500">Degrees from south must not exceed 175° and be in increments of 5</p>
          </FormField>
          <FormField label="Shading factor" htmlFor="array-shade" required error={errors.shade}>
            <input
              id="array-shade"
              type="number"
              min={0}
              max={1}
              step={0.01}
              className={inputClassName}
              value={form.shadeFactor}
              onChange={(event) => set("shadeFactor", event.target.value)}
            />
            <p className="text-xs text-slate-500">Shading factor between 0 and 1</p>
          </FormField>
        </section>

        <section className="flex flex-col gap-4">
          <h4 className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Product</h4>
          <FormField label="Product" htmlFor="array-product" required error={errors.product}>
            <select
              id="array-product"
              className={inputClassName}
              value={form.product}
              onChange={(event) => selectProduct(event.target.value)}
            >
              {form.product === "" && (
                <option value="" disabled>
                  Choose a panel…
                </option>
              )}
              {SOLAR_PANELS.map((panel) => (
                <option key={panel.name} value={panel.name}>
                  {panel.name}
                </option>
              ))}
              <option value={OTHER_PRODUCT}>Other panel…</option>
            </select>
          </FormField>
          {form.product === OTHER_PRODUCT && (
            <>
              <FormField label="Panel name" htmlFor="array-other-name" required>
                <input id="array-other-name" className={inputClassName} value={form.otherName} onChange={(event) => set("otherName", event.target.value)} />
              </FormField>
              <FormField label="Rating (W)" htmlFor="array-other-wp" required>
                <input
                  id="array-other-wp"
                  type="number"
                  min={1}
                  className={inputClassName}
                  value={form.otherWp}
                  onChange={(event) => set("otherWp", event.target.value)}
                  placeholder="Label watts at STC, e.g. 440"
                />
              </FormField>
            </>
          )}
          <FormField label="Unit price (£)" htmlFor="array-other-price">
            <input
              id="array-other-price"
              type="number"
              min="0"
              step="0.01"
              className={inputClassName}
              value={form.otherUnitPrice}
              onChange={(event) => set("otherUnitPrice", event.target.value)}
            />
            {Number(form.quantity) > 0 && Number(form.otherUnitPrice) > 0 && (
              <p className="text-xs text-slate-500">
                Panels total: {formatCurrency(Number(form.otherUnitPrice) * Number(form.quantity))}
              </p>
            )}
          </FormField>
          <FormField label="Quantity" htmlFor="array-quantity" required error={errors.quantity}>
            <input
              id="array-quantity"
              type="number"
              min={1}
              step={1}
              className={inputClassName}
              value={form.quantity}
              onChange={(event) => set("quantity", event.target.value)}
            />
            {Number(form.quantity) > 0 && (findSolarPanel(form.product) || Number(form.otherWp) > 0) && (
              <p className="text-xs text-slate-500">
                Array size: {(((findSolarPanel(form.product)?.wp ?? Number(form.otherWp)) * Number(form.quantity)) / 1000).toFixed(2)} kWp
              </p>
            )}
          </FormField>
        </section>

        <section className="flex flex-col gap-3">
          <h4 className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">Other items in this array</h4>
          <div className="flex flex-col gap-2">
            {form.otherItems.map((item, index) => (
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
              Add item
            </Button>
          </div>
        </section>
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

export function SolarArraySection({
  quoteId,
  customerName,
  arrays,
  onArraysChange,
  locked = false,
}: {
  quoteId: string;
  customerName: string;
  arrays: SolarArray[];
  onArraysChange: (arrays: SolarArray[]) => void;
  /** Mirrors the quote's Lock/Unlock toggle (QuoteHeader.tsx) — disables Add/Edit/Remove while locked. */
  locked?: boolean;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingArray, setEditingArray] = useState<SolarArray | null>(null);

  async function handleAdd(array: Omit<SolarArray, "id">) {
    const created = await createSolarArray(quoteId, array, customerName);
    if (created) onArraysChange([...arrays, created]);
  }

  async function handleEdit(array: Omit<SolarArray, "id">) {
    if (!editingArray) return;
    const updated: SolarArray = { ...array, id: editingArray.id };
    onArraysChange(arrays.map((current) => (current.id === updated.id ? updated : current)));
    void updateSolarArray(quoteId, updated, customerName);
  }

  async function handleRemove(array: SolarArray) {
    onArraysChange(arrays.filter((current) => current.id !== array.id));
    void deleteSolarArray(quoteId, array.id, array.label, customerName);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Solar Array ({arrays.length})
      </p>

      {arrays.map((array) => (
        <Card key={array.id} className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-slate-900">{array.label}</p>
              <p className="rounded-md bg-white px-3 py-1 text-xs text-slate-600">{specLine(array)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <ActionIcon action="edit" onClick={() => setEditingArray(array)} disabled={locked} title={locked ? "Unlock this quote to make changes" : undefined} />
              <ActionIcon action="delete" label="Remove" onClick={() => handleRemove(array)} disabled={locked} title={locked ? "Unlock this quote to make changes" : undefined} />
            </div>
          </div>
          <LineItemRows items={array.items} foldable />
        </Card>
      ))}

      <Button
        variant="secondary"
        className="w-fit self-center"
        onClick={() => setIsAdding(true)}
        disabled={locked}
        title={locked ? "Unlock this quote to make changes" : undefined}
      >
        Add solar array
      </Button>

      {isAdding && (
        <ArrayFormModal
          quoteId={quoteId}
          title="Add solar array"
          nextLabel={nextArrayLabel(arrays)}
          onClose={() => setIsAdding(false)}
          onSave={handleAdd}
        />
      )}
      {editingArray && (
        <ArrayFormModal
          quoteId={quoteId}
          title="Edit solar array"
          initial={editingArray}
          nextLabel={editingArray.label}
          onClose={() => setEditingArray(null)}
          onSave={handleEdit}
        />
      )}
    </div>
  );
}
