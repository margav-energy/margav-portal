import type { DocumentSnapshot } from "@/lib/esignature/document";

/**
 * Renders a `DocumentSnapshot` as the customer would see it. Shared by two
 * call sites that must never drift apart visually:
 *   - `src/app/sign/[token]/SignForm.tsx` — the customer's actual signing
 *     page, showing the *locked* snapshot captured when "Send Quote" ran.
 *   - `src/app/quotes/[id]/view/page.tsx` — the internal "View Quote"
 *     button, showing a *live* snapshot built from the quote's current data.
 * No client-only behavior here (no hooks/handlers), so it's safe to import
 * from either a client or a server component.
 */
export function QuoteDocumentPreview({ snapshot }: { snapshot: DocumentSnapshot }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-slate-500 uppercase">Your quote</h2>
      <dl className="mb-4 flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Customer</dt>
          <dd className="font-medium text-slate-900">{snapshot.customerName}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Address</dt>
          <dd className="font-medium text-slate-900">{snapshot.customerAddressLines.join(", ") || "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Payment method</dt>
          <dd className="font-medium text-slate-900">{snapshot.paymentMethodLabel}</dd>
        </div>
      </dl>

      <div className="flex flex-col divide-y divide-slate-100 border-t border-slate-100">
        {snapshot.lineItems.map((item) => (
          <div key={item.name} className="flex justify-between py-2 text-sm">
            <span className="text-slate-600">{item.name}</span>
            <span className="font-medium text-slate-900">{item.amountLabel}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-slate-900 pt-3">
        <span className="font-semibold text-slate-900">Total price</span>
        <span className="font-semibold text-slate-900">{snapshot.totalPriceLabel}</span>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        This quote is subject to survey. A statutory 14-day cooling-off period applies from the date you sign,
        during which you may cancel without penalty.
      </p>
    </div>
  );
}
