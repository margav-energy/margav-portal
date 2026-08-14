import Link from "next/link";
import { getAllQuotes, getQuotesByStage } from "@/data/quotes-service";
import { Card } from "@/components/ui/Card";
import { QuotesTable } from "@/components/quotes/QuotesTable";
import { cn } from "@/lib/utils";
import type { QuoteStage } from "@/types/quote";

const TABS: { label: string; value: QuoteStage | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Sent to Sign", value: "sent_to_sign" },
  { label: "Signed", value: "signed" },
];

export default async function QuotesPage({
  searchParams,
}: PageProps<"/quotes">) {
  const { stage: rawStage } = await searchParams;
  const stage = Array.isArray(rawStage) ? rawStage[0] : rawStage;
  const activeTab = stage === "sent_to_sign" || stage === "signed" ? stage : "all";

  const quotes =
    activeTab === "all" ? await getAllQuotes() : await getQuotesByStage(activeTab);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h2 className="text-2xl font-semibold text-slate-900">All Quotes</h2>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value === "all" ? "/quotes" : `/quotes?stage=${tab.value}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.value
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <Card>
        <QuotesTable quotes={quotes} />
      </Card>
    </div>
  );
}
