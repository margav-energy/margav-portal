import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { SolarPropertyDetails } from "@/types/solar-quote";

// Electric unit rates carry more precision than `formatCurrency` shows
// (which rounds to 2dp) — e.g. "£0.2467" rather than "£0.25".
function formatUnitRate(rate: number): string {
  return `£${rate.toFixed(4)}`;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

export function SolarPropertyCard({ property }: { property: SolarPropertyDetails }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Property details</h3>
        <Button variant="secondary" className="px-3 py-1.5 text-xs">
          Edit
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="Occupancy Archetype" value={property.occupancyArchetype} />
        <Field label="Annual Electric Consumption" value={`${property.annualConsumptionKwh.toLocaleString()} kWh`} />
        <Field label="Electric Unit Rate" value={formatUnitRate(property.electricUnitRate)} />
        <Field label="Estimated Bill" value={property.estimatedBill} />
        <Field label="Estimated Reason" value={property.estimatedReason} />
        <Field label="Spray Foam" value={property.sprayFoam} />
        <Field label="MPAN" value={property.mpan} />
      </div>
    </Card>
  );
}
