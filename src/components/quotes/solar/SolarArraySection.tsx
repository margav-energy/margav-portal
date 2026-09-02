"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { formatCurrency } from "@/lib/format";
import { createSolarArray, deleteSolarArray, updateSolarArray } from "@/components/quotes/actions";
import type { SolarArray } from "@/types/solar-quote";
import type { LineItem } from "@/types/quote-detail-shared";
import { clearDraft, loadDraft, useAutosaveDraft } from "@/hooks/useAutosaveDraft";

let localIdCounter = 0;

function specLine(array: SolarArray): string {
  const shade = Number(array.shadeFactor.toFixed(2)).toString();
  return `${shade} Shade · ${array.orientation} · ${array.pitchDegrees}° Pitch`;
}

type ArrayForm = Omit<SolarArray, "id" | "shadeFactor" | "pitchDegrees" | "items"> & {
  shadeFactor: string;
  pitchDegrees: string;
  items: LineItem[];
};

function toForm(array?: SolarArray): ArrayForm {
  return {
    label: array?.label ?? "",
    orientation: array?.orientation ?? "",
    shadeFactor: array ? String(array.shadeFactor) : "1",
    pitchDegrees: array ? String(array.pitchDegrees) : "",
    items: array?.items ?? [],
  };
}

function ArrayFormModal({
  quoteId,
  title,
  initial,
  onClose,
  onSave,
}: {
  quoteId: string;
  title: string;
  initial?: SolarArray;
  onClose: () => void;
  onSave: (array: Omit<SolarArray, "id">) => void;
}) {
  // Autosaved locally so an in-progress add/edit survives a crash/restart before Save is
  // clicked. Keyed by the array being edited (or "new" while adding) so switching between
  // arrays never mixes up drafts.
  const draftKey = `solar-array-draft-${quoteId}-${initial?.id ?? "new"}`;
  const [form, setForm] = useState<ArrayForm>(() => loadDraft<ArrayForm>(draftKey) ?? toForm(initial));
  const [draftRestored] = useState(() => loadDraft<ArrayForm>(draftKey) !== null);

  useAutosaveDraft(draftKey, form);

  function set<K extends keyof ArrayForm>(key: K, value: ArrayForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleClose() {
    clearDraft(draftKey);
    onClose();
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
      orientation: form.orientation.trim(),
      shadeFactor: Number(form.shadeFactor) || 1,
      pitchDegrees: Number(form.pitchDegrees) || 0,
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
        <FormField label="Label" htmlFor="array-label" required>
          <input
            id="array-label"
            className={inputClassName}
            value={form.label}
            onChange={(event) => set("label", event.target.value)}
          />
        </FormField>
        <FormField label="Orientation" htmlFor="array-orientation">
          <input
            id="array-orientation"
            className={inputClassName}
            value={form.orientation}
            onChange={(event) => set("orientation", event.target.value)}
            placeholder="e.g. 40° South"
          />
        </FormField>
        <FormField label="Shade Factor" htmlFor="array-shade">
          <input
            id="array-shade"
            type="number"
            step="0.01"
            className={inputClassName}
            value={form.shadeFactor}
            onChange={(event) => set("shadeFactor", event.target.value)}
          />
        </FormField>
        <FormField label="Pitch (°)" htmlFor="array-pitch">
          <input
            id="array-pitch"
            type="number"
            className={inputClassName}
            value={form.pitchDegrees}
            onChange={(event) => set("pitchDegrees", event.target.value)}
          />
        </FormField>

        <FormField label="Line items" htmlFor="array-items">
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

export function SolarArraySection({
  quoteId,
  customerName,
  arrays,
  onArraysChange,
}: {
  quoteId: string;
  customerName: string;
  arrays: SolarArray[];
  onArraysChange: (arrays: SolarArray[]) => void;
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
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">{array.label}</p>
              <p className="text-sm text-slate-500">{specLine(array)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="primary" className="px-3 py-1.5 text-xs" onClick={() => setEditingArray(array)}>
                Edit
              </Button>
              <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => handleRemove(array)}>
                Remove
              </Button>
            </div>
          </div>
          {array.items.map((item) => (
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
        Add solar array
      </Button>

      {isAdding && (
        <ArrayFormModal quoteId={quoteId} title="Add solar array" onClose={() => setIsAdding(false)} onSave={handleAdd} />
      )}
      {editingArray && (
        <ArrayFormModal
          quoteId={quoteId}
          title="Edit solar array"
          initial={editingArray}
          onClose={() => setEditingArray(null)}
          onSave={handleEdit}
        />
      )}
    </div>
  );
}
