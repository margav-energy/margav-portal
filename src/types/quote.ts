export type QuoteStage = "sent_to_sign" | "signed";

export type ProductType = "solar" | "boiler";

export type InstallStatus =
  | "awaiting_scaffold"
  | "scaffold_removal"
  | "install_in_progress"
  | "completed_install"
  | "cancelled";

export type PaymentType = "cash" | "finance" | "card" | "bacs";

/**
 * The "All Quotes" list's own pipeline status — independent of `QuoteStage`/
 * `InstallStatus` above (which the Dashboard's quick panels still key off).
 */
export type QuotePipelineStatus = "new_lead" | "ready_to_pitch" | "locked";

export interface Quote {
  id: string;
  customerName: string;
  postcode: string;
  /** Full postal address, e.g. "53 Swan Bank, Wolverhampton, WV4 5PZ" */
  address: string;
  amount: number;
  paymentType: PaymentType;
  stage: QuoteStage;
  /** ISO date, e.g. "2026-07-28" */
  sentDate: string;
  /** Present only when stage === "signed" */
  signedDate?: string;
  /** Present only when stage === "signed" */
  installStatus?: InstallStatus;
  notes?: string;
  /** Absent means "solar" — the app's original (and still default) product line. */
  productType?: ProductType;
  pipelineStatus: QuotePipelineStatus;
  /** Absent means unassigned — shown as "None" in the quotes list. */
  representative?: string;
  /** ISO datetime — set when "Send Quote" last successfully sent this quote for e-signature. Absent if never sent. */
  sentAt?: string;
  /** Dropbox Sign's signature_request_id, for audit/support lookup — the e-sign webhook keys off `metadata.quoteId` instead, not this. */
  dropboxSignRequestId?: string;
}

/**
 * A signed job that still needs an installer — the list shown in the
 * "assign a job" modal on the Installer Availability grid
 * (src/components/availability/AssignJobModal.tsx). Deliberately a lean,
 * separate shape from `Quote` (own query in `getUnassignedInstallJobs`,
 * not the full `QUOTE_COLUMNS`/`mapQuoteRow` pipeline) since this list
 * needs far fewer fields.
 */
export interface UnassignedInstallJob {
  id: string;
  reference: string | null;
  customerName: string;
  postcode: string;
  productType: ProductType;
  installStatus: InstallStatus | null;
}
