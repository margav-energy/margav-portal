/**
 * Types shared by every product vertical's rich quote detail view (see
 * `src/types/boiler-quote.ts` and `src/types/solar-quote.ts`). Nothing here
 * is specific to a product — line items, payment options, customer info,
 * notes, and history all look the same regardless of what's being quoted.
 */

export interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface FreeTextExtra {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

/** Matches `quote_line_items.section` in `supabase/schema.sql`. */
export type LineItemSection = "extra" | "standard_additional" | "free_text";

/** See `src/lib/finance.ts` for the Monthly Plan's selectable terms + APR rule. */
export type PaymentMethodOption = "bacs" | "monthly_plan";

export interface CustomerDetails {
  name: string;
  email: string;
  phone: string;
  addressLines: string[];
}

export interface QuoteNote {
  id: string;
  authorName: string;
  authorInitials: string;
  /** ISO datetime, e.g. "2026-06-11T14:13:00" */
  timestamp: string;
  body: string;
}

export interface QuoteHistoryEntry {
  id: string;
  actorName: string;
  /** System-generated entries render a gear icon instead of an avatar. */
  isSystem?: boolean;
  description: string;
  /** ISO datetime */
  timestamp: string;
}

export interface ProfitBreakdown {
  /**
   * For boiler quotes this is Margav's real install cost — calculated from
   * `src/lib/boiler-install-cost.ts`, not editable (see `ProfitCard`'s
   * `editable` prop). Solar has no cost model yet, so its cost price is
   * whatever a rep manually entered (0 until someone does).
   */
  costPrice: number;
  sellPrice: number;
  profit: number;
  marginPercent: number;
  /** Boiler quotes only — `costPrice` broken out into what it's actually
   *  made of (see `boilerCostBreakdown` in src/lib/boiler-install-cost.ts),
   *  in display order, summing exactly to `costPrice`. Absent for solar,
   *  which has no cost model to break down. */
  costLineItems?: { name: string; amount: number; category: "materials" | "extra" }[];
  /** Boiler quotes only — the `"materials"` subset of `costLineItems`
   *  (boiler unit + flue + Fernox Filter + Gateway), what the Profit card
   *  shows as "Cost price". `costPrice` itself stays the full total
   *  (materials + Installer Cost + Rep Comms) — that's still what
   *  Profit/Margin derive from. Absent for solar. */
  materialsCost?: number;
}
