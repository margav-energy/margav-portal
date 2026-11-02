"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { SolarMcsEstimateView } from "@/components/quotes/solar/SolarMcsEstimateView";
import {
  updateQuoteBatteryUsableKwh,
  updateQuoteSapAssumptions,
} from "@/components/quotes/actions";
import { formatCurrency } from "@/lib/format";
import {
  computeSapTable,
  DEFAULT_SAP_ASSUMPTIONS,
  isOutOfMcsRange,
} from "@/lib/solar-sap";
import type { McsEstimate } from "@/lib/mcs/performance-estimate";
import type { SapAssumptions, TemplateYear1 } from "@/types/solar-quote";

type FieldKey = Exclude<keyof SapAssumptions, "templateYear1">;

const FIELDS: { key: FieldKey; label: string; step: string; help?: string }[] =
  [
    {
      key: "exportRatePerKwh",
      label: "Export rate (£ per kWh)",
      step: "0.0001",
      help: "e.g. the Smart Export Guarantee tariff.",
    },
    {
      key: "electricityPriceGrowthPct",
      label: "Electricity price rise per year (%)",
      step: "0.01",
    },
    {
      key: "exportRateGrowthPct",
      label: "Export rate change per year (%)",
      step: "0.01",
    },
    {
      key: "outputDegradationPct",
      label: "Output fall per year (%)",
      step: "0.01",
      help: "Module degradation — see the module datasheet.",
    },
    {
      key: "annualCosts",
      label: "Annual costs (£)",
      step: "0.01",
      help: "e.g. finance repayments.",
    },
    { key: "year1ExtraCost", label: "Extra year 1 cost (£)", step: "0.01" },
    { key: "costTermYears", label: "Years costs are paid", step: "1" },
    {
      key: "replacementCost",
      label: "Replacement cost (£)",
      step: "0.01",
      help: "e.g. an inverter replacement. Leave at 0 if none.",
    },
    {
      key: "replacementEveryYears",
      label: "Replaced every (years)",
      step: "1",
      help: "Paid in each year that is a multiple of this, e.g. 15 means years 15 and 30.",
    },
  ];

const YEAR1_FIELDS: {
  key: keyof TemplateYear1;
  label: string;
  step: string;
}[] = [
  { key: "outputKwh", label: "Year 1 output (kWh)", step: "1" },
  { key: "solar", label: "Year 1 solar saving (£)", step: "0.01" },
  { key: "battery", label: "Year 1 battery saving (£)", step: "0.01" },
  { key: "exportIncome", label: "Year 1 export income (£)", step: "0.01" },
];

const HEADERS = [
  "Year",
  "Output",
  "Solar",
  "Battery",
  "Export",
  "Savings",
  "Costs",
  "Net position",
];

type View = "table" | "assumptions" | "battery";

/**
 * "Quote SAP table" modal: the MCS performance estimate first (the official,
 * first-year figures), then the 30-year projection below it — labelled as an
 * additional estimate, as MIS 3002 §4.1.8 requires, with the
 * assumptions behind it listed. Admins edit the assumptions and the
 * battery's usable capacity from here.
 */
