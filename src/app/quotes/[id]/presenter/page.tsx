import { notFound } from "next/navigation";
import { getQuoteDetail } from "@/data/quotes-service";
import { BoilerPresenter } from "@/components/quotes/presenter/BoilerPresenter";
import type { BoilerQuoteDetail } from "@/types/boiler-quote";

// Boiler-only for now — there's no equivalent branded deck for solar yet.
export default async function QuotePresenterPage({
  params,
}: PageProps<"/quotes/[id]/presenter">) {
  const { id } = await params;
  const result = await getQuoteDetail(id);

  if (!result || result.quote.productType !== "boiler") notFound();

  return <BoilerPresenter detail={result.detail as BoilerQuoteDetail} />;
}
