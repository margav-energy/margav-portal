import { Collapsible } from "@/components/quotes/detail/Collapsible";
import { KeyDetailField } from "@/components/quotes/detail/KeyDetailField";
import { formatCurrency } from "@/lib/format";
import type { BoilerKeyDetails, BoilerUnit } from "@/types/boiler-quote";
import type { ProfitBreakdown } from "@/types/quote-detail-shared";

export function BoilerKeyDetailsCard({
  unit,
  keyDetails,
  profit,
}: {
  unit: BoilerUnit;
  keyDetails: BoilerKeyDetails;
  /** Price/profit/margin come from here (same numbers as the Profit card below) rather than `keyDetails` — there's no data entry point that ever populates a separate copy of these on `keyDetails`, so that copy always reads as zero. */
  profit: ProfitBreakdown;
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
        <KeyDetailField label="Price" value={formatCurrency(profit.sellPrice)} />
        <KeyDetailField label="Profit" value={formatCurrency(profit.profit)} valueClassName="text-brand-green-mid" />
        <KeyDetailField label="Margin" value={`${profit.marginPercent}%`} valueClassName="text-brand-green-mid" />
      </div>
    </Collapsible>
  );
}
