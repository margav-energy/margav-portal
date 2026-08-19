import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getQuoteDetail } from "@/data/quotes-service";
import { getAllProfiles } from "@/data/profiles-service";
import { getBoilerSurveyForQuote } from "@/data/boiler-survey-service";
import { BoilerQuoteDetail } from "@/components/quotes/boiler/BoilerQuoteDetail";
import { SolarQuoteDetail } from "@/components/quotes/solar/SolarQuoteDetail";
import type { BoilerQuoteDetail as BoilerQuoteDetailData } from "@/types/boiler-quote";
import type { SolarQuoteDetail as SolarQuoteDetailData } from "@/types/solar-quote";

export default async function QuoteDetailPage({
  params,
}: PageProps<"/quotes/[id]">) {
  const { id } = await params;
  const [result, reps] = await Promise.all([getQuoteDetail(id), getAllProfiles()]);

  if (!result) notFound();

  const { quote, detail } = result;
  const isBoiler = quote.productType === "boiler";
  const survey = isBoiler ? await getBoilerSurveyForQuote(id) : undefined;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Link
        href="/quotes"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all quotes
      </Link>
      {isBoiler ? (
        <BoilerQuoteDetail detail={detail as BoilerQuoteDetailData} reps={reps} survey={survey} />
      ) : (
        <SolarQuoteDetail detail={detail as SolarQuoteDetailData} reps={reps} />
      )}
    </div>
  );
}