export function SolarSapTableModal({
  quoteId,
  customerName,
  estimate,
  electricUnitRate,
  batteryCount,
  batteryUsableKwh,
  assumptions,
  canEdit,
  onClose,
}: {
  quoteId: string;
  customerName: string;
  estimate: McsEstimate;
  /** £ per kWh from the quote's property details. */
  electricUnitRate: number;
  batteryCount: number;
  batteryUsableKwh: number;
  assumptions: SapAssumptions | undefined;
  canEdit: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(assumptions);
  const [view, setView] = useState<View>("table");
  const [form, setForm] = useState<Record<FieldKey, string>>(() =>
    toForm(assumptions ?? DEFAULT_SAP_ASSUMPTIONS),
  );
  const [year1Form, setYear1Form] = useState<
    Record<keyof TemplateYear1, string>
  >(() => toYear1Form(assumptions?.templateYear1));
  const [batteryForm, setBatteryForm] = useState(
    batteryUsableKwh > 0 ? String(batteryUsableKwh) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // MCS can't give a first year above its table limits, so those quotes use hand-entered year 1 figures instead.
  const templateMode = isOutOfMcsRange(estimate);
  const rows = useMemo(
    () =>
      saved ? computeSapTable(estimate, electricUnitRate, saved) : undefined,
    [saved, estimate, electricUnitRate],
  );

  async function handleSaveAssumptions() {
    const parsed = parseForm(form);
    if (!parsed) {
      setError(
        "Enter a number in every field (years must be a whole number, 0–30).",
      );
      return;
    }
    if (templateMode) {
      const year1 = parseYear1Form(year1Form);
      if (!year1) {
        setError("Enter all four year 1 figures — output must be above 0.");
        return;
      }
      parsed.templateYear1 = year1;
    } else if (saved?.templateYear1) {
      parsed.templateYear1 = saved.templateYear1;
    }
    setIsSaving(true);
    setError(null);
    const ok = await updateQuoteSapAssumptions(quoteId, parsed, customerName);
    setIsSaving(false);
    if (!ok) {
      setError(
        "Could not save — the quote may be locked, or a value is out of range.",
      );
      return;
    }
    setSaved(parsed);
    setView("table");
    router.refresh();
  }

  async function handleSaveBattery() {
    const value = batteryForm.trim() === "" ? 0 : Number(batteryForm);
    if (!Number.isFinite(value) || value < 0) {
      setError("Enter the usable capacity in kWh.");
      return;
    }
    setIsSaving(true);
    setError(null);
    const ok = await updateQuoteBatteryUsableKwh(quoteId, value, customerName);
    setIsSaving(false);
    if (!ok) {
      setError("Could not save — the quote may be locked.");
      return;
    }
    // The estimate is built on the server, so close and let the page refresh with it.
    router.refresh();
    onClose();
  }

  if (view !== "table" && canEdit) {
    const isBattery = view === "battery";
    return (
      <Modal
        title={
          isBattery
            ? "Battery usable capacity"
            : "30-year projection assumptions"
        }
        onClose={onClose}
      >
        <div className="flex flex-col gap-4 px-5 py-5">
          {isBattery ? (
            <>
              <p className="text-xs text-slate-500">
                The usable capacity used for self-consumption (MGD 003 §4.5):
                the datasheet&apos;s usable capacity, or nominal capacity ×
                depth of discharge (50% lead acid, 90% other chemistries unless
                the datasheet says otherwise), less any capacity permanently
                reserved for backup.
              </p>
              <FormField label="Usable capacity (kWh)" htmlFor="battery-usable">
                <input
                  id="battery-usable"
                  type="number"
                  step="0.1"
                  className={inputClassName}
                  value={batteryForm}
                  onChange={(event) => setBatteryForm(event.target.value)}
                />
              </FormField>
            </>
          ) : (
            <>
              {templateMode ? (
                <>
                  <p className="text-xs text-slate-500">
                    This system is outside the MCS self-consumption range, so
                    there are no MCS figures to start from. Enter the year 1
                    figures, and the table rolls them forward using the changes
                    below. This is a template projection, not an MCS result.
                  </p>
                  {YEAR1_FIELDS.map(({ key, label, step }) => (
                    <FormField
                      key={key}
                      label={label}
                      htmlFor={`sap-year1-${key}`}
                    >
                      <input
                        id={`sap-year1-${key}`}
                        type="number"
                        step={step}
                        className={inputClassName}
                        value={year1Form[key]}
                        onChange={(event) =>
                          setYear1Form((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }))
                        }
                      />
                    </FormField>
                  ))}
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  Year 1 generation and self-consumption come from the MCS
                  estimate, and savings use the customer&apos;s electricity rate
                  (
                  {electricUnitRate > 0
                    ? `£${electricUnitRate.toFixed(4)}/kWh`
                    : "not set in property details"}
                  ). These are the assumptions MCS doesn&apos;t cover.
                </p>
              )}
              {FIELDS.map(({ key, label, step, help }) => (
                <FormField key={key} label={label} htmlFor={`sap-${key}`}>
                  <input
                    id={`sap-${key}`}
                    type="number"
                    step={step}
                    className={inputClassName}
                    value={form[key]}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  />
                  {templateMode && key === "electricityPriceGrowthPct" && (
                    <p className="text-xs text-slate-400">
                      Applied to the solar and battery savings, as the net
                      yearly change.
                    </p>
                  )}
                  {help && <p className="text-xs text-slate-400">{help}</p>}
                </FormField>
              ))}
            </>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <Button
            variant="secondary"
            onClick={() => (isBattery ? onClose() : setView("table"))}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={() =>
              void (isBattery ? handleSaveBattery() : handleSaveAssumptions())
            }
            disabled={isSaving}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Quote SAP table"
      onClose={onClose}
      maxWidthClassName="max-w-6xl"
    >
      <div className="flex flex-col gap-8 px-5 py-5">
        {/* Template quotes start from hand-entered figures, so the MCS estimate and battery capacity don't feed the table. */}
        {!templateMode && (
          <details open={estimate.problems.length > 0} className="group">
            <summary className="cursor-pointer text-base font-semibold text-slate-900">
              MCS performance estimate
            </summary>
            <div className="mt-4">
              <SolarMcsEstimateView estimate={estimate} />
            </div>
          </details>
        )}

        {!templateMode && canEdit && batteryCount > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span>
              Battery usable capacity:{" "}
              <strong className="text-slate-900">
                {batteryUsableKwh > 0 ? `${batteryUsableKwh} kWh` : "not set"}
              </strong>
            </span>
            <Button
              variant="secondary"
              className="px-3 py-1.5 text-xs"
              onClick={() => setView("battery")}
            >
              Edit
            </Button>
          </div>
        )}

        <section
          className={`flex flex-col gap-3 ${templateMode ? "" : "border-t border-slate-200 pt-6"}`}
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              SAP projection
            </h2>
            {!templateMode && (
              <p className="mt-1 text-xs text-slate-500">
                This is not the MCS estimate. It starts from the MCS first-year
                figures and applies the assumptions below, which MCS does not
                specify. Treat it with caution, particularly if it looks
                significantly better than the MCS result.
              </p>
            )}
          </div>

          {!rows ? (
            <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              {estimate.problems.length > 0
                ? "Complete the MCS estimate above to see the projection."
                : canEdit
                  ? "Outside the MCS lookup range. Use Edit assumptions to enter the year 1 figures."
                  : "Outside the MCS lookup range. An admin needs to enter the year 1 figures."}
            </p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600 sm:grid-cols-3">
                {templateMode ? (
                  <Assumption
                    label="Solar & battery savings"
                    value={`${saved?.electricityPriceGrowthPct}%/yr`}
                  />
                ) : (
                  <Assumption
                    label="Electricity rate"
                    value={`£${electricUnitRate.toFixed(4)}/kWh, +${saved?.electricityPriceGrowthPct}%/yr`}
                  />
                )}
                <Assumption
                  label="Export rate"
                  value={`£${saved?.exportRatePerKwh.toFixed(4)}/kWh, ${saved?.exportRateGrowthPct}%/yr`}
                />
                <Assumption
                  label="Output degradation"
                  value={`${saved?.outputDegradationPct}% of year 1 per year`}
                />
                <Assumption
                  label="Costs"
                  value={`${formatCurrency(saved?.annualCosts ?? 0)}/yr for ${saved?.costTermYears} yrs (+${formatCurrency(saved?.year1ExtraCost ?? 0)} in year 1)${saved?.replacementEveryYears ? `, ${formatCurrency(saved.replacementCost)} every ${saved.replacementEveryYears} yrs` : ""}`}
                />
              </dl>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      {HEADERS.map((header) => (
                        <th key={header} className="px-5 py-3">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-slate-900">
                    {rows.map((row) => (
                      <tr
                        key={row.year}
                        className="odd:bg-white even:bg-slate-50/60"
                      >
                        <td className="px-5 py-3">{row.year}</td>
                        <td className="px-5 py-3">
                          {row.outputKwh.toLocaleString()} kWh
                        </td>
                        <td className="px-5 py-3">
                          {formatCurrency(row.solar)}
                        </td>
                        <td className="px-5 py-3">
                          {formatCurrency(row.battery)}
                        </td>
                        <td className="px-5 py-3">
                          {formatCurrency(row.export)}
                        </td>
                        <td className="px-5 py-3">
                          {formatCurrency(row.savings)}
                        </td>
                        <td className="px-5 py-3">
                          {formatCurrency(row.costs)}
                        </td>
                        <td
                          className={`px-5 py-3 ${row.netPosition < 0 ? "text-red-600" : "text-brand-green-mid"}`}
                        >
                          {formatCurrency(row.netPosition)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
        {canEdit && (
          <Button variant="secondary" onClick={() => setView("assumptions")}>
            Edit assumptions
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}

function Assumption({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline text-slate-500">{label}: </dt>
      <dd className="inline font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function toForm(a: SapAssumptions): Record<FieldKey, string> {
  return Object.fromEntries(
    FIELDS.map(({ key }) => [key, String(a[key])]),
  ) as Record<FieldKey, string>;
}

function parseForm(form: Record<FieldKey, string>): SapAssumptions | undefined {
  const values = {} as SapAssumptions;
  for (const { key } of FIELDS) {
    if (form[key].trim() === "") return undefined;
    const value = Number(form[key]);
    if (!Number.isFinite(value)) return undefined;
    values[key] = value;
  }
  return values;
}

function toYear1Form(
  year1: TemplateYear1 | undefined,
): Record<keyof TemplateYear1, string> {
  return Object.fromEntries(
    YEAR1_FIELDS.map(({ key }) => [key, year1 ? String(year1[key]) : ""]),
  ) as Record<keyof TemplateYear1, string>;
}

function parseYear1Form(
  form: Record<keyof TemplateYear1, string>,
): TemplateYear1 | undefined {
  const values = {} as TemplateYear1;
  for (const { key } of YEAR1_FIELDS) {
    if (form[key].trim() === "") return undefined;
    const value = Number(form[key]);
    if (!Number.isFinite(value) || value < 0) return undefined;
    values[key] = value;
  }
  return values.outputKwh > 0 ? values : undefined;
}
