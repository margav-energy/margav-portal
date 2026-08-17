import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/format";
import type { BoilerUnit } from "@/types/boiler-quote";

function specLine(unit: BoilerUnit): string {
  const parts = [`${unit.outputKw}kW`, unit.installType, unit.fuelType, `${unit.flueType} Flue`];
  if (unit.cylinderLitres) parts.push(`${unit.cylinderLitres}L Cylinder`);
  parts.push(`${unit.warrantyYears}yr Warranty`);
  return parts.join(" · ");
}

export function BoilerUnitsSection({ units }: { units: BoilerUnit[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Boilers ({units.length})
      </p>

      {units.map((unit) => (
        <Card key={unit.id} className="overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {unit.label} &middot; {unit.make} {unit.model}
              </p>
              <p className="text-sm text-slate-500">{specLine(unit)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="primary" className="px-3 py-1.5 text-xs">
                Edit
              </Button>
              <Button variant="danger" className="px-3 py-1.5 text-xs">
                Remove
              </Button>
            </div>
          </div>
          {unit.items.map((item) => (
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

      <Button variant="secondary" className="w-fit self-center">
        Add boiler
      </Button>
    </div>
  );
}
