"use client";

import Link from "next/link";
import { StatusPill } from "@/components/ui/StatusPill";
import { PAYMENT_TYPE_LABELS } from "@/lib/status-colors";
import { formatCurrency, formatDate } from "@/lib/format";
import { useRevealSensitive } from "@/components/dashboard/RevealSensitiveContext";
import { RevealEyeButton } from "@/components/dashboard/RevealEyeButton";
import type { Quote } from "@/types/quote";

/**
 * The price (`quote.amount`) is masked until revealed via the eye icon — a
 * rep may have this open on screen with the customer looking on, and
 * showing figures at this stage (before "View all") reads as unpolished.
 * Prices/counts on the `/quotes` list and detail pages are always shown in
 * full — this masking is dashboard-only.
 *
 * The row is a "stretched link" (an absolutely-positioned `<Link>` behind
 * the content, rather than wrapping everything in one) so the eye button
 * can sit on top and take its own clicks — a real `<button>` nested inside
 * an `<a>` is invalid HTML and clicks on it would also trigger navigation.
 */
export function QuoteListRow({
  quote,
  variant,
}: {
  quote: Quote;
  variant: "sent" | "signed";
}) {
  const { isRevealed } = useRevealSensitive();

  return (
    <div className="relative flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50">
      <Link
        href={`/quotes/${quote.id}`}
        className="absolute inset-0"
        aria-label={`View quote for ${quote.customerName}`}
      />
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
      <div className="relative z-10 flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-900">
              {isRevealed ? formatCurrency(quote.amount - quote.discountAmount) : "**"}
            </p>
            {variant === "signed" && (
              <p className="text-sm text-slate-500">
                {PAYMENT_TYPE_LABELS[quote.paymentType]}
              </p>
            )}
          </div>
          <RevealEyeButton />
        </div>
        {variant === "signed" && quote.installStatus && (
          <StatusPill status={quote.installStatus} />
        )}
      </div>
    </div>
  );
}
