import Link from "next/link";
import { StatusPill } from "@/components/ui/StatusPill";
import { Pagination } from "@/components/ui/Pagination";
import { PAYMENT_TYPE_LABELS } from "@/lib/status-colors";
import { formatCurrency, formatDate } from "@/lib/format";
import { PAGE_SIZE } from "@/lib/constants";
import type { Quote } from "@/types/quote";

export function QuotesTable({ quotes }: { quotes: Quote[] }) {
  return (
    <Pagination
      rows={quotes.map((quote) => (
        <QuoteRow key={quote.id} quote={quote} />
      ))}
      pageSize={PAGE_SIZE}
      emptyMessage="No quotes match this view."
    />
  );
}

function QuoteRow({ quote }: { quote: Quote }) {
  return (
    <Link
      href={`/quotes/${quote.id}`}
      className="flex flex-col gap-3 px-5 py-4 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">
          {quote.customerName}
        </p>
        <p className="truncate text-sm text-slate-500">
          {quote.postcode} &middot; Sent {formatDate(quote.sentDate)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-4 sm:gap-6">
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900">
            {formatCurrency(quote.amount)}
          </p>
          <p className="text-sm text-slate-500">
            {PAYMENT_TYPE_LABELS[quote.paymentType]}
          </p>
        </div>
        {quote.installStatus ? (
          <StatusPill status={quote.installStatus} />
        ) : (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-slate-500">
            Sent to Sign
          </span>
        )}
      </div>
    </Link>
  );
}
