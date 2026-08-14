import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { Pill } from "@/components/ui/Pill";
import { PAYMENT_TYPE_LABELS } from "@/lib/status-colors";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Quote } from "@/types/quote";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

export function QuoteDetailCard({ quote }: { quote: Quote }) {
  return (
    <Card className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {quote.customerName}
          </h2>
          <p className="text-sm text-slate-500">{quote.postcode}</p>
        </div>
        {quote.installStatus ? (
          <StatusPill status={quote.installStatus} />
        ) : (
          <Pill label="Sent to Sign" className="bg-slate-100 text-slate-500" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
        <Field label="Amount" value={formatCurrency(quote.amount)} />
        <Field label="Payment Type" value={PAYMENT_TYPE_LABELS[quote.paymentType]} />
        <Field label="Sent" value={formatDate(quote.sentDate)} />
        {quote.signedDate && (
          <Field label="Signed" value={formatDate(quote.signedDate)} />
        )}
      </div>

      {quote.notes && (
        <div className="mt-6 border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Notes
          </p>
          <p className="mt-1 text-sm text-slate-700">{quote.notes}</p>
        </div>
      )}
    </Card>
  );
}
