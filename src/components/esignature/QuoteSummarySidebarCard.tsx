"use client";

import { useState } from "react";
import { Download, Mail, Phone } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SendForSignatureModal } from "@/components/quotes/detail/SendForSignatureModal";
import { HEAD_OFFICE_EMAIL, HEAD_OFFICE_PHONE } from "@/lib/constants";
import type { DocumentSnapshot } from "@/lib/esignature/document";

/**
 * Compact, single-column quote summary + actions — sits alongside the
 * uploaded document on "View Quote" (src/app/quotes/[id]/view/page.tsx)
 * once one exists. The uploaded document is the main content (it already
 * has everything: pricing, terms, guarantee, ...), but a quick-glance
 * summary + actions panel is still worth keeping next to it, same idea as
 * the reference proposal-tool screenshot's sidebar.
 *
 * "Accept & Sign" doesn't mean *staff* sign it — it opens the same
 * `SendForSignatureModal` the quote detail page's "Send Quote" button
 * uses, emailing the customer their own `/sign/[token]` link to review and
 * sign. That's the only kind of "accept & sign" that makes sense from an
 * internal staff view.
 */
export function QuoteSummarySidebarCard({ snapshot, pdfHref }: { snapshot: DocumentSnapshot; pdfHref: string }) {
  const [isSending, setIsSending] = useState(false);
  const hasRepContact = Boolean(snapshot.repName && (snapshot.repEmail || snapshot.repPhone));
  const hasHeadOffice = Boolean(HEAD_OFFICE_PHONE || HEAD_OFFICE_EMAIL);

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div>
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">System Summary</h3>
        <p className="mt-1 text-sm font-semibold text-slate-900">{snapshot.customerName}</p>
        {snapshot.headlineLabel && <p className="text-xs text-slate-500">{snapshot.headlineLabel}</p>}
      </div>

      <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3 text-sm">
        {snapshot.subtotalLabel && (
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium text-slate-900">{snapshot.subtotalLabel}</span>
          </div>
        )}
        {snapshot.discountLabel && (
          <div className="flex justify-between">
            <span className="text-slate-500">Discount</span>
            <span className="font-medium text-slate-900">-{snapshot.discountLabel}</span>
          </div>
        )}
      </div>

      <div className="flex justify-between border-t border-slate-900 pt-2 text-sm">
        <span className="font-semibold text-slate-900">Total</span>
        <span className="font-semibold text-slate-900">{snapshot.totalPriceLabel}</span>
      </div>
      {snapshot.depositLabel && (
        <div className="-mt-2.5 flex justify-between text-sm">
          <span className="text-slate-500">Deposit</span>
          <span className="font-medium text-slate-900">{snapshot.depositLabel}</span>
        </div>
      )}

      {/* The term actually selected on the Payment Method card — not a
          1/5/10-year comparison, see `monthlyPlansFor` in document.ts. */}
      {snapshot.monthlyPlans && snapshot.monthlyPlans.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Monthly Plan</h3>
          <div className="mt-2 flex flex-col gap-1.5">
            {snapshot.monthlyPlans.map((plan) => (
              <div key={plan.years} className="flex items-baseline justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-500">
                  {plan.years} {plan.years === 1 ? "year" : "years"}
                </span>
                <span className="text-xs font-semibold text-slate-900">{plan.monthlyLabel}/mo</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button variant="success" onClick={() => setIsSending(true)}>
          Accept &amp; Sign
        </Button>
        <a
          href={pdfHref}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </a>
      </div>

      {(hasRepContact || hasHeadOffice) && (
        <div>
          <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Get In Touch</h3>
          <div className="mt-2 flex flex-col gap-2">
            {hasRepContact && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-slate-700">{snapshot.repName}</span>
                <div className="flex shrink-0 items-center gap-2">
                  {snapshot.repPhone && (
                    <a href={`tel:${snapshot.repPhone}`} aria-label={`Call ${snapshot.repName}`}>
                      <Phone className="h-4 w-4 text-brand-green-mid" />
                    </a>
                  )}
                  {snapshot.repEmail && (
                    <a href={`mailto:${snapshot.repEmail}`} aria-label={`Email ${snapshot.repName}`}>
                      <Mail className="h-4 w-4 text-brand-blue" />
                    </a>
                  )}
                </div>
              </div>
            )}
            {hasHeadOffice && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <span className="text-slate-700">Head Office</span>
                <div className="flex shrink-0 items-center gap-2">
                  {HEAD_OFFICE_PHONE && (
                    <a href={`tel:${HEAD_OFFICE_PHONE}`} aria-label="Call Head Office">
                      <Phone className="h-4 w-4 text-brand-green-mid" />
                    </a>
                  )}
                  {HEAD_OFFICE_EMAIL && (
                    <a href={`mailto:${HEAD_OFFICE_EMAIL}`} aria-label="Email Head Office">
                      <Mail className="h-4 w-4 text-brand-blue" />
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isSending && (
        <SendForSignatureModal
          quoteId={snapshot.quoteId}
          customerName={snapshot.customerName}
          customerEmail={snapshot.customerEmail ?? ""}
          onClose={() => setIsSending(false)}
        />
      )}
    </Card>
  );
}
