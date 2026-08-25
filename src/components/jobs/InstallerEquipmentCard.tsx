import { Card } from "@/components/ui/Card";
import type { InstallerBoilerUnit, InstallerJobDetail, InstallerSolarArray } from "@/data/installer-jobs-service";

/** Mirrors the admin/rep "spec line" on the editable quote form (see
 *  specLine() in src/components/quotes/boiler/BoilerUnitsSection.tsx) minus
 *  price — installers see what's going in, never what it costs. */
function boilerSpecLine(unit: InstallerBoilerUnit): string {
  const parts = [`${unit.outputKw}kW`, unit.installType, unit.fuelType, `${unit.flueType} Flue`];
  if (unit.cylinderLitres) parts.push(`${unit.cylinderLitres}L Cylinder`);
  parts.push(`${unit.warrantyYears}yr Warranty`);
  return parts.join(" · ");
}

function solarSpecLine(array: InstallerSolarArray): string {
  return `${array.orientation} · ${array.pitchDegrees}° Pitch`;
}

/** "What's being installed" — the equipment side of a job, on the main
 *  column of /jobs/[id] (the survey card sits in the sidebar instead). */
export function InstallerEquipmentCard({ job }: { job: InstallerJobDetail }) {
  const hasEquipment = (job.boilerUnits?.length ?? 0) > 0 || (job.solarArrays?.length ?? 0) > 0;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h3 className="text-sm font-semibold text-slate-900">What&rsquo;s being installed</h3>

      {!hasEquipment && <p className="text-sm text-slate-500">No equipment details recorded for this job.</p>}

      {job.boilerUnits?.map((unit) => (
        <div key={unit.id} className="flex flex-col gap-1.5 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
          <p className="text-sm font-medium text-slate-900">{unit.label || `${unit.make} ${unit.model}`}</p>
          <p className="text-xs text-slate-500">
            {unit.make} {unit.model}
          </p>
          <p className="text-xs text-slate-500">{boilerSpecLine(unit)}</p>
          {unit.items.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5 text-xs text-slate-500">
              {unit.items.map((item, index) => (
                <li key={index}>
                  {item.quantity}× {item.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {job.solarArrays?.map((array) => (
        <div key={array.id} className="flex flex-col gap-1.5 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
          <p className="text-sm font-medium text-slate-900">{array.label || "Solar array"}</p>
          <p className="text-xs text-slate-500">{solarSpecLine(array)}</p>
          {array.items.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5 text-xs text-slate-500">
              {array.items.map((item, index) => (
                <li key={index}>
                  {item.quantity}× {item.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </Card>
  );
}
