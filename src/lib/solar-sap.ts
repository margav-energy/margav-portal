import { lookupSelfConsumption } from "@/lib/mcs/self-consumption";
import type { McsEstimate } from "@/lib/mcs/performance-estimate";
import type {
  SapAssumptions,
  SapRow,
  TemplateYear1,
} from "@/types/solar-quote";

export const SAP_TABLE_YEARS = 30;

/** Starting values for the admin form. MCS gives no figures for these, so nothing is assumed beyond a typical module degradation — the admin chooses the rest. */
export const DEFAULT_SAP_ASSUMPTIONS: SapAssumptions = {
  exportRatePerKwh: 0,
  electricityPriceGrowthPct: 0,
  exportRateGrowthPct: 0,
  outputDegradationPct: 0.5,
  annualCosts: 0,
  year1ExtraCost: 0,
  costTermYears: 0,
  replacementCost: 0,
  replacementEveryYears: 0,
};

/** True when the estimate is complete but MCS's self-consumption lookup doesn't cover it (consumption or generation too high) — the only case the hand-entered template projection is used. */
export function isOutOfMcsRange(estimate: McsEstimate): boolean {
  const { pvOnly, withBattery } = estimate;
  return (
    estimate.problems.length === 0 &&
    !(pvOnly?.ok && (!withBattery || withBattery.ok))
  );
}

