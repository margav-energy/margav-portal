/**
 * The items on "Solar Image Checklist.pdf" — the photos an installer must
 * take at each stage of a solar install. Plain data (no server-only imports)
 * so both the installer's form and the admin's review card can use it.
 * Each item's `key` is stored against its photos, so don't rename one once
 * photos exist; reword `label` freely.
 */
export type ChecklistStage = "pre" | "mid" | "post";

export interface ChecklistItem {
  key: string;
  label: string;
  stage: ChecklistStage;
}

export const CHECKLIST_STAGES: { stage: ChecklistStage; title: string; description: string }[] = [
  { stage: "pre", title: "Pre-installation", description: "Before any work starts" },
  { stage: "mid", title: "Mid-installation", description: "While the system is going in" },
  { stage: "post", title: "Post-installation", description: "Once everything is complete" },
];

export const CHECKLIST_ITEMS: ChecklistItem[] = [
  // PRE
  { key: "pre-ppe", stage: "pre", label: "Engineer wearing full PPE" },
  { key: "pre-roof-ground", stage: "pre", label: "Roof as seen from ground" },
  { key: "pre-roof-space", stage: "pre", label: "Roof space – general" },
  { key: "pre-roof-damage", stage: "pre", label: "Roof space – close ups of existing damage" },
  { key: "pre-guttering", stage: "pre", label: "Guttering on any roof faces around scaffold / install" },
  { key: "pre-scaffold", stage: "pre", label: "Scaffold showing ladders and scafftag (multiple pictures)" },
  { key: "pre-inverter-space", stage: "pre", label: "Inverter space – general" },
  { key: "pre-consumer-unit", stage: "pre", label: "Consumer unit / meter / fuses" },
  {
    key: "pre-existing-damage",
    stage: "pre",
    label: "Close up of existing damage around inverter / battery / cable run spaces / consumer unit etc.",
  },
  // MID
  { key: "mid-roof-hooks", stage: "mid", label: "Roof hooks fitted" },
  { key: "mid-roof-hook-close", stage: "mid", label: "Roof hook close up" },
  { key: "mid-rail-installing", stage: "mid", label: "Rail being installed (showing engineer in hi-vis)" },
  { key: "mid-rail-installed", stage: "mid", label: "Rail installed" },
  { key: "mid-strings-tied", stage: "mid", label: "Strings cable tied to rail" },
  { key: "mid-string-entry", stage: "mid", label: "String entry point (going through felt lap undamaged)" },
  { key: "mid-panel-nameplate", stage: "mid", label: "Panel name plate (once)" },
  { key: "mid-panel-serials", stage: "mid", label: "Panel serial badges (every panel)" },
  { key: "mid-panels-installing", stage: "mid", label: "Panels being installed (showing engineers in hi-vis)" },
  { key: "mid-cu-cover-off", stage: "mid", label: "Consumer unit (cover off)" },
  { key: "mid-acdc-cover-off", stage: "mid", label: "AC & DC (cover off)" },
  // POST
  { key: "post-panels-above", stage: "post", label: "Panels complete from above (multiple pictures)" },
  { key: "post-panels-below", stage: "post", label: "Panels complete looking up from underneath" },
  { key: "post-guttering", stage: "post", label: "Guttering free of debris / damage" },
  { key: "post-array-ground", stage: "post", label: "Array as seen from ground after clean up" },
  { key: "post-cable-runs", stage: "post", label: "Cable runs in conduit / trunking (labelled)" },
  { key: "post-wall-penetrations", stage: "post", label: "Wall penetrations (sealed)" },
  { key: "post-earthing", stage: "post", label: "Earthing between batteries and inverter" },
  { key: "post-inverter-serial", stage: "post", label: "Inverter model and serial number" },
  { key: "post-battery-serial", stage: "post", label: "Battery model and serial number" },
  { key: "post-meter-serial", stage: "post", label: "Generation meter model and serial number" },
  { key: "post-wifi-serial", stage: "post", label: "Wifi dongle model and serial number" },
  { key: "post-cu-cover-on", stage: "post", label: "Consumer unit (cover on, labelled neatly)" },
  { key: "post-isolators-cover-on", stage: "post", label: "AC & DC isolators (cover on)" },
  { key: "post-all-electrical", stage: "post", label: "All electrical install from various angles (inverter, battery, etc.)" },
  { key: "post-signage", stage: "post", label: "All electrical signage (shutdown procedure, string diagram, etc.)" },
  { key: "post-warning-stickers", stage: "post", label: "All electrical warning stickers" },
];

export function getChecklistItem(key: string): ChecklistItem | undefined {
  return CHECKLIST_ITEMS.find((item) => item.key === key);
}

export const CHECKLIST_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const CHECKLIST_MAX_PHOTO_BYTES = 25 * 1024 * 1024;

/** Items with a photo or marked N/A, out of the total. */
export function countCompleted(photoItemKeys: Iterable<string>, naItems: string[]): { done: number; total: number } {
  const withPhoto = new Set(photoItemKeys);
  const na = new Set(naItems);
  const done = CHECKLIST_ITEMS.filter((item) => withPhoto.has(item.key) || na.has(item.key)).length;
  return { done, total: CHECKLIST_ITEMS.length };
}

/** Items in `stage` with a photo or marked N/A, out of the stage's total. */
export function countStageCompleted(
  stage: ChecklistStage,
  photoItemKeys: Iterable<string>,
  naItems: string[],
): { done: number; total: number } {
  const withPhoto = new Set(photoItemKeys);
  const na = new Set(naItems);
  const items = CHECKLIST_ITEMS.filter((item) => item.stage === stage);
  return { done: items.filter((item) => withPhoto.has(item.key) || na.has(item.key)).length, total: items.length };
}
