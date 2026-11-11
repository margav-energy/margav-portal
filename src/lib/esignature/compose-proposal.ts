import "server-only";
import { PDFDocument, type PDFPage, rgb } from "pdf-lib";

/**
 * Easy PV prints "n of N" in the top-right corner of every page of its proposal. Once pages are replaced or
 * left out those numbers no longer add up, so each Easy PV page gets a white patch over that corner.
 * (Easy PV's PDFs draw in a flipped coordinate system — the number is at y = 11.7 from the *top* — and
 * nothing else sits in the top 26pt, so the patch is invisible.)
 */
function coverPageNumber(page: PDFPage): void {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: width - 80, y: height - 26, width: 80, height: 26, color: rgb(1, 1, 1), borderWidth: 0 });
}

/**
 * The quote the customer is sent for a solar job with an Easy PV proposal:
 * the Easy PV proposal's pages minus `skipPages` (1-based — normally its own
 * "Quote" page, which carries Easy PV's cost prices), with the portal's own
 * quote sheet (itemised prices, extras, discount and — once signed — the
 * signatures) placed exactly where the first skipped page was. With nothing
 * skipped, the quote sheet goes on the end. Everything else in the proposal is
 * sent as Easy PV made it.
 */
export async function composeProposalPdf(
  proposal: Buffer,
  quoteSheet: Buffer,
  skipPages: number[],
  coverPages = 0,
): Promise<Buffer> {
  const out = await PDFDocument.create();
  const source = await PDFDocument.load(proposal);
  const sheet = await PDFDocument.load(quoteSheet);

  const skip = new Set(skipPages);
  // Where the quote sheet goes: in place of the first skipped page that actually exists, else at the end.
  // With front pages (the portal's cover + proposal page) Easy PV's page 1 is what they replace, so that
  // page doesn't count here — the sheet belongs where Easy PV's Quote page was.
  const firstSkipped = source
    .getPageIndices()
    .find((index) => skip.has(index + 1) && !(coverPages > 0 && index === 0));
  let sheetInserted = false;
  // The portal's cover (the first `coverPages` pages of the quote PDF) opens the document, in place of
  // Easy PV's own cover — so add page 1 to the pages to leave out too. The rest is the quote sheet.
  const sheetIndices = sheet.getPageIndices();
  if (coverPages > 0) {
    for (const page of await out.copyPages(sheet, sheetIndices.slice(0, coverPages))) out.addPage(page);
  }
  const addSheet = async () => {
    for (const page of await out.copyPages(sheet, sheetIndices.slice(coverPages))) out.addPage(page);
    sheetInserted = true;
  };

  for (const index of source.getPageIndices()) {
    if (index === firstSkipped) await addSheet();
    if (skip.has(index + 1)) continue;
    const [page] = await out.copyPages(source, [index]);
    out.addPage(page);
    coverPageNumber(page);
  }
  if (!sheetInserted) await addSheet();

  return Buffer.from(await out.save());
}
