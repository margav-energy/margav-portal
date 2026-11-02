"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Collapsible } from "@/components/quotes/detail/Collapsible";
import { KeyDetailField } from "@/components/quotes/detail/KeyDetailField";
import { formatCurrency } from "@/lib/format";
import { SolarSapTableModal } from "@/components/quotes/solar/SolarSapTableModal";
import type { McsEstimate } from "@/lib/mcs/performance-estimate";
import type { SolarKeyDetails } from "@/types/solar-quote";

export function SolarKeyDetailsCard({
  quoteId,
  customerName,
  keyDetails,
  mcsEstimate,
  electricUnitRate,
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
  isAdmin: boolean;
  /** Mirrors the quote's Lock/Unlock toggle — assumptions can't be edited while locked. */
  locked?: boolean;
}) {
  const [sapOpen, setSapOpen] = useState(false);
  const hasSap = Boolean(keyDetails.sapAssumptions);

  return (
    <Collapsible title="Key details">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <KeyDetailField label="Panels" value={keyDetails.panels} />
        <KeyDetailField label="Batteries" value={keyDetails.batteries} />
        <KeyDetailField label="System size" value={`${keyDetails.systemSizeKw.toFixed(2)}kW`} />
        <KeyDetailField label="Gen · Y1" value={`${Math.round(keyDetails.genY1Kwh).toLocaleString()}kWh`} />
        <KeyDetailField label="Saving · Y1" value={formatCurrency(keyDetails.savingY1)} />
        <KeyDetailField label="Saving" value={formatCurrency(keyDetails.lifetimeSaving)} />
        <KeyDetailField label="Profit" value={formatCurrency(keyDetails.profit)} />
        <KeyDetailField label="ROI" value={`${keyDetails.roiPercent}%`} />
        <KeyDetailField label="Grid Ind." value={`${keyDetails.gridIndependencePercent}%`} />
        <KeyDetailField label="Payback per." value={`${keyDetails.paybackYears} years`} />
      </div>
      <Button variant="secondary" className="mt-4 w-full justify-center text-xs" onClick={() => setSapOpen(true)}>
        {hasSap ? "View MCS estimate & SAP table" : "View MCS estimate"}
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
