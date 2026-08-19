import { Button } from "@/components/ui/Button";
import { Collapsible } from "@/components/quotes/detail/Collapsible";
import { KeyDetailField } from "@/components/quotes/detail/KeyDetailField";
import { formatCurrency } from "@/lib/format";
import type { SolarKeyDetails } from "@/types/solar-quote";

export function SolarKeyDetailsCard({ keyDetails }: { keyDetails: SolarKeyDetails }) {
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
      {keyDetails.sapTableUrl ? (
        <Button
          variant="secondary"
          className="mt-4 w-full justify-center text-xs"
          href={keyDetails.sapTableUrl}
          target="_blank"
        >
          View SAP table
        </Button>
      ) : (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-400">
          No SAP table uploaded yet.
        </p>
      )}
    </Collapsible>
  );
}
