import type { McsEstimate } from "@/lib/mcs/performance-estimate";
import type { SelfConsumptionResult } from "@/lib/mcs/self-consumption";

/**
 * The MCS annual energy performance estimate, laid out as the table MIS 3002
 * Issue 6.0 §4.1.6 prescribes (sections A–D), with the wording §4.1.3–4.1.4
 * require alongside it. With more than one array, sections A and B list each
 * array and the total.
 */

const kwh = (value: number) => `${Math.round(value).toLocaleString()} kWh`;

function Table({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {title}
      </h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  note,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
}) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <th
        scope="row"
        className="w-1/2 px-4 py-2.5 text-left text-sm font-normal text-slate-600"
      >
        {label}
        {note && <span className="block text-xs text-slate-400">{note}</span>}
      </th>
      <td className="px-4 py-2.5 text-sm font-medium text-slate-900">
        {value}
      </td>
    </tr>
  );
}

function SelfConsumptionRows({
  result,
  consumption,
  alsoCoversBattery = false,
}: {
  result: SelfConsumptionResult | undefined;
  consumption: number;
  /** The same out-of-range result applies to the with-storage figures, which are then left out. */
  alsoCoversBattery?: boolean;
}) {
  if (!result) return null;
  if (!result.ok) {
    return (
      <tr>
        <td colSpan={2} className="px-4 py-3 text-sm text-amber-800">
          {result.reason}
          {alsoCoversBattery &&
            " This applies to the figures with storage too."}{" "}
          MCS requires a method &ldquo;no less valid&rdquo; than its lookup
          tables for systems outside this range.
        </td>
      </tr>
    );
  }
  return (
    <>
      <Row
        label="Expected solar PV self-consumption"
        value={`${kwh(result.selfConsumptionKwh)} (${result.sharePercent.toFixed(0)}% of generation)`}
      />
      <Row
        label="Grid electricity independence / self-sufficiency"
        value={`${result.gridIndependencePercent.toFixed(0)}%`}
        note={`${kwh(result.selfConsumptionKwh)} of ${kwh(consumption)} consumed, capped at 90%`}
      />
    </>
  );
}

