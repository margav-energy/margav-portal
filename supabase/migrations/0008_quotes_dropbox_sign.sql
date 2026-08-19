-- Dropbox Sign signature-request id, stored for audit/support lookup
-- (cross-referencing the Dropbox Sign dashboard). The webhook
-- (src/app/api/dropbox-sign/webhook/route.ts) finds the quote via the
-- `metadata.quoteId` echoed back on every Dropbox Sign event, not this
-- column — see src/lib/dropbox-sign.ts's `sendQuoteForSignature`, which
-- sets that metadata at send-time.
--
-- Safe to re-run.

alter table public.quotes
  add column if not exists dropbox_sign_request_id text;