/** Running costs for a year: the finance repayment while it lasts, the year 1 extra, and any recurring replacement. */
function costsForYear(year: number, a: SapAssumptions): number {
  const replacement =
    a.replacementEveryYears > 0 && year % a.replacementEveryYears === 0
      ? a.replacementCost
      : 0;
  return round2(
    (year <= a.costTermYears ? a.annualCosts : 0) +
      (year === 1 ? a.year1ExtraCost : 0) +
      replacement,
  );
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * The "Quote SAP table": a 30-year savings / payback projection.
 *
 * This is an ADDITIONAL estimate, not the MCS estimate (MIS 3002
 * §4.1.8): it starts from the MCS year-1 generation and self-consumption and
 * then applies the admin's assumptions, which MCS does not specify.
 *
 * Each year n (n = 1 is the MCS estimate itself):
 * - Output falls in a straight line, `outputDegradationPct` of year 1 a year.
 * - Self-consumption is looked up again for that year's output, which MGD 003
 *   §3.15 permits ("post-degradation solar PV generation").
 * - Solar saving   = PV-only self-consumed kWh × electricity rate
 * - Battery saving = extra kWh a battery self-consumes × electricity rate
 * - Export income  = generation not self-consumed × export rate
 * - Electricity and export rates grow by their assumed % a year.
 * - Costs = `annualCosts` for `costTermYears` years (year 1 also carries
 *   `year1ExtraCost`), then nothing; net position is cumulative.
 *
 * Returns `undefined` when there is no complete, in-range MCS estimate to
 * start from. Money is rounded to pence per row so columns add up as shown.
 */
export function computeSapTable(
  estimate: McsEstimate,
  electricUnitRate: number,
  assumptions: SapAssumptions,
): SapRow[] | undefined {
  const { pvOnly, withBattery } = estimate;
  if (!pvOnly?.ok || (withBattery && !withBattery.ok)) {
    return assumptions.templateYear1 && isOutOfMcsRange(estimate)
      ? computeTemplateTable(assumptions.templateYear1, assumptions)
      : undefined;
  }

  const hasBattery = Boolean(withBattery);
  const archetype = estimate.occupancy.archetype;
  const consumption = estimate.annualConsumptionKwh;
  const rows: SapRow[] = [];
  let net = 0;

  for (let year = 1; year <= SAP_TABLE_YEARS; year++) {
    const elapsed = year - 1;
    const generation = Math.max(
      0,
      estimate.totalOutputKwh *
        (1 - (assumptions.outputDegradationPct / 100) * elapsed),
    );

    const base = {
      archetype,
      annualConsumptionKwh: consumption,
      annualGenerationKwh: generation,
    };
    const pv = year === 1 ? pvOnly : lookupSelfConsumption(base);
    const bat = !hasBattery
      ? undefined
      : year === 1
        ? withBattery
        : lookupSelfConsumption({
            ...base,
            batteryUsableKwh: estimate.batteryUsableKwh,
          });

    // If a later year falls outside the lookup range, hold the self-consumption share steady rather than stopping the table.
    const pvKwh = pv?.ok
      ? pv.selfConsumptionKwh
      : generation * (pvOnly.sharePercent / 100);
    const totalKwh = bat?.ok
      ? bat.selfConsumptionKwh
      : hasBattery && withBattery?.ok
        ? generation * (withBattery.sharePercent / 100)
        : pvKwh;

    const rate =
      electricUnitRate *
      (1 + assumptions.electricityPriceGrowthPct / 100) ** elapsed;
    const exportRate =
      assumptions.exportRatePerKwh *
      (1 + assumptions.exportRateGrowthPct / 100) ** elapsed;

    const solar = round2(pvKwh * rate);
    const battery = round2(Math.max(0, totalKwh - pvKwh) * rate);
    const exportIncome = round2(
      Math.max(0, generation - totalKwh) * exportRate,
    );
    const savings = round2(solar + battery + exportIncome);
    const costs = costsForYear(year, assumptions);
    net = round2(net + savings - costs);

    rows.push({
      year,
      outputKwh: Math.round(generation),
      solar,
      battery,
      export: exportIncome,
      savings,
      costs,
      netPosition: net,
    });
  }
  return rows;
}

/**
 * Projection for systems outside the MCS self-consumption range, where there's no MCS first year to start from.
 * Year 1 is entered by hand; each later year (n), modelled on the Spark template:
 * - Output falls by `outputDegradationPct` a year, compounding.
 * - The electricity self-consumed stays at its year 1 level (year 1 output less what's exported), so the
 *   solar and battery savings only change with the electricity price: `electricityPriceGrowthPct` a year, compounding.
 * - Export income = the export rate × (output − that self-consumed electricity), so it falls as output does.
 *   The export rate is `exportRatePerKwh`, changing by `exportRateGrowthPct` a year. (With no export rate it
 *   just changes by `exportRateGrowthPct` from the entered year 1 income.)
 * Costs and the cumulative net position work as in `computeSapTable`.
 */
function computeTemplateTable(
  year1: TemplateYear1,
  assumptions: SapAssumptions,
): SapRow[] {
  const rows: SapRow[] = [];
  const hasExportRate = assumptions.exportRatePerKwh > 0;
  const selfConsumedKwh = hasExportRate
    ? Math.max(
        0,
        year1.outputKwh - year1.exportIncome / assumptions.exportRatePerKwh,
      )
    : 0;
  let net = 0;

  for (let year = 1; year <= SAP_TABLE_YEARS; year++) {
    const elapsed = year - 1;
    const output =
      year1.outputKwh * (1 - assumptions.outputDegradationPct / 100) ** elapsed;
    const savingFactor =
      (1 + assumptions.electricityPriceGrowthPct / 100) ** elapsed;
    const exportFactor = (1 + assumptions.exportRateGrowthPct / 100) ** elapsed;

    const solar = round2(year1.solar * savingFactor);
    const battery = round2(year1.battery * savingFactor);
    const exportIncome = hasExportRate
      ? round2(
          assumptions.exportRatePerKwh *
            exportFactor *
            Math.max(0, output - selfConsumedKwh),
        )
      : round2(year1.exportIncome * exportFactor);
    const savings = round2(solar + battery + exportIncome);
    const costs = costsForYear(year, assumptions);
    net = round2(net + savings - costs);

    rows.push({
      year,
      outputKwh: Math.round(output),
      solar,
      battery,
      export: exportIncome,
      savings,
      costs,
      netPosition: net,
    });
  }
  return rows;
}

/**
 * Years until the running net position first reaches `target` — part-years interpolated — or undefined if it never does within the table.
 * With finance, the repayments are already in the table's costs, so the target is zero; with no running costs (a cash purchase) it is the price.
 */
export function paybackYears(rows: SapRow[], target: number): number | undefined {
  if (!(target >= 0)) return undefined;
  let previous = 0;
  for (const row of rows) {
    if (row.netPosition >= target) {
      const yearGain = row.netPosition - previous;
      return row.year - 1 + (yearGain > 0 ? (target - previous) / yearGain : 1);
    }
    previous = row.netPosition;
  }
  return undefined;
}
