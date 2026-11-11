/**
 * Parses "9", "9-11" or "9-11, 14" (1-based page numbers) into a sorted,
 * de-duplicated list. Anything that isn't a positive whole number or a
 * forward range is ignored, and ranges are capped so a typo can't allocate
 * a huge list. Pure — shared by the card (to validate) and the PDF code.
 */
export function parseSkipPages(text: string | null | undefined): number[] {
  const pages = new Set<number>();
  for (const part of (text ?? "").split(",")) {
    const match = part.trim().match(/^(\d{1,4})(?:\s*-\s*(\d{1,4}))?$/);
    if (!match) continue;
    const from = Number(match[1]);
    const to = match[2] ? Number(match[2]) : from;
    if (from < 1 || to < from || to - from > 200) continue;
    for (let page = from; page <= to; page += 1) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}
