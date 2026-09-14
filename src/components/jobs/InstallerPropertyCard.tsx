import { Card } from "@/components/ui/Card";
import type { BoilerPropertyDetails } from "@/types/boiler-quote";
import type { SolarPropertyDetails } from "@/types/solar-quote";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function isBoilerProperty(
  property: BoilerPropertyDetails | SolarPropertyDetails,
): property is BoilerPropertyDetails {
  return "boilerLocation" in property;
}

/**
 * Read-only counterpart of `BoilerPropertyCard`/`SolarPropertyCard` — same
 * fields, no Edit button. Nothing here is a Margav price (property type,
 * access notes, the customer's own electricity tariff, ...), so it's shown
 * in full — same as the admin/rep detail page.
 */
export function InstallerPropertyCard({
  property,
}: {
  property: BoilerPropertyDetails | SolarPropertyDetails;
}) {
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Property details</h3>
      {isBoilerProperty(property) ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Field label="Property Type" value={property.propertyType} />
          <Field label="Bedrooms" value={property.bedrooms} />
          <Field label="Bathrooms" value={property.bathrooms} />
          <Field label="Current Boiler Type" value={property.currentBoilerType} />
          <Field label="Current Boiler Age" value={property.currentBoilerAge} />
          <Field label="Boiler Location" value={property.boilerLocation} />
          <Field label="Gas Supply Confirmed" value={property.gasSupplyConfirmed} />
          <Field label="MPRN" value={property.mprn} />
          <Field label="Access Notes" value={property.accessNotes} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Field label="Occupancy Archetype" value={property.occupancyArchetype} />
          <Field label="Annual Electric Consumption" value={`${property.annualConsumptionKwh.toLocaleString()} kWh`} />
          <Field label="Estimated Bill" value={property.estimatedBill} />
          <Field label="Estimated Reason" value={property.estimatedReason} />
          <Field label="Spray Foam" value={property.sprayFoam} />
          <Field label="MPAN" value={property.mpan} />
        </div>
      )}
    </Card>
  );
}
