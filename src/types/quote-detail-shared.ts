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

export type PaymentMethodOption =
  | "bacs"
  | "monthly_plan_15yr"
  | "interest_free_credit_3yr"
  | "hometree_25yr"
  | "buy_now_pay_later";

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
  costPrice: number;
  sellPrice: number;
  profit: number;
  marginPercent: number;
}
