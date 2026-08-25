import { notFound } from "next/navigation";
import Link from "next/link";
import { getQuoteDetail } from "@/data/quotes-service";
import { getActivePresenterDeck } from "@/data/presenter-deck-service";
import { requireStaffUser } from "@/data/current-user";
import { PresenterViewer } from "@/components/quotes/presenter/PresenterViewer";
import type { BoilerQuoteDetail } from "@/types/boiler-quote";

// Boiler-only for now — the 3 live slides are built against BoilerQuoteDetail.
export default async function QuotePresenterPage({
  params,
}: PageProps<"/quotes/[id]/presenter">) {
  const { id } = await params;
  const [result, user] = await Promise.all([getQuoteDetail(id), requireStaffUser()]);

  if (!result || result.quote.productType !== "boiler") notFound();

  const deck = await getActivePresenterDeck();

  if (!deck || deck.slides.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
        <p className="text-lg font-semibold text-slate-900">No sales deck uploaded yet</p>
        {user?.role === "admin" ? (
          <>
            <p className="max-w-sm text-sm text-slate-500">Upload one to start presenting quotes.</p>
            <Link href="/settings/presenter-deck" className="text-sm font-medium text-brand-blue hover:underline">
              Go to Presenter Deck settings
            </Link>
          </>
        ) : (
          <p className="max-w-sm text-sm text-slate-500">Ask an admin to upload one in Settings.</p>
        )}
        <Link href={`/quotes/${id}`} className="mt-4 text-sm text-slate-400 hover:underline">
          Back to quote
        </Link>
      </div>
    );
  }

  return <PresenterViewer deck={deck} detail={result.detail as BoilerQuoteDetail} />;
}
