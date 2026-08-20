"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { updateBoilerCostSettingsAction, type BoilerCostSettingsFormState } from "@/app/settings/boiler-costs/actions";
import type { BoilerCostSettings } from "@/lib/boiler-install-cost";

const initialState: BoilerCostSettingsFormState = {};

/** One boiler-size row's local (string) form state, before the server action parses it back to numbers. */
interface UnitCostRow {
  key: string;
  kw: string;
  cost: string;
}

function toRows(unitCostsByKw: Record<number, number>): UnitCostRow[] {
  return Object.entries(unitCostsByKw)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([kw, cost]) => ({ key: crypto.randomUUID(), kw, cost: String(cost) }));
}

export function BoilerCostSettingsForm({ settings }: { settings: BoilerCostSettings }) {
  const [state, formAction, pending] = useActionState(updateBoilerCostSettingsAction, initialState);
  const [rows, setRows] = useState<UnitCostRow[]>(() => toRows(settings.unitCostsByKw));

  function updateRow(key: string, field: "kw" | "cost", value: string) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { key: crypto.randomUUID(), kw: "", cost: "" }]);
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5 sm:grid sm:grid-cols-[180px_1fr] sm:gap-4">
        <span className="text-sm font-medium text-slate-600 sm:pt-2 sm:text-right">Boiler unit cost</span>
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  name="unitKw"
                  min="1"
                  step="1"
                  placeholder="kW"
                  value={row.kw}
                  onChange={(event) => updateRow(row.key, "kw", event.target.value)}
                  className={`${inputClassName} w-20`}
                />
                <span className="text-sm text-slate-400">kW</span>
              </div>
              <div className="flex flex-1 items-center gap-1.5">
                <span className="text-sm text-slate-400">£</span>
                <input
                  type="number"
                  name="unitCost"
                  min="0"
                  step="0.01"
                  placeholder="Cost"
                  value={row.cost}
                  onChange={(event) => updateRow(row.key, "cost", event.target.value)}
                  className={inputClassName}
                />
              </div>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                aria-label={`Remove ${row.kw || "this"} kW size`}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="flex w-fit items-center gap-1 text-xs font-medium text-brand-blue hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Add a boiler size
          </button>
        </div>
      </div>

      <FormField label="Fernox System Filter" htmlFor="fernoxSystemFilter" required>
        <input
          id="fernoxSystemFilter"
          name="fernoxSystemFilter"
          type="number"
          min="0"
          step="0.01"
          required
          defaultValue={settings.fernoxSystemFilter}
          className={inputClassName}
        />
      </FormField>
      <FormField label="Gateway with Comfort Touch" htmlFor="gatewayWithComfortTouch" required>
        <input
          id="gatewayWithComfortTouch"
          name="gatewayWithComfortTouch"
          type="number"
          min="0"
          step="0.01"
          required
          defaultValue={settings.gatewayWithComfortTouch}
          className={inputClassName}
        />
      </FormField>
      <FormField label="Installer cost" htmlFor="installerCost" required>
        <input
          id="installerCost"
          name="installerCost"
          type="number"
          min="0"
          step="0.01"
          required
          defaultValue={settings.installerCost}
          className={inputClassName}
        />
      </FormField>
      <FormField label="Cost per sale" htmlFor="costPerSale" required>
        <input
          id="costPerSale"
          name="costPerSale"
          type="number"
          min="0"
          step="0.01"
          required
          defaultValue={settings.costPerSale}
          className={inputClassName}
        />
      </FormField>
      <FormField label="Commission" htmlFor="commission" required>
        <input
          id="commission"
          name="commission"
          type="number"
          min="0"
          step="0.01"
          required
          defaultValue={settings.commission}
          className={inputClassName}
        />
      </FormField>

      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:ml-[196px]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="flex items-center gap-2 rounded-lg bg-brand-green-mid/10 px-3 py-2 text-sm text-brand-green-mid sm:ml-[196px]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Saved. Every boiler quote&rsquo;s Profit card now uses these figures.
        </div>
      )}

      <div className="sm:ml-[196px]">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
