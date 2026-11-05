import type { SolarEquipmentKind } from "@/types/solar-quote";

/**
 * Reference data for the solar array form's Product dropdown (see
 * `SolarArraySection.tsx`). A plain, easily editable list — add a panel by
 * adding an entry, no other code changes needed. `wp` is the module's label
 * rating in watts at STC, which the MCS performance estimate needs
 * (kWp = wp × quantity / 1000).
 */
export interface SolarPanelOption {
  name: string;
  wp: number;
  unitPrice: number;
}

export const SOLAR_PANELS: SolarPanelOption[] = [{ name: "AIKO Neostar 3S 485w", wp: 485, unitPrice: 170 }];

export function findSolarPanel(name: string): SolarPanelOption | undefined {
  return SOLAR_PANELS.find((panel) => panel.name === name);
}

export interface EquipmentPreset {
  /** The main product line. */
  name: string;
  unitPrice: number;
  /** Accessory lines that come with it; editable once added. */
  accessories: { name: string; quantity: number; unitPrice: number }[];
}

export interface EquipmentKindConfig {
  kind: SolarEquipmentKind;
  /** Section heading, e.g. "Inverter". */
  title: string;
  /** Entry label prefix, e.g. "Inverter #1". */
  singular: string;
  addLabel: string;
  presets: EquipmentPreset[];
}

/** The lines that come with every battery. */
const BATTERY_ACCESSORIES = () => [
  { name: "Installation", quantity: 1, unitPrice: 0 },
  { name: "Hazard Labels (Battery)", quantity: 1, unitPrice: 0 },
];

/** Order here is the order the sections appear on the quote. Add a product by adding a preset — nothing else changes. */
export const SOLAR_EQUIPMENT_KINDS: EquipmentKindConfig[] = [
  {
    kind: "optimiser",
    title: "Solar optimisers",
    singular: "Solar Optimiser",
    addLabel: "Add solar optimiser",
    // No price set yet — enter the unit price when adding one.
    presets: [{ name: "Tigo Optimiser", unitPrice: 0, accessories: [] }],
  },
  {
    kind: "inverter",
    title: "Inverter",
    singular: "Inverter",
    addLabel: "Add inverter",
    presets: [
      {
        name: "EcoFlow PowerOcean Inverter 6kw",
        unitPrice: 1000,
        accessories: [
          { name: "G99 Application", quantity: 1, unitPrice: 250 },
          { name: "EcoFlow Battery Mounting", quantity: 1, unitPrice: 179 },
          { name: "EcoFlow PowerInsight Tablet", quantity: 1, unitPrice: 199 },
        ],
      },
    ],
  },
  {
    kind: "battery",
    title: "Battery",
    singular: "Battery",
    addLabel: "Add battery",
    presets: [
      {
        name: "EcoFlow PowerOcean Battery 5kw",
        unitPrice: 1169,
        accessories: BATTERY_ACCESSORIES(),
      },
      // Prices for the OCEAN 2 batteries aren't set yet — enter the unit price when adding one.
      {
        name: "EcoFlow OCEAN 2 Battery 5 kWh",
        unitPrice: 0,
        accessories: BATTERY_ACCESSORIES(),
      },
      {
        name: "EcoFlow OCEAN 2 Battery 5 kWh (Three Phase)",
        unitPrice: 0,
        accessories: BATTERY_ACCESSORIES(),
      },
      {
        name: "EcoFlow OCEAN 2 Battery 8 kWh",
        unitPrice: 0,
        accessories: BATTERY_ACCESSORIES(),
      },
      {
        name: "EcoFlow OCEAN 2 Battery 8 kWh (Three Phase)",
        unitPrice: 0,
        accessories: BATTERY_ACCESSORIES(),
      },
    ],
  },
  { kind: "ev_charger", title: "EV charger", singular: "EV Charger", addLabel: "Add ev charger", presets: [] },
  { kind: "gateway", title: "Gateway / change over switch", singular: "Gateway", addLabel: "Add gateway / change over switch", presets: [] },
];
