import { Button } from "@/components/ui/Button";
import { Collapsible } from "@/components/quotes/detail/Collapsible";
import { KeyDetailField } from "@/components/quotes/detail/KeyDetailField";
import { formatCurrency } from "@/lib/format";
import type { BoilerKeyDetails, BoilerUnit } from "@/types/boiler-quote";

export function BoilerKeyDetailsCard({
  unit,
  keyDetails,
}: {
  unit: BoilerUnit;
  keyDetails: BoilerKeyDetails;
}) {
  return (
    <Collapsible title="Key details">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <KeyDetailField label="Output" value={`${unit.outputKw}kW`} />
        <KeyDetailField label="Install Type" value={unit.installType} />
        <KeyDetailField label="Cylinder" value={unit.cylinderLitres ? `${unit.cylinderLitres}L` : "N/A"} />
        <KeyDetailField label="Warranty" value={`${unit.warrantyYears} years`} />
        <KeyDetailField
          label="Est. Install"
          value={`${keyDetails.estInstallDays} day${keyDetails.estInstallDays === 1 ? "" : "s"}`}
        />
        <KeyDetailField label="Price" value={formatCurrency(keyDetails.price)} />
        <KeyDetailField label="Profit" value={formatCurrency(keyDetails.profit)} />
        <KeyDetailField label="Margin" value={`${keyDetails.marginPercent}%`} />
      </div>
      {keyDetails.specSheetUrl ? (
        <Button
          variant="secondary"
          className="mt-4 w-full justify-center text-xs"
          href={keyDetails.specSheetUrl}
          target="_blank"
        >
          View spec sheet
        </Button>
      ) : (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-400">
          No spec sheet uploaded yet.
        </p>
      )}
    </Collapsible>
  );
}
