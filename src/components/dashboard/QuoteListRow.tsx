import Link from "next/link";
import { StatusPill } from "@/components/ui/StatusPill";
import { PAYMENT_TYPE_LABELS } from "@/lib/status-colors";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Quote } from "@/types/quote";

export function QuoteListRow({
  quote,
  variant,
}: {
  quote: Quote;
  variant: "sent" | "signed";
}) {
  return (
    <Link
      href={`/quotes/${quote.id}`}
      className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">
          {quote.customerName}
        </p>
        <p className="truncate text-sm text-slate-500">
          {variant === "sent"
            ? `Sent on ${formatDate(quote.sentDate)}`
            : quote.postcode}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-900">
            {formatCurrency(quote.amount)}
          </p>
          {variant === "signed" && (
            <p className="text-sm text-slate-500">
              {PAYMENT_TYPE_LABELS[quote.paymentType]}
            </p>
          )}
        </div>
        {variant === "signed" && quote.installStatus && (
          <StatusPill status={quote.installStatus} />
        )}
      </div>
    </Link>
  );
}
