export type QuoteStage = "sent_to_sign" | "signed";

export type InstallStatus =
  | "awaiting_scaffold"
  | "scaffold_removal"
  | "install_in_progress"
  | "completed_install"
  | "cancelled";

export type PaymentType = "cash" | "finance" | "card" | "bacs";

export interface Quote {
  id: string;
  customerName: string;
  postcode: string;
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
}
