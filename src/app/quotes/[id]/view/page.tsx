import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { getQuoteDetail } from "@/data/quotes-service";
import { buildDocumentSnapshot } from "@/lib/esignature/document";
import { QuoteDocumentPreview } from "@/components/esignature/QuoteDocumentPreview";

/**
 * The internal "View Quote" button's destination — a read-only preview of
 * the quote's *current* data, reusing the exact same `buildDocumentSnapshot`
 * + `QuoteDocumentPreview` the customer's `/sign/[token]` page renders, so
 * this always looks identical to what "Send Quote" would actually send.
 * Unlike the sign page, this re-fetches live (it's not locked to a
 * snapshot), works before a quote's ever been sent, and never expires.
 */
export default async function ViewQuotePage({
  params,
}: PageProps<"/quotes/[id]/view">) {
  const { id } = await params;
  const result = await getQuoteDetail(id);

  if (!result) notFound();

  const { quote, detail } = result;
  const snapshot = buildDocumentSnapshot(quote, detail);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Link
        href={`/quotes/${id}`}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to quote
      </Link>

      <div className="flex items-center gap-2 rounded-lg bg-brand-blue/5 px-4 py-2.5 text-sm text-brand-blue">
        <Info className="h-4 w-4 shrink-0" />
        This is a live preview of the quote&rsquo;s current details — it may differ from what was actually sent if
        changes were made afterward.
      </div>

      <QuoteDocumentPreview snapshot={snapshot} />
    </div>
  );
}
