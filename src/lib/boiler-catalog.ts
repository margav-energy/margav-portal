/**
 * Reference data for the "Add boiler" / "Edit boiler" form's Make and Model
 * dropdowns (see `BoilerUnitsSection.tsx`). Kept as a plain, easily editable
 * array — add a manufacturer or a model by adding an entry here, no other
 * code changes needed.
 */

export interface BoilerMakeOption {
  make: string;
  /** Models available for this make — drives the dependent Model dropdown. */
  models: string[];
}

export const BOILER_MAKES: BoilerMakeOption[] = [
  { make: "Intergas", models: ["Xclusive 24", "Xclusive 30", "Xclusive 36"] },
];

export const BOILER_MAKE_OPTIONS = BOILER_MAKES.map((option) => option.make);

/** Models for a given make, or none if the make isn't in the catalog (e.g. not yet chosen). */
export function modelsForMake(make: string): string[] {
  return BOILER_MAKES.find((option) => option.make === make)?.models ?? [];
}

/** Preset options plus a legacy value that predates the preset list, so
 *  editing an old free-text boiler unit never silently blanks/changes it —
 *  same pattern as `withLegacyValue` in BoilerUnitsSection.tsx. */
export function withLegacyOption(options: string[], current: string): string[] {
  if (!current || options.includes(current)) return options;
  return [...options, current];
}
