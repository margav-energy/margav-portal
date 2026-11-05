"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Collapsible } from "@/components/quotes/detail/Collapsible";
import { KeyDetailField } from "@/components/quotes/detail/KeyDetailField";
import { formatCurrency } from "@/lib/format";
import { computeSapTable, isOutOfMcsRange, SAP_TABLE_YEARS } from "@/lib/solar-sap";
import { SolarSapTableModal } from "@/components/quotes/solar/SolarSapTableModal";
import type { McsEstimate } from "@/lib/mcs/performance-estimate";
import type { SapRow, SolarKeyDetails } from "@/types/solar-quote";

/**
 * Years until the running net position first reaches `target` — part-years interpolated — or undefined if it never does within the table.
 * With finance, the repayments are already in the table's costs, so the target is zero; with no running costs (a cash purchase) it is the price.
 */
function paybackYears(rows: SapRow[], target: number): number | undefined {
  if (!(target >= 0)) return undefined;
  let previous = 0;
  for (const row of rows) {
    if (row.netPosition >= target) {
      const yearGain = row.netPosition - previous;
      return row.year - 1 + (yearGain > 0 ? (target - previous) / yearGain : 1);
    }
    previous = row.netPosition;
  }
  return undefined;
}

export function SolarKeyDetailsCard({
  quoteId,
  customerName,
  keyDetails,
  mcsEstimate,
  electricUnitRate,
  totalCost,
  panelCount,
  isAdmin,
  locked = false,
}: {
  quoteId: string;
  customerName: string;
  keyDetails: SolarKeyDetails;
  /** Built on the server — see `computeMcsEstimate`. */
  mcsEstimate: McsEstimate;
  /** £ per kWh from the property details, used for the 25-year projection's savings. */
  electricUnitRate: number;
  /** What the customer pays (after discount) — the payback target. */
  totalCost: number;
  /** Panels across all arrays. */
  panelCount: number;
  isAdmin: boolean;
  /** Mirrors the quote's Lock/Unlock toggle — assumptions can't be edited while locked. */
  locked?: boolean;
}) {
  const [sapOpen, setSapOpen] = useState(false);
  const hasSap = Boolean(keyDetails.sapAssumptions);

  // Derived from the MCS estimate and SAP table rather than the stored values, which nothing ever fills in.
  const selfConsumption = mcsEstimate.withBattery ?? mcsEstimate.pvOnly;
  // Out of MCS range there is no self-consumption lookup; use the hand-entered year 1 savings, which are self-consumed kWh × the unit rate.
  const templateYear1 = keyDetails.sapAssumptions?.templateYear1;
  const templateGridIndependence =
    isOutOfMcsRange(mcsEstimate) && templateYear1 && electricUnitRate > 0 && mcsEstimate.annualConsumptionKwh > 0
      ? Math.min(100, ((templateYear1.solar + templateYear1.battery) / electricUnitRate / mcsEstimate.annualConsumptionKwh) * 100)
      : undefined;
  const gridIndependence = selfConsumption?.ok
    ? `${Math.round(selfConsumption.gridIndependencePercent)}%`
    : templateGridIndependence !== undefined
      ? `${Math.round(templateGridIndependence)}%`
      : keyDetails.gridIndependencePercent > 0
        ? `${keyDetails.gridIndependencePercent}%`
        : "—";
  const sapRows = keyDetails.sapAssumptions ? computeSapTable(mcsEstimate, electricUnitRate, keyDetails.sapAssumptions) : undefined;
  const financed = (keyDetails.sapAssumptions?.annualCosts ?? 0) > 0;
  const payback = sapRows ? paybackYears(sapRows, financed ? 0 : totalCost) : undefined;
  const first = sapRows?.[0];
  const last = sapRows?.[sapRows.length - 1];
  // Customer's profit over the table: with finance the repayments are already in the costs; otherwise take the price off.
  const profit = last ? last.netPosition - (financed ? 0 : totalCost) : undefined;
  const lifetimeSaving = sapRows?.reduce((sum, row) => sum + row.savings, 0);
  const roiPercent = profit !== undefined && totalCost > 0 ? Math.round((profit / totalCost) * 100) : undefined;
  const genY1 = mcsEstimate.totalOutputKwh;
  const systemSizeKw = mcsEstimate.totalKwp;
  const dash = (value: number | undefined, format: (n: number) => string) => (value === undefined ? "—" : format(value));
  const paybackText = sapRows
    ? payback !== undefined
      ? `${Math.ceil(payback)} years`
      : `${SAP_TABLE_YEARS}+ years`
    : keyDetails.paybackYears > 0
      ? `${keyDetails.paybackYears} years`
      : "—";

  return (
    <Collapsible title="Key details">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <KeyDetailField label="Panels" value={panelCount} />
        <KeyDetailField label="Batteries" value={keyDetails.batteries} />
        <KeyDetailField label="System size" value={`${systemSizeKw.toFixed(2)}kW`} />
        <KeyDetailField label="Gen · Y1" value={`${Math.round(genY1).toLocaleString()}kWh`} />
        <KeyDetailField label="Saving · Y1" value={dash(first?.savings ?? (keyDetails.savingY1 || undefined), formatCurrency)} />
        <KeyDetailField label="Saving" value={dash(lifetimeSaving ?? (keyDetails.lifetimeSaving || undefined), formatCurrency)} />
        <KeyDetailField label="Profit" value={dash(profit ?? (keyDetails.profit || undefined), formatCurrency)} />
        <KeyDetailField label="ROI" value={dash(roiPercent ?? (keyDetails.roiPercent || undefined), (n) => `${n}%`)} />
        <KeyDetailField label="Grid Ind." value={gridIndependence} />
        <KeyDetailField label="Payback per." value={paybackText} />
      </div>
      <Button variant="secondary" className="mt-4 w-full justify-center text-xs" onClick={() => setSapOpen(true)}>
        {hasSap ? "View SAP table" : "View MCS estimate"}
      </Button>
      {/* Quotes from before the computed table may still carry an uploaded file — keep it reachable until assumptions are added. */}
      {!hasSap && keyDetails.sapTableUrl && (
        <Button
          variant="secondary"
          className="mt-2 w-full justify-center text-xs"
          href={keyDetails.sapTableUrl}
          target="_blank"
        >
          View uploaded SAP table
        </Button>
      )}
      {sapOpen && (
        <SolarSapTableModal
          quoteId={quoteId}
          customerName={customerName}
          estimate={mcsEstimate}
          electricUnitRate={electricUnitRate}
          batteryCount={keyDetails.batteries}
          batteryUsableKwh={keyDetails.batteryUsableKwh ?? 0}
          assumptions={keyDetails.sapAssumptions}
          canEdit={isAdmin && !locked}
          onClose={() => setSapOpen(false)}
        />
      )}
    </Collapsible>
  );
}
