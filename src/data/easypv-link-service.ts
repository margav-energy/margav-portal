import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isEasyPvConfigured } from "@/data/easypv-service";
import { getEasyPvFiles } from "@/data/easypv-files-service";
import type { EasyPvLink, EasyPvSummary, EasyPvTally } from "@/types/easypv";
import { parseLineItems } from "@/data/quotes-mappers";

/** The quote's Easy PV link + cached summary (columns from supabase/migrations/0045_easypv_link.sql). Uses the user's own session, so RLS applies. */
export async function getEasyPvLink(quoteId: string): Promise<EasyPvLink> {
  const configured = isEasyPvConfigured();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("easypv_project_id, easypv_summary, easypv_synced_at, easypv_proposal_skip_pages, easypv_markup_pct")
    .eq("id", quoteId)
    .maybeSingle();
  if (error) console.error("getEasyPvLink failed", error);
  if (!data?.easypv_project_id) return { configured, files: [] };
  const summary = (data.easypv_summary as EasyPvSummary | null) ?? undefined;
  return {
    configured,
    projectId: Number(data.easypv_project_id),
    summary,
    tally: summary?.cart?.length ? await computeTally(quoteId, summary, data.easypv_markup_pct) : undefined,
    syncedAt: data.easypv_synced_at ?? undefined,
    proposalSkipPages: data.easypv_proposal_skip_pages ?? undefined,
    // The page has already authorised this caller for the quote.
    files: await getEasyPvFiles(quoteId),
  };
}

/** Sums quantity and value by item name across the quote's arrays, equipment and "extra" lines. */
async function computeTally(quoteId: string, summary: EasyPvSummary, markupRaw: unknown): Promise<EasyPvTally> {
  const supabase = await createClient();
  const [arrays, equipment, extras] = await Promise.all([
    supabase.from("solar_arrays").select("items").eq("quote_id", quoteId),
    supabase.from("solar_equipment").select("items").eq("quote_id", quoteId),
    supabase.from("quote_line_items").select("name, quantity, unit_price").eq("quote_id", quoteId).eq("section", "extra"),
  ]);

  const onQuote = new Map<string, { qty: number; value: number }>();
  const add = (name: string, qty: number, unitPrice: number) => {
    const current = onQuote.get(name) ?? { qty: 0, value: 0 };
    onQuote.set(name, { qty: current.qty + qty, value: current.value + qty * unitPrice });
  };
  for (const row of [...(arrays.data ?? []), ...(equipment.data ?? [])]) {
    for (const item of parseLineItems(row.items)) add(item.name, item.quantity, item.unitPrice);
  }
  for (const row of extras.data ?? []) add(String(row.name ?? ""), Number(row.quantity), Number(row.unit_price));

  const cart = summary.cart ?? [];
  const differences = cart
    .map((line) => ({ name: line.name, easyPvQty: line.qty, quoteQty: onQuote.get(line.name)?.qty ?? 0 }))
    .filter((line) => line.easyPvQty !== line.quoteQty);

  const easyPvCost = Math.round(cart.reduce((sum, line) => sum + line.qty * line.unitCost, 0) * 100) / 100;
  const markupPct = typeof markupRaw === "number" ? markupRaw : markupRaw != null ? Number(markupRaw) : undefined;
  const quoteSell = Math.round(cart.reduce((sum, line) => sum + (onQuote.get(line.name)?.value ?? 0), 0) * 100) / 100;
  return {
    differences,
    easyPvCost,
    markupPct: Number.isFinite(markupPct) ? markupPct : undefined,
    expectedSell: Number.isFinite(markupPct) ? Math.round(easyPvCost * (1 + (markupPct as number) / 100) * 100) / 100 : undefined,
    quoteSell,
  };
}
