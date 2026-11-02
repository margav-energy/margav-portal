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
