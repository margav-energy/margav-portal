/** A component line (panels / inverter / battery) in the Easy PV bill of materials. */
export interface EasyPvComponent {
  name: string;
  qty: number;
}

/** One cart line from Easy PV — priced at Midsummer's cost (ex VAT), not the customer price. */
export type EasyPvLineKind = "panel" | "inverter" | "battery" | "optimiser" | "mounting" | "electrical" | "other";

export interface EasyPvCartLine {
  name: string;
  qty: number;
  /** Midsummer cost of one, ex VAT and delivery. */
  unitCost: number;
  kind: EasyPvLineKind;
}

export interface EasyPvRoof {
  label: string;
  /** Degrees from south (west = 90, south-east = -45). */
  orientation?: number;
  pitch?: number;
  mountingType?: string;
  panelCount: number;
  /** This roof's own bill of materials (panels + mounting). */
  items: { name: string; qty: number; isPanel: boolean }[];
}

/**
 * What we keep from Easy PV's `GET /projects/data` — enough for the quote
 * page without storing customer details or the whole payload.
 */
export interface EasyPvSummary {
  projectName: string;
  /** Easy PV's own status (Lead / Quote / Sale ...), often empty. */
  status: string;
  panels: EasyPvComponent[];
  inverters: EasyPvComponent[];
  batteries: EasyPvComponent[];
  roofs: EasyPvRoof[];
  /** Derived from "465W" in the panel name x qty — Easy PV doesn't return kWp. */
  systemKwp?: number;
  /** Derived from "4.66kWh" in the battery name x qty. */
  batteryKwh?: number;
  /** Midsummer cart total (ex VAT and delivery). */
  materialsTotal: number;
  /** The priced cart, classified — what "Import items" turns into quote items. Absent on a summary saved before this existed (refresh to get it). */
  cart?: EasyPvCartLine[];
  /** Everything not covered above (mounting, electrical), grouped for display. */
  otherItems: EasyPvComponent[];
  midsummerOrderLink?: string;
  /** Easy PV's last-saved time for the project (ISO-ish string). */
  modifiedAt?: string;
}

export interface EasyPvFile {
  id: string;
  category: "images" | "uploads";
  /** Easy PV's group inside the category, e.g. "quotation" for the proposal PDF. */
  groupName: string;
  /** Easy PV's file name, e.g. "Customer proposal~Quotation.pdf". */
  name: string;
  contentType: string;
  sizeBytes: number;
  /** Signed, expires after an hour. */
  url: string;
}

/** One Easy PV cart line whose quantity on the quote differs from Easy PV's. */
export interface EasyPvTallyDifference {
  name: string;
  easyPvQty: number;
  quoteQty: number;
}

/**
 * Does the quote still hold what Easy PV's cart says? Compares by item name and quantity, so a
 * line a rep removed or changed on purpose shows up too — it's a prompt to check, not an error.
 */
export interface EasyPvTally {
  differences: EasyPvTallyDifference[];
  /** Easy PV's materials total (Midsummer cost, ex VAT). */
  easyPvCost: number;
  /** The markup % used at the last import, if there was one. */
  markupPct?: number;
  /** easyPvCost with that markup applied — what the imported lines should add up to. */
  expectedSell?: number;
  /** What those same lines add up to on the quote right now. */
  quoteSell: number;
}

export interface EasyPvLink {
  tally?: EasyPvTally;
  projectId?: number;
  summary?: EasyPvSummary;
  syncedAt?: string;
  /** Pages of the Easy PV proposal to leave out of the quote sent to the customer, e.g. "9" or "9-11". */
  proposalSkipPages?: string;
  files: EasyPvFile[];
  /** False when the env vars aren't set — the card shows a setup note instead of buttons. */
  configured: boolean;
}

export interface EasyPvProjectOption {
  id: number;
  projectName: string;
  customerName: string;
  address: string;
  postcode: string;
  dateModified: string;
}