export function SolarMcsEstimateView({ estimate }: { estimate: McsEstimate }) {
  const { problems, warnings } = estimate;
  const complete = problems.length === 0;
  // Sections C and D would repeat the same out-of-range message, so D is left out and C says it covers both.
  const sameOutOfRangeResult = Boolean(
    estimate.withBattery &&
    estimate.pvOnly &&
    !estimate.pvOnly.ok &&
    !estimate.withBattery.ok &&
    estimate.pvOnly.reason === estimate.withBattery.reason,
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs text-slate-500">
          MIS 3002 §4.1: kWp × Kk × SF for generation, MGD 003 tables for
          self-consumption. First year only.
        </p>
      </div>

      {problems.length > 0 && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">
            The MCS estimate can&apos;t be produced yet.
          </p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}

      {estimate.arrays.length > 0 && (
        <>
          <Table title="A. Solar PV installation data  ·  B. Performance calculations">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  {[
                    "Array",
                    "kWp (STC)",
                    "Orientation (° from S)",
                    "Inclination (°)",
                    "Postcode region",
                    "kWh/kWp (Kk)",
                    "Shade factor (SF)",
                    "Annual output",
                  ].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estimate.arrays.map((array) => (
                  <tr key={array.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5">{array.label}</td>
                    <td className="px-4 py-2.5">{array.kwp.toFixed(2)}</td>
                    <td className="px-4 py-2.5">{array.orientationDeg}</td>
                    <td className="px-4 py-2.5">{array.pitchDeg}</td>
                    <td className="px-4 py-2.5">{array.zone}</td>
                    <td className="px-4 py-2.5">{array.kk}</td>
                    <td className="px-4 py-2.5">
                      {array.shadeFactor.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5">{kwh(array.outputKwh)}</td>
                  </tr>
                ))}
                {estimate.arrays.length > 1 && (
                  <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5">
                      {estimate.totalKwp.toFixed(2)}
                    </td>
                    <td colSpan={5} />
                    <td className="px-4 py-2.5">
                      {kwh(estimate.totalOutputKwh)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Table>
        </>
      )}

      {complete && (
        <>
          <Table title="C. Estimated PV self-consumption — PV only">
            <table className="w-full text-left">
              <tbody>
                <Row
                  label="Assumed occupancy archetype"
                  value={estimate.occupancy.label}
                  note={
                    estimate.occupancy.known
                      ? undefined
                      : "Not recorded — MCS default"
                  }
                />
                <Row
                  label="Assumed annual electricity consumption"
                  value={kwh(estimate.annualConsumptionKwh)}
                  note={
                    estimate.consumptionAssumed
                      ? "Not recorded — MCS default"
                      : undefined
                  }
                />
                <Row
                  label="Assumed annual electricity generation from solar PV"
                  value={kwh(estimate.totalOutputKwh)}
                />
                <SelfConsumptionRows
                  result={estimate.pvOnly}
                  consumption={estimate.annualConsumptionKwh}
                  alsoCoversBattery={sameOutOfRangeResult}
                />
              </tbody>
            </table>
          </Table>

          {estimate.withBattery && !sameOutOfRangeResult && (
            <Table title="D. Estimated PV self-consumption — with electrical energy storage">
              <table className="w-full text-left">
                <tbody>
                  <Row
                    label="Assumed usable capacity of storage used for self-consumption"
                    value={`${estimate.batteryUsableKwh} kWh`}
                  />
                  <SelfConsumptionRows
                    result={estimate.withBattery}
                    consumption={estimate.annualConsumptionKwh}
                  />
                </tbody>
              </table>
            </Table>
          )}
        </>
      )}

      {warnings.length > 0 && (
        <ul className="list-disc rounded-lg bg-slate-50 px-8 py-3 text-xs text-slate-600">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <details className="group rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">
          Wording and documents required when giving this estimate to the
          customer (MIS 3002 §4.1.3, §4.1.4, §4.2.1)
        </summary>
        <div className="mt-3 flex flex-col gap-2">
          <p>
            <em>Important Note:</em> The performance of solar PV systems is
            impossible to predict with certainty due to the variability in the
            amount of solar radiation (sunlight) from location to location and
            from year to year. This estimate is based upon the standard MCS
            procedure is given as guidance only for the first year of
            generation. It should not be considered as a guarantee of
            performance.
          </p>
          <p>
            The solar PV self-consumption has been calculated in accordance with
            the most relevant methodology for your system. There are a number of
            external factors that can have a significant effect on the amount of
            energy that is self-consumed so this figure should not be considered
            as a guarantee of the amount of energy that will be self-consumed.
          </p>
          {estimate.shadingPresent && (
            <>
              <p>
                <em>
                  Shading — if the shade factor was calculated using the MCS
                  shading methodology (MGD 005):
                </em>{" "}
                Shading will be present on your system that will reduce its
                output to the factor stated. This factor was calculated using
                the MCS shading methodology and we believe that this will yield
                results within 10% of the actual energy estimate stated for most
                systems.
              </p>
              <p>
                <em>Shading — if another methodology was used:</em> Shading will
                be present on your system that will reduce its output to the
                factor stated. This factor was NOT calculated using the MCS
                shading methodology, but we can confirm that the system as
                quoted, taking into account the shading present, will deliver at
                least 90% of the energy (in kWh) as set out in this performance
                estimate.
              </p>
            </>
          )}
          <p className="font-semibold text-slate-700">
            Give the customer in writing before the contract (§4.2.1)
          </p>
          <ul className="list-disc pl-5">
            <li>This performance estimate</li>
            <li>
              Datasheets for the modules, the inverter
              {estimate.withBattery ? ", the battery" : ""} and any module-level
              power electronics
            </li>
            <li>A drawing of the proposed module layout</li>
            {estimate.shadingPresent && (
              <li>
                The sunpath diagram used to calculate the shade factor (if the
                MCS shading method was used)
              </li>
            )}
          </ul>
        </div>
      </details>
    </div>
  );
}
