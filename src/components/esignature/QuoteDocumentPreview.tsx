import type { ReactNode } from "react";
import { Mail, Phone } from "lucide-react";
import { HEAD_OFFICE_EMAIL, HEAD_OFFICE_PHONE } from "@/lib/constants";
import type { DocumentSnapshot } from "@/lib/esignature/document";

/**
 * Renders a `DocumentSnapshot` as the customer would see it. Shared by two
 * call sites that must never drift apart visually:
 *   - `src/app/sign/[token]/SignForm.tsx` — the customer's actual signing
 *     page, showing the *locked* snapshot captured when "Send Quote" ran.
 *   - `src/app/quotes/[id]/view/page.tsx` — the internal "View Quote"
 *     button, showing a *live* snapshot built from the quote's current data.
 * No hooks/handlers of its own — `actionsSlot` lets each caller supply
 * whatever's actually interactive there (or nothing, for the read-only
 * internal preview, since staff aren't the ones signing) without this
 * component needing client-only behavior of its own.
 */
export function QuoteDocumentPreview({
  snapshot,
  actionsSlot,
}: {
  snapshot: DocumentSnapshot;
  actionsSlot?: ReactNode;
}) {
  const monthlyPlans = snapshot.monthlyPlans ?? [];
  const hasRepContact = Boolean(snapshot.repName && (snapshot.repEmail || snapshot.repPhone));
  const hasHeadOffice = Boolean(HEAD_OFFICE_PHONE || HEAD_OFFICE_EMAIL);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm md:grid md:grid-cols-5">
      {/* Hero panel */}
      <div className="flex flex-col gap-8 bg-slate-900 px-8 py-10 text-white md:col-span-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-green-gradient text-sm font-bold text-white">
            M
          </div>
          <span className="text-lg font-semibold tracking-tight">Margav Energy</span>
        </div>

        {snapshot.headlineLabel && (
          <div>
            <h1 className="text-4xl leading-tight font-bold sm:text-5xl">
              {snapshot.headlineLabel}
              <span className="text-brand-green-mid">.</span>
            </h1>
            {snapshot.subheadlineLabel && <p className="mt-3 text-lg text-slate-300">{snapshot.subheadlineLabel}</p>}
          </div>
        )}

        <div className="h-px w-16 bg-white/20" />

        <div>
          <p className="text-xl font-semibold">{snapshot.customerName}</p>
          <p className="mt-1 text-sm text-slate-400">
            {snapshot.productTypeLabel} Quote {snapshot.reference}
          </p>
          {snapshot.repName && (
            <p className="mt-3 text-sm text-slate-300">
              Prepared by <span className="font-medium text-white">{snapshot.repName}</span>
            </p>
          )}
          {snapshot.repEmail && <p className="text-sm text-slate-400">{snapshot.repEmail}</p>}
        </div>

        <div className="mt-auto text-sm text-slate-400">
          <p className="mb-1 font-medium text-slate-300">Addressed to</p>
          <p>{snapshot.customerName}</p>
          {snapshot.customerPhone && <p>{snapshot.customerPhone}</p>}
          {snapshot.customerEmail && <p>{snapshot.customerEmail}</p>}
          {snapshot.customerAddressLines.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
      </div>

      {/* Sidebar */}
      <div className="flex flex-col gap-6 bg-white px-6 py-8 md:col-span-2">
        <div>
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Quote summary</h2>
          <div className="mt-3 flex flex-col divide-y divide-slate-100 border-t border-slate-100">
            {snapshot.lineItems.map((item) => (
              <div key={item.name} className="flex justify-between gap-4 py-2 text-sm">
                <span className="text-slate-600">{item.name}</span>
                <span className="shrink-0 font-medium text-slate-900">{item.amountLabel}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-1.5 border-t border-slate-100 pt-3 text-sm">
            {snapshot.subtotalLabel && (
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal incl. VAT</span>
                <span className="font-medium text-slate-900">{snapshot.subtotalLabel}</span>
              </div>
            )}
            {snapshot.vatLabel && (
              <div className="flex justify-between">
                <span className="text-slate-500">Included VAT</span>
                <span className="font-medium text-slate-900">{snapshot.vatLabel}</span>
              </div>
            )}
            {snapshot.discountLabel && (
              <div className="flex justify-between">
                <span className="text-slate-500">Discount</span>
                <span className="font-medium text-slate-900">-{snapshot.discountLabel}</span>
              </div>
            )}
          </div>

          <div className="mt-2 flex justify-between border-t border-slate-900 pt-3">
            <span className="font-semibold text-slate-900">Total price</span>
            <span className="font-semibold text-slate-900">{snapshot.totalPriceLabel}</span>
          </div>
          {snapshot.depositLabel && (
            <div className="mt-1.5 flex justify-between text-sm">
              <span className="text-slate-500">Deposit</span>
              <span className="font-medium text-slate-900">{snapshot.depositLabel}</span>
            </div>
          )}
          <p className="mt-1 text-xs text-slate-400">Payment method: {snapshot.paymentMethodLabel}</p>
        </div>

        {monthlyPlans.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Monthly plans</h2>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {monthlyPlans.map((plan) => (
                <div key={plan.years} className="rounded-lg bg-slate-50 px-2 py-3">
                  <p className="text-xs text-slate-500">
                    {plan.years} {plan.years === 1 ? "year" : "years"}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{plan.monthlyLabel}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Representative example — 0% APR over 1 year, 9.9% APR on longer terms.
            </p>
          </div>
        )}

        {actionsSlot}

        {(hasRepContact || hasHeadOffice) && (
          <div>
            <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Get in touch</h2>
            <div className="mt-3 flex flex-col gap-2">
              {hasRepContact && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                  <span className="text-slate-700">{snapshot.repName}</span>
                  <div className="flex items-center gap-2">
                    {snapshot.repPhone && <span className="text-slate-500">{snapshot.repPhone}</span>}
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
                <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                  <span className="text-slate-700">Head Office</span>
                  <div className="flex items-center gap-2">
                    {HEAD_OFFICE_PHONE && <span className="text-slate-500">{HEAD_OFFICE_PHONE}</span>}
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

        <p className="text-xs text-slate-400">
          This quote is subject to survey. A statutory 14-day cooling-off period applies from the date you sign,
          during which you may cancel without penalty.
        </p>
      </div>
    </div>
  );
}
