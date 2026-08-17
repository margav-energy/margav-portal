import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { BoilerPropertyDetails } from "@/types/boiler-quote";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

export function BoilerPropertyCard({ property }: { property: BoilerPropertyDetails }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Property details</h3>
        <Button variant="secondary" className="px-3 py-1.5 text-xs">
          Edit
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Field label="Property Type" value={property.propertyType} />
        <Field label="Bedrooms" value={property.bedrooms} />
        <Field label="Radiators" value={property.radiators} />
        <Field label="Current Boiler Type" value={property.currentBoilerType} />
        <Field label="Current Boiler Age" value={property.currentBoilerAge} />
        <Field label="Boiler Location" value={property.boilerLocation} />
        <Field label="Gas Supply Confirmed" value={property.gasSupplyConfirmed} />
        <Field label="MPRN" value={property.mprn} />
        <Field label="Access Notes" value={property.accessNotes} />
      </div>
    </Card>
  );
}
