import { getAllQuotes, getQuotesByStage } from "@/data/quotes-service";
import { requireStaffUser } from "@/data/current-user";
import { QuotesTable } from "@/components/quotes/QuotesTable";
import { QuotesPageHeader } from "@/components/quotes/QuotesPageHeader";
import type { QuoteStage } from "@/types/quote";

export default async function QuotesPage({
  searchParams,
}: PageProps<"/quotes">) {
  const user = await requireStaffUser();

  const { stage: rawStage } = await searchParams;
  const stage = Array.isArray(rawStage) ? rawStage[0] : rawStage;
  const activeStage: QuoteStage | "all" =
    stage === "sent_to_sign" || stage === "signed" ? stage : "all";

  // Reps only see quotes assigned to them; admins see everything (see
  // `getAllQuotes`'s doc comment in quotes-service.ts).
  const representativeId = user.role === "rep" ? user.id : undefined;

  // No visible tab for this — Dashboard's "Quotes sent to sign"/"Quotes
  // signed" quick links still land here pre-filtered via `?stage=`.
  const quotes =
    activeStage === "all"
      ? await getAllQuotes(representativeId)
      : await getQuotesByStage(activeStage, representativeId);

  return (
    <div className="flex w-full flex-col gap-4">
      <QuotesPageHeader isAdmin={user.role === "admin"} />
      <QuotesTable quotes={quotes} />
    </div>
  );
}
