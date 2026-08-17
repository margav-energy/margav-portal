import { quotes } from "@/data/quotes";
import { boilerQuoteDetails } from "@/data/boiler-quote-details";
import { buildSolarQuoteDetail } from "@/data/solar-quote-details";
import type { Quote, QuoteStage } from "@/types/quote";
import type { BoilerQuoteDetail } from "@/types/boiler-quote";
import type { SolarQuoteDetail } from "@/types/solar-quote";

/**
 * Thin data-access layer over the mock quotes array. Every function is
 * `async` even though today's implementation is synchronous, so call sites
 * already look like they're hitting an API — swapping this file out for a
 * real backend later shouldn't require touching anything that calls it.
 */

export async function getAllQuotes(): Promise<Quote[]> {
  return quotes;
}

export async function getQuotesByStage(stage: QuoteStage): Promise<Quote[]> {
  return quotes.filter((quote) => quote.stage === stage);
}

export async function getQuoteById(id: string): Promise<Quote | undefined> {
  return quotes.find((quote) => quote.id === id);
}

/**
 * Every quote has a rich detail view — boiler quotes read from hand-authored
 * mock data (`boiler-quote-details.ts`), everything else (the default,
 * "solar" product line) is derived on the fly from the quote's own fields
 * (`solar-quote-details.ts`). This is the single entry point the detail
 * page calls; it returns `undefined` only if the quote itself doesn't exist.
 */
export async function getQuoteDetail(
  id: string,
): Promise<{ quote: Quote; detail: BoilerQuoteDetail | SolarQuoteDetail } | undefined> {
  const quote = await getQuoteById(id);
  if (!quote) return undefined;

  const detail = quote.productType === "boiler" ? boilerQuoteDetails[id] : buildSolarQuoteDetail(quote);
  if (!detail) return undefined;

  return { quote, detail };
}

export async function getQuoteSummary(): Promise<{
  totalQuotes: number;
  totalSigned: number;
}> {
  return {
    totalQuotes: quotes.length,
    totalSigned: quotes.filter((quote) => quote.stage === "signed").length,
  };
}
