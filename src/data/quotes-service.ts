import { quotes } from "@/data/quotes";
import type { Quote, QuoteStage } from "@/types/quote";

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

export async function getQuoteSummary(): Promise<{
  totalQuotes: number;
  totalSigned: number;
}> {
  return {
    totalQuotes: quotes.length,
    totalSigned: quotes.filter((quote) => quote.stage === "signed").length,
  };
}
