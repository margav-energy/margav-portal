"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { formatCurrency } from "@/lib/format";
import { createQuoteLineItem, deleteQuoteLineItem, updateQuoteLineItem } from "@/components/quotes/actions";
import { findCatalogEntry, type ExtraCatalogEntry } from "@/lib/extras-catalog";
import type { LineItemSection } from "@/types/quote-detail-shared";

interface DisplayItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

const CUSTOM_OPTION = "__custom__";

function ItemFormModal({
  title,
  fieldLabel,
  initial,
  catalog,
  currentItems,
  onClose,
  onSave,
}: {
  title: string;
  fieldLabel: string;
  initial?: DisplayItem;
  /** When set, shows a "Preset" picker above the free-text field (used by the Extras section). */
  catalog?: ExtraCatalogEntry[];
  currentItems?: DisplayItem[];
  onClose: () => void;
  onSave: (item: { name: string; quantity: number; unitPrice: number }) => void;
}) {
  const initialCatalogEntry = initial ? findCatalogEntry(initial.name) : undefined;
  const [preset, setPreset] = useState(initialCatalogEntry?.name ?? CUSTOM_OPTION);
  const [name, setName] = useState(initial?.name ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [unitPrice, setUnitPrice] = useState(String(initial?.unitPrice ?? 0));

  const selectedEntry = catalog ? findCatalogEntry(preset) : undefined;
  const priceLocked = Boolean(selectedEntry?.lockedPrice);

  function handleSelectPreset(value: string) {
    setPreset(value);
    if (value === CUSTOM_OPTION) return;
    const entry = findCatalogEntry(value);
    if (!entry) return;
    setName(entry.name);
    setUnitPrice(String(entry.defaultUnitPrice));
  }

  function handleSave() {
    const finalName = catalog && preset !== CUSTOM_OPTION ? preset : name.trim();
    if (!finalName) return;
    const finalPrice = priceLocked ? 0 : Number(unitPrice) || 0;
    onSave({ name: finalName, quantity: Number(quantity) || 0, unitPrice: finalPrice });
    onClose();
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-4 px-5 py-5">
        {catalog && (
          <FormField label="Preset" htmlFor="item-preset">
            <select
              id="item-preset"
              className={inputClassName}
              value={preset}
              onChange={(event) => handleSelectPreset(event.target.value)}
            >
              <option value={CUSTOM_OPTION}>Custom…</option>
              {catalog.map((entry) => {
                const conflicting = Boolean(
                  entry.group &&
                    entry.name !== initial?.name &&
                    currentItems?.some(
                      (item) => item.name !== initial?.name && findCatalogEntry(item.name)?.group === entry.group,
                    ),
                );
                return (
                  <option key={entry.name} value={entry.name} disabled={conflicting}>
                    {entry.name}
                    {conflicting ? " (already added — pick one)" : ""}
                  </option>
                );
              })}
            </select>
          </FormField>
        )}

        {(!catalog || preset === CUSTOM_OPTION) && (
          <FormField label={fieldLabel} htmlFor="item-name" required>
            {fieldLabel === "Description" ? (
              <textarea
                id="item-name"
                rows={2}
                className={inputClassName}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            ) : (
              <input
                id="item-name"
                className={inputClassName}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </FormField>
        )}
        <FormField label="Quantity" htmlFor="item-quantity">
          <input
            id="item-quantity"
            type="number"
            className={inputClassName}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </FormField>
        <FormField label="Unit price (£)" htmlFor="item-price">
          {priceLocked ? (
            <p className="text-sm text-slate-400">
              <span className="line-through">{formatCurrency(selectedEntry?.defaultUnitPrice ?? 0)}</span>{" "}
              <span className="font-medium text-brand-green-mid">Included — £0.00</span>
            </p>
          ) : (
            <input
              id="item-price"
              type="number"
              step="0.01"
              className={inputClassName}
              value={unitPrice}
              onChange={(event) => setUnitPrice(event.target.value)}
            />
          )}
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

/**
 * Generic "Extras" style section — a titled list of priced line items, each
 * editable/removable, with a running total and an "Add ___" action. Shared
 * by Extras, Standard Additionals, and Free-text Extras across every
 * product vertical — `section` says which `quote_line_items.section` this
 * instance CRUDs against; free-text items are stored in the `description`
 * column instead of `name` (see `supabase/schema.sql`). Pass `catalog` (the
 * Extras section only) to offer named presets instead of pure free text —
 * see `src/lib/extras-catalog.ts`.
 */
export function LineItemsSection({
  quoteId,
  customerName,
  section,
  title,
  items,
  addLabel,
  onItemsChange,
  isFreeText = false,
  catalog,
}: {
  quoteId: string;
  customerName: string;
  section: LineItemSection;
  title: string;
  items: DisplayItem[];
  addLabel: string;
  onItemsChange: (items: DisplayItem[]) => void;
  isFreeText?: boolean;
  catalog?: ExtraCatalogEntry[];
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<DisplayItem | null>(null);
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const fieldLabel = isFreeText ? "Description" : "Name";

  async function handleAdd(data: { name: string; quantity: number; unitPrice: number }) {
    const created = await createQuoteLineItem(quoteId, section, data, customerName);
    if (!created) return;
    const displayItem: DisplayItem = {
      id: created.id,
      name: "description" in created ? created.description : created.name,
      quantity: created.quantity,
      unitPrice: created.unitPrice,
    };
    onItemsChange([...items, displayItem]);
  }

  async function handleEdit(data: { name: string; quantity: number; unitPrice: number }) {
    if (!editingItem) return;
    const updated: DisplayItem = { ...editingItem, ...data };
    onItemsChange(items.map((item) => (item.id === updated.id ? updated : item)));
    void updateQuoteLineItem(quoteId, editingItem.id, section, data, customerName);
  }

  async function handleRemove(item: DisplayItem) {
    onItemsChange(items.filter((current) => current.id !== item.id));
    void deleteQuoteLineItem(quoteId, item.id, section, item.name, customerName);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {title} ({items.length})
      </p>

      {items.map((item, index) => {
        const catalogEntry = catalog ? findCatalogEntry(item.name) : undefined;
        return (
          <Card key={item.id} className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <p className="text-sm font-semibold text-slate-900">
                {title.replace(/s$/, "")} #{index + 1}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button variant="primary" className="px-3 py-1.5 text-xs" onClick={() => setEditingItem(item)}>
                  Edit
                </Button>
                <Button variant="danger" className="px-3 py-1.5 text-xs" onClick={() => handleRemove(item)}>
                  Remove
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm text-slate-700">
              <span>
                {item.name} <span className="text-slate-400">&times; {item.quantity}</span>
              </span>
              {catalogEntry?.lockedPrice ? (
                <span className="font-medium text-brand-green-mid">Included — £0.00</span>
              ) : (
                <span className="font-medium text-slate-900">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </span>
              )}
            </div>
          </Card>
        );
      })}

      {items.length > 0 && (
        <div className="flex items-center justify-end gap-3 px-1 text-sm">
          <span className="text-slate-500">Total</span>
          <span className="font-semibold text-slate-900">{formatCurrency(total)}</span>
        </div>
      )}

      <Button variant="secondary" className="w-fit self-center" onClick={() => setIsAdding(true)}>
        {addLabel}
      </Button>

      {isAdding && (
        <ItemFormModal
          title={addLabel}
          fieldLabel={fieldLabel}
          catalog={catalog}
          currentItems={items}
          onClose={() => setIsAdding(false)}
          onSave={handleAdd}
        />
      )}
      {editingItem && (
        <ItemFormModal
          title={`Edit ${title.replace(/s$/, "").toLowerCase()}`}
          fieldLabel={fieldLabel}
          initial={editingItem}
          catalog={catalog}
          currentItems={items}
          onClose={() => setEditingItem(null)}
          onSave={handleEdit}
        />
      )}
    </div>
  );
}
