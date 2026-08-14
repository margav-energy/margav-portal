import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getQuoteById } from "@/data/quotes-service";
import { QuoteDetailCard } from "@/components/quotes/QuoteDetailCard";

export default async function QuoteDetailPage({
  params,
}: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const quote = await getQuoteById(id);

  if (!quote) notFound();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        href="/quotes"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all quotes
      </Link>
      <QuoteDetailCard quote={quote} />
    </div>
  );
}
