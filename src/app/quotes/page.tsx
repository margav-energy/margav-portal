import { getAllQuotes, getQuotesByStage } from "@/data/quotes-service";
import { QuotesTable } from "@/components/quotes/QuotesTable";
import { QuotesPageHeader } from "@/components/quotes/QuotesPageHeader";
import type { QuoteStage } from "@/types/quote";

export default async function QuotesPage({
  searchParams,
}: PageProps<"/quotes">) {
  const { stage: rawStage } = await searchParams;
  const stage = Array.isArray(rawStage) ? rawStage[0] : rawStage;
  const activeStage: QuoteStage | "all" =
    stage === "sent_to_sign" || stage === "signed" ? stage : "all";

  // No visible tab for this — Dashboard's "Quotes sent to sign"/"Quotes
  // signed" quick links still land here pre-filtered via `?stage=`.
  const quotes =
    activeStage === "all" ? await getAllQuotes() : await getQuotesByStage(activeStage);

  return (
    <div className="flex w-full flex-col gap-4">
      <QuotesPageHeader />
      <QuotesTable quotes={quotes} />
    </div>
  );
}
