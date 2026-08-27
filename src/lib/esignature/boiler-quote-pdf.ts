import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { formatCurrency } from "@/lib/format";
import type { DocumentSnapshot } from "@/lib/esignature/document";

/**
 * Fills the business-supplied "Sales Proposal & Installation Agreement"
 * template (assets/quote-templates/boiler-quote.pdf) with a specific
 * quote's data — same template-fill technique as
 * src/lib/esignature/agreement-pdf.tsx (locate the template's own blanks,
 * draw over them with pdf-lib), not the from-scratch @react-pdf/renderer
 * approach in pdf.tsx.
 *
 * ⚠️ Deliberately incomplete — the cover page (1), page 4's item table +
 * pricing summary, and the customer signature block on both page 5 ("Order
 * acceptance") and page 9 ("Acknowledgements") are filled. Page 8's
 * signature block is tied to its own "start work early" consent checkbox
 * that the current one-signature `/sign/[token]` flow has no equivalent
 * capture for, so that page is left exactly as the blank template has it
 * — same reasoning, just not extended to page 8 the way it was to page 9.
 * Page 9's own six acknowledgement checkboxes (customer details checked,
 * survey caveat, etc.) are similarly left unticked — only the signature
 * block itself is filled.
 *
 * Used for every boiler quote's PDF — unsigned download
 * (src/app/api/quotes/[id]/pdf/route.ts, src/app/sign/[token]/pdf/route.ts)
 * and the final signed document (src/data/signature-service.ts). Solar
 * quotes are unaffected — they still render through pdf.tsx, which has no
 * business-supplied template of its own.
 */
const TEMPLATE_PATH = path.join(process.cwd(), "assets", "quote-templates", "boiler-quote.pdf");

async function loadTemplateBytes(): Promise<Buffer> {
  return readFile(TEMPLATE_PATH);
}

const NAVY = rgb(29 / 255, 42 / 255, 68 / 255);
const TOTAL_ROW_GREEN = rgb(238 / 255, 248 / 255, 241 / 255);
const WHITE = rgb(1, 1, 1);

const COVER_PAGE_INDEX = 0; // page 1
const PRICING_PAGE_INDEX = 3; // page 4
const ORDER_ACCEPTANCE_PAGE_INDEX = 4; // page 5
const ACKNOWLEDGEMENTS_PAGE_INDEX = 8; // page 9

/**
 * Cover page's six "Prepared for" / "Installation address" / ... value
 * cells — each a fixed-position table cell (x188–535) the template's own
 * "[CUSTOMER NAME]"-style bracket text sits inside, extracted once via
 * pdfjs-dist's text-content + operator-list output (see the note on
 * `SIGNATURE_PAGE_INDEX` in agreement-pdf.tsx for why this is hardcoded
 * rather than re-extracted per request — the template is fixed).
 */
const COVER_FIELDS = {
  customerName: { cellY: 578, cellHeight: 24, baselineY: 591.6 },
  propertyAddress: { cellY: 544, cellHeight: 24, baselineY: 557.28 },
  salesAdviser: { cellY: 509, cellHeight: 24, baselineY: 522.96 },
  reference: { cellY: 475, cellHeight: 24, baselineY: 488.64 },
  dateCreated: { cellY: 441, cellHeight: 24, baselineY: 454.32 },
  offerValidUntil: { cellY: 406, cellHeight: 24, baselineY: 420.0 },
} as const;
const COVER_VALUE_X1 = 188;
const COVER_VALUE_WIDTH = 347; // x188–535
const COVER_TEXT_X = 195.6; // matches the template's own placeholder start x

/**
 * Page 4's item table + pricing summary — fully regenerated per quote
 * rather than filling the template's fixed 8-row layout. The template
 * assumes the boiler unit/removal/install are bundled at "Included" with
 * only 4 blank rows left for extras; this app prices the boiler+install
 * package as a real line item (`snapshot.lineItems[0]`, from
 * `itemizedLineItems()` in document.ts) and a quote can carry any number
 * of extras/standard-additionals/free-text items on top of it — not a
 * fixed 4. So instead of trying to fit real data into the template's fixed
 * cells, the whole block (header bar, item rows, and the summary below
 * them) gets erased and redrawn to fit however many line items there
 * actually are, with the summary shifted down to sit directly under the
 * last item row.
 *
 * Column x-bounds and the styling (navy header bar, zebra row shading, the
 * pale-green "Total" row highlight) are lifted from the template's
 * own values — extracted via pdfjs-dist's operator list, not guessed —
 * so the regenerated block still looks like the rest of the document.
 */
const TABLE_X1 = 67;
const TABLE_X2 = 529;
const TABLE_COLUMNS = {
  description: { x1: 67, x2: 322 },
  qty: { x1: 322, x2: 369 },
  unitPrice: { x1: 369, x2: 445 },
  total: { x1: 445, x2: 529 },
} as const;
const HEADER_BOTTOM_Y = 674;
const HEADER_HEIGHT = 21;
const FIRST_ITEM_ROW_TOP = 663; // template's own first item row top edge
const ROW_HEIGHT = 21;
const ROW_PITCH = 31; // vertical distance between one row's bottom edge and the next's
const SECTION_GAP = 35; // gap between the last item row and the summary block, matching the template's own
const SUMMARY_ROW_HEIGHT = 22;
const SUMMARY_LABEL_X1 = 296;
const SUMMARY_LABEL_X2 = 426;
const SUMMARY_VALUE_X1 = 426;
const SUMMARY_VALUE_X2 = 524;
const CELL_TEXT_PAD = 6;
/** Row rendering is straightforward vertical stacking with no page-break
 *  logic — past this many rows the table would run into the footer/monthly
 *  plan block below it. Rather than silently overflowing the page (or
 *  crashing), the last visible row becomes an aggregated "+N more items"
 *  line so the totals below still add up; see the `console.warn` where
 *  this is applied. Sized so the monthly plan block (see
 *  `MONTHLY_PLAN_*` below) always has room even at the cap — 12 would fit
 *  the summary alone, but not that block on top of it too. */
const MAX_ITEM_ROWS = 9;

/**
 * "Monthly Plan" — the single term actually selected on the Payment Method
 * card, same as `QuoteDocumentPreview` shows on-screen (`snapshot.monthlyPlans`,
 * computed in document.ts; empty when the quote isn't on a Monthly Plan at
 * all). The business template has no section for this at all; drawn
 * directly below the pricing summary, wherever that ends up given however
 * many item rows there were — see `MAX_ITEM_ROWS`'s comment for why that's
 * capped low enough to always leave room for this block above the page's
 * floor.
 */
const MONTHLY_PLAN_GAP_ABOVE = 20;
const MONTHLY_PLAN_HEADER_HEIGHT = 14;
const MONTHLY_PLAN_BOX_HEIGHT = 36;
const MONTHLY_PLAN_BOX_GAP = 10;
const MONTHLY_PLAN_BOX_BG = rgb(248 / 255, 250 / 255, 252 / 255);
const MONTHLY_PLAN_LABEL_COLOR = rgb(100 / 255, 116 / 255, 139 / 255);
const MONTHLY_PLAN_DISCLAIMER_COLOR = rgb(0.58, 0.64, 0.72);

/** Alternating white/zebra-gray row backgrounds, header navy, and the
 *  pricing summary's pale-green "Total" row highlight — all sampled
 *  from the template's own fill colors, not chosen freehand. */
const ZEBRA_GRAY = rgb(226 / 255, 232 / 255, 240 / 255);

/**
 * "Order acceptance" signature block, page 5 — two fields side by side
 * (Customer name | Customer signature) then two more below (Date |
 * Contract reference). No whiteout needed here, unlike the cover/pricing
 * fields above — the template leaves these genuinely blank, it doesn't
 * pre-fill them with bracket placeholders.
 *
 * Each field is a bordered box with its own caption ("Customer name", ...)
 * printed just above the box's bottom line; the value is drawn in the
 * clear space above that caption, same "value floats above its label"
 * convention as a Material-style filled input.
 */
const ORDER_ACCEPTANCE_FIELDS = {
  customerName: { x1: 74, x2: 298, lineY: 598, captionBaselineY: 611.04 },
  customerSignature: { x1: 297, x2: 521, lineY: 598, captionBaselineY: 611.04 },
  date: { x1: 74, x2: 298, lineY: 546, captionBaselineY: 559.2 },
  reference: { x1: 297, x2: 521, lineY: 546, captionBaselineY: 559.2 },
} as const;
/** Both rows of the "Order acceptance" grid are the same height. */
const ORDER_ACCEPTANCE_BOX_HEIGHT = 41;

/**
 * "Acknowledgements" signature block, page 9 — identical field layout to
 * `ORDER_ACCEPTANCE_FIELDS` (same box size/columns, just lower on the page
 * to sit below that page's own six acknowledgement checkboxes), confirmed
 * against the template's own coordinates rather than assumed. Reuses every
 * `ORDER_ACCEPTANCE_*` drawing helper below — only the field positions
 * differ.
 */
const ACKNOWLEDGEMENTS_FIELDS = {
  customerName: { x1: 74, x2: 298, lineY: 451, captionBaselineY: 463.92 },
  customerSignature: { x1: 297, x2: 521, lineY: 451, captionBaselineY: 463.92 },
  date: { x1: 74, x2: 298, lineY: 399, captionBaselineY: 412.08 },
  reference: { x1: 297, x2: 521, lineY: 399, captionBaselineY: 412.08 },
} as const;

export interface OrderAcceptanceSignature {
  typedName: string;
  signatureImage: Buffer | Uint8Array;
  signedAtLabel: string;
  ip: string;
  userAgent: string;
  documentHash: string;
}

/** Crude character-count wrap — good enough for a small monospace-ish audit
 *  footer, not real typesetting. Same helper as agreement-pdf.tsx. */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Both signature pages have plenty of blank space below their two field
 *  rows — same audit trail (IP/browser/document hash) `agreement-pdf.tsx`
 *  prints in its own page's leftover space. `startY` is measured from each
 *  page's own field layout (46pt below the "Date" row's line) rather than
 *  hardcoded, since page 9's rows sit lower on the page than page 5's. */
function drawAuditFooter(page: PDFPage, font: PDFFont, reference: string, audit: OrderAcceptanceSignature, startY: number) {
  const lines = [
    `Quote ${reference} — signed ${audit.signedAtLabel}`,
    ...wrapText(`IP address: ${audit.ip}`, 100),
    ...wrapText(`Browser: ${audit.userAgent}`, 100),
    ...wrapText(`Document hash (SHA-256): ${audit.documentHash}`, 100),
  ];
  let y = startY;
  for (const line of lines) {
    page.drawText(line, { x: 78, y, size: 7, font, color: rgb(0.58, 0.64, 0.72) });
    y -= 10;
  }
}

/** 46pt below a field layout's "Date" row line — where `drawAuditFooter`
 *  starts on both signature pages. */
function auditFooterStartY(fields: { date: { lineY: number } }): number {
  return fields.date.lineY - 46;
}

/** Right-edge-anchored x for `text` at `size` — used throughout the
 *  regenerated pricing table for the numeric columns, which read better
 *  right-aligned than left-aligned. */
function rightAlignedX(font: PDFFont, text: string, size: number, rightEdge: number): number {
  return rightEdge - font.widthOfTextAtSize(text, size);
}

/** Word-wraps `text` to `maxWidth` using the font's actual glyph widths
 *  (unlike `wrapText`'s char-count guess, good enough for the small audit
 *  footer but not for a cell a customer actually reads) — the property
 *  address is the one cover-page field long enough to routinely need this. */
function wrapTextToWidth(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** `wrapTextToWidth`, capped at `maxLines` — anything past that is folded
 *  into the last line with a trailing "…" rather than silently dropped or
 *  left to overflow into the next cell. */
function wrapTextToLines(font: PDFFont, text: string, size: number, maxWidth: number, maxLines: number): string[] {
  const wrapped = wrapTextToWidth(font, text, size, maxWidth);
  if (wrapped.length <= maxLines) return wrapped;

  const visible = wrapped.slice(0, maxLines);
  let lastLine = visible[maxLines - 1];
  while (lastLine.length > 0 && font.widthOfTextAtSize(`${lastLine}…`, size) > maxWidth) {
    lastLine = lastLine.slice(0, -1);
  }
  visible[maxLines - 1] = `${lastLine.trimEnd()}…`;
  return visible;
}

const COVER_CELL_LINE_HEIGHT = 11;
const COVER_CELL_MAX_LINES = 2;
const COVER_CELL_RIGHT_PAD = 8;

/** Draws over a cover-page cell that already has its own placeholder
 *  bracket text — whites out the whole cell, then draws the real value on
 *  top, left-aligned at the same x the template's own placeholder used.
 *  Wraps to up to `COVER_CELL_MAX_LINES` lines rather than running the
 *  text off the edge of the cell — anchored so a single-line value lands
 *  at very nearly the same baseline the template's own placeholder used. */
function fillCoverCell(
  page: PDFPage,
  font: PDFFont,
  text: string,
  options: { cellY: number; cellHeight: number; baselineY: number },
) {
  page.drawRectangle({ x: COVER_VALUE_X1, y: options.cellY, width: COVER_VALUE_WIDTH, height: options.cellHeight, color: WHITE });

  const size = 10;
  const maxWidth = COVER_VALUE_X1 + COVER_VALUE_WIDTH - COVER_TEXT_X - COVER_CELL_RIGHT_PAD;
  const lines = wrapTextToLines(font, text, size, maxWidth, COVER_CELL_MAX_LINES);
  // Single line keeps the field's original baseline; a second line is
  // added below it rather than re-centering the block, so it never
  // creeps up into the row above.
  const firstLineBaseline = options.baselineY + ((lines.length - 1) * COVER_CELL_LINE_HEIGHT) / 2;
  lines.forEach((line, index) => {
    page.drawText(line, { x: COVER_TEXT_X, y: firstLineBaseline - index * COVER_CELL_LINE_HEIGHT, size, font, color: NAVY });
  });
}

function drawAcceptanceText(page: PDFPage, font: PDFFont, text: string, layout: { x1: number; captionBaselineY: number }) {
  page.drawText(text, { x: layout.x1 + 4, y: layout.captionBaselineY + 12, size: 10, font, color: rgb(0.06, 0.09, 0.16) });
}

/**
 * Draws in the clear space ABOVE the field's caption — same band the typed
 * text in `drawAcceptanceText` uses (caption baseline + a few pt, up to
 * just under the box's top edge), not down near the bottom line where the
 * caption itself already sits. Getting this backwards draws the signature
 * on top of the caption instead of above it — verified by extracting the
 * generated PDF's own text/image placement, not by eye (this template's
 * fields are too tightly packed to safely eyeball).
 */
function drawAcceptanceSignature(page: PDFPage, image: PDFImage, layout: { x1: number; x2: number; lineY: number; captionBaselineY: number }) {
  const boxTop = layout.lineY + ORDER_ACCEPTANCE_BOX_HEIGHT;
  const bandBottom = layout.captionBaselineY + 8;
  const bandTop = boxTop - 4;
  const maxWidth = layout.x2 - layout.x1 - 8;
  const maxHeight = bandTop - bandBottom;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  page.drawImage(image, {
    x: layout.x1 + 4,
    y: bandBottom,
    width: image.width * scale,
    height: image.height * scale,
  });
}

const STRIKETHROUGH_GRAY = rgb(148 / 255, 163 / 255, 184 / 255);

/** Draws `text` then a horizontal line through its middle — pdf-lib has no
 *  text-decoration primitive, so this measures the glyph run itself and
 *  lays the line under it by hand. */
function drawStrikethroughText(page: PDFPage, font: PDFFont, text: string, x: number, y: number, size: number, color: ReturnType<typeof rgb>) {
  page.drawText(text, { x, y, size, font, color });
  const width = font.widthOfTextAtSize(text, size);
  page.drawLine({ start: { x, y: y + size * 0.32 }, end: { x: x + width, y: y + size * 0.32 }, thickness: 0.6, color });
}

/**
 * Right-aligned "£139.88 £0.00" pair, `original` struck through, for a line
 * item that's included at no charge but has a real worth (see
 * `originalUnitPriceLabel` in document.ts) — replaces the plain amount cell
 * for just that row's Total column.
 */
function drawIncludedAmount(page: PDFPage, font: PDFFont, original: string, amount: string, rightEdge: number, y: number) {
  const gap = 5;
  const amountSize = 9.5;
  const originalSize = 8;
  const amountX = rightAlignedX(font, amount, amountSize, rightEdge);
  const originalX = amountX - gap - font.widthOfTextAtSize(original, originalSize);
  drawStrikethroughText(page, font, original, originalX, y + 0.75, originalSize, STRIKETHROUGH_GRAY);
  page.drawText(amount, { x: amountX, y, size: amountSize, font, color: NAVY });
}

function drawRow(
  page: PDFPage,
  font: PDFFont,
  options: { y: number; height: number; background?: ReturnType<typeof rgb> },
  cells: { text: string; x1: number; x2: number; align: "left" | "right"; color: ReturnType<typeof rgb>; size?: number }[],
) {
  if (options.background) {
    page.drawRectangle({ x: TABLE_X1, y: options.y, width: TABLE_X2 - TABLE_X1, height: options.height, color: options.background });
  }
  const baselineY = options.y + options.height / 2 - 3.5; // vertically centered-ish within the row
  for (const cell of cells) {
    const size = cell.size ?? 9.5;
    const x = cell.align === "right" ? rightAlignedX(font, cell.text, size, cell.x2 - CELL_TEXT_PAD) : cell.x1 + CELL_TEXT_PAD;
    page.drawText(cell.text, { x, y: baselineY, size, font, color: cell.color });
  }
}

/**
 * Draws below the pricing summary, starting `topY` (the deposit row's own
 * bottom edge) minus a gap — one box for the selected term plus the same
 * APR disclaimer `QuoteDocumentPreview` shows. No-ops if the snapshot has
 * no plan at all (quote isn't on a Monthly Plan, or a locked snapshot from
 * before this field existed).
 */
function drawMonthlyPlanSection(page: PDFPage, font: PDFFont, plans: DocumentSnapshot["monthlyPlans"], topY: number) {
  if (!plans || plans.length === 0) return;

  const sectionTop = topY - MONTHLY_PLAN_GAP_ABOVE;
  page.drawText("Monthly Plan", { x: TABLE_X1, y: sectionTop - 9, size: 9, font, color: NAVY });

  const boxesTop = sectionTop - MONTHLY_PLAN_HEADER_HEIGHT;
  const boxesBottom = boxesTop - MONTHLY_PLAN_BOX_HEIGHT;
  // Box width holds steady at the old 3-column width even when there's
  // only the one selected term to show, rather than stretching a single
  // box across the full table width.
  const boxWidth =
    plans.length === 1
      ? (TABLE_X2 - TABLE_X1 - 2 * MONTHLY_PLAN_BOX_GAP) / 3
      : (TABLE_X2 - TABLE_X1 - (plans.length - 1) * MONTHLY_PLAN_BOX_GAP) / plans.length;

  plans.forEach((plan, index) => {
    const x = TABLE_X1 + index * (boxWidth + MONTHLY_PLAN_BOX_GAP);
    page.drawRectangle({ x, y: boxesBottom, width: boxWidth, height: MONTHLY_PLAN_BOX_HEIGHT, color: MONTHLY_PLAN_BOX_BG });

    const yearsLabel = `${plan.years} ${plan.years === 1 ? "year" : "years"}`;
    page.drawText(yearsLabel, {
      x: x + boxWidth / 2 - font.widthOfTextAtSize(yearsLabel, 8) / 2,
      y: boxesBottom + MONTHLY_PLAN_BOX_HEIGHT - 13,
      size: 8,
      font,
      color: MONTHLY_PLAN_LABEL_COLOR,
    });
    page.drawText(plan.monthlyLabel, {
      x: x + boxWidth / 2 - font.widthOfTextAtSize(plan.monthlyLabel, 10) / 2,
      y: boxesBottom + 9,
      size: 10,
      font,
      color: NAVY,
    });
  });

  page.drawText("Representative example — 0% APR over 1 year, 9.9% APR on longer terms.", {
    x: TABLE_X1,
    y: boxesBottom - 14,
    size: 7,
    font,
    color: MONTHLY_PLAN_DISCLAIMER_COLOR,
  });
}

/**
 * Erases the template's own fixed item table + pricing summary and
 * redraws both from `snapshot.lineItems`/totals — see the block comment
 * above `TABLE_X1` for why. `lineItems` predates `quantity`/`unitPriceLabel`
 * on some locked snapshots, hence the fallbacks below.
 */
function drawPricingPage(page: PDFPage, font: PDFFont, snapshot: DocumentSnapshot) {
  // Erase the template's own header/rows/summary art entirely — wide
  // enough to cover the highlighted total row's green background too.
  page.drawRectangle({ x: 60, y: 85, width: 475, height: 615, color: WHITE });

  let items = snapshot.lineItems;
  if (items.length > MAX_ITEM_ROWS) {
    const visible = items.slice(0, MAX_ITEM_ROWS - 1);
    const overflow = items.slice(MAX_ITEM_ROWS - 1);
    const overflowAmount = overflow.reduce((sum, item) => sum + (item.amount ?? 0), 0);
    console.warn(
      `drawPricingPage: quote ${snapshot.reference} has ${items.length} line items, more than fit on the template's page 4 — aggregating the last ${overflow.length} into one row.`,
    );
    items = [
      ...visible,
      { name: `+${overflow.length} more item${overflow.length === 1 ? "" : "s"} — see quote detail`, amountLabel: formatCurrency(overflowAmount), amount: overflowAmount },
    ];
  }

  // Header bar.
  drawRow(
    page,
    font,
    { y: HEADER_BOTTOM_Y, height: HEADER_HEIGHT, background: NAVY },
    [
      { text: "Description", x1: TABLE_COLUMNS.description.x1, x2: TABLE_COLUMNS.description.x2, align: "left", color: WHITE, size: 9 },
      { text: "Qty", x1: TABLE_COLUMNS.qty.x1, x2: TABLE_COLUMNS.qty.x2, align: "right", color: WHITE, size: 9 },
      { text: "Unit price", x1: TABLE_COLUMNS.unitPrice.x1, x2: TABLE_COLUMNS.unitPrice.x2, align: "right", color: WHITE, size: 9 },
      { text: "Total", x1: TABLE_COLUMNS.total.x1, x2: TABLE_COLUMNS.total.x2, align: "right", color: WHITE, size: 9 },
    ],
  );

  // Item rows.
  const firstRowY = FIRST_ITEM_ROW_TOP - ROW_HEIGHT;
  items.forEach((item, index) => {
    const y = firstRowY - index * ROW_PITCH;
    drawRow(
      page,
      font,
      { y, height: ROW_HEIGHT, background: index % 2 === 1 ? ZEBRA_GRAY : undefined },
      [
        { text: item.name, x1: TABLE_COLUMNS.description.x1, x2: TABLE_COLUMNS.description.x2, align: "left", color: NAVY },
        { text: String(item.quantity ?? 1), x1: TABLE_COLUMNS.qty.x1, x2: TABLE_COLUMNS.qty.x2, align: "right", color: NAVY },
        { text: item.unitPriceLabel ?? item.amountLabel, x1: TABLE_COLUMNS.unitPrice.x1, x2: TABLE_COLUMNS.unitPrice.x2, align: "right", color: NAVY },
      ],
    );

    // Included-at-no-charge items (Gateway/Fernox/Flue — see
    // `originalUnitPriceLabel` in document.ts) get their real worth struck
    // through next to the £0.00 they're actually charged, instead of the
    // plain amount cell every other row gets.
    const baselineY = y + ROW_HEIGHT / 2 - 3.5;
    if (item.originalUnitPriceLabel) {
      drawIncludedAmount(page, font, item.originalUnitPriceLabel, item.amountLabel, TABLE_COLUMNS.total.x2 - CELL_TEXT_PAD, baselineY);
    } else {
      page.drawText(item.amountLabel, {
        x: rightAlignedX(font, item.amountLabel, 9.5, TABLE_COLUMNS.total.x2 - CELL_TEXT_PAD),
        y: baselineY,
        size: 9.5,
        font,
        color: NAVY,
      });
    }
  });

  // Pricing summary, shifted to sit directly under however many item rows
  // there were.
  const lastItemRowY = firstRowY - (items.length - 1) * ROW_PITCH;
  const summaryFields = [
    { label: "Subtotal", value: snapshot.subtotalLabel ?? snapshot.totalPriceLabel, highlight: false },
    { label: "Discount", value: snapshot.discountLabel ? `-${snapshot.discountLabel}` : "£0.00", highlight: false },
    { label: "Total", value: snapshot.totalPriceLabel, highlight: true },
    { label: "Deposit", value: snapshot.depositLabel ?? "£0.00", highlight: false },
  ];
  const summaryFirstRowTop = lastItemRowY - SECTION_GAP;
  summaryFields.forEach((field, index) => {
    const y = summaryFirstRowTop - SUMMARY_ROW_HEIGHT - index * ROW_PITCH;
    drawRow(
      page,
      font,
      { y, height: SUMMARY_ROW_HEIGHT, background: field.highlight ? TOTAL_ROW_GREEN : undefined },
      [
        { text: field.label, x1: SUMMARY_LABEL_X1, x2: SUMMARY_LABEL_X2, align: "left", color: NAVY, size: 10 },
        { text: field.value, x1: SUMMARY_VALUE_X1, x2: SUMMARY_VALUE_X2, align: "right", color: NAVY, size: 10 },
      ],
    );
  });

  const depositRowY = summaryFirstRowTop - SUMMARY_ROW_HEIGHT - (summaryFields.length - 1) * ROW_PITCH;
  drawMonthlyPlanSection(page, font, snapshot.monthlyPlans, depositRowY);
}

/** Shape shared by `ORDER_ACCEPTANCE_FIELDS` and `ACKNOWLEDGEMENTS_FIELDS`
 *  — same 4 fields, different pages just put them at different y's. */
interface SignatureFieldLayout {
  customerName: { x1: number; x2: number; lineY: number; captionBaselineY: number };
  customerSignature: { x1: number; x2: number; lineY: number; captionBaselineY: number };
  date: { x1: number; x2: number; lineY: number; captionBaselineY: number };
  reference: { x1: number; x2: number; lineY: number; captionBaselineY: number };
}

/**
 * Fills one signature page's "Customer name / Customer signature / Date /
 * Contract reference" block plus its audit footer — shared by page 5
 * ("Order acceptance") and page 9 ("Acknowledgements"), which use the
 * identical field layout at different y-positions (see
 * `ACKNOWLEDGEMENTS_FIELDS`'s comment).
 */
function fillSignatureBlock(
  page: PDFPage,
  font: PDFFont,
  fields: SignatureFieldLayout,
  signatureImage: PDFImage,
  reference: string,
  signature: OrderAcceptanceSignature,
) {
  const dateLabel = signature.signedAtLabel.split(" at ")[0] ?? signature.signedAtLabel;

  drawAcceptanceText(page, font, signature.typedName, fields.customerName);
  drawAcceptanceSignature(page, signatureImage, fields.customerSignature);
  drawAcceptanceText(page, font, dateLabel, fields.date);
  drawAcceptanceText(page, font, reference, fields.reference);
  drawAuditFooter(page, font, reference, signature, auditFooterStartY(fields));
}

/**
 * Fills the cover page (customer/address/rep/reference/dates), page 4's
 * item table + pricing summary, from a locked `DocumentSnapshot` — safe to
 * call for both the pre-signing "Download PDF" render and the final signed
 * document, since neither of those depends on the customer having signed
 * yet. Pass `signature` once they have, to also fill page 5's "Order
 * acceptance" block and page 9's "Acknowledgements" block (same signature,
 * both places the template asks for it); omit it to leave both pages
 * exactly as the blank template has them.
 */
export async function buildBoilerQuotePdf(snapshot: DocumentSnapshot, signature?: OrderAcceptanceSignature): Promise<Buffer> {
  const templateBytes = await loadTemplateBytes();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const coverPage = pdfDoc.getPage(COVER_PAGE_INDEX);
  const coverValues: Record<keyof typeof COVER_FIELDS, string> = {
    customerName: snapshot.customerName,
    propertyAddress: snapshot.customerAddressLines.join(", ") || "—",
    salesAdviser: snapshot.repName || "Unassigned",
    reference: snapshot.reference,
    dateCreated: snapshot.sentDateLabel,
    offerValidUntil: snapshot.offerValidUntilLabel ?? "—",
  };
  for (const [key, field] of Object.entries(COVER_FIELDS) as [keyof typeof COVER_FIELDS, (typeof COVER_FIELDS)[keyof typeof COVER_FIELDS]][]) {
    fillCoverCell(coverPage, font, coverValues[key], field);
  }

  const pricingPage = pdfDoc.getPage(PRICING_PAGE_INDEX);
  drawPricingPage(pricingPage, font, snapshot);

  if (signature) {
    const signatureImage = await pdfDoc.embedPng(signature.signatureImage);

    fillSignatureBlock(
      pdfDoc.getPage(ORDER_ACCEPTANCE_PAGE_INDEX),
      font,
      ORDER_ACCEPTANCE_FIELDS,
      signatureImage,
      snapshot.reference,
      signature,
    );
    fillSignatureBlock(
      pdfDoc.getPage(ACKNOWLEDGEMENTS_PAGE_INDEX),
      font,
      ACKNOWLEDGEMENTS_FIELDS,
      signatureImage,
      snapshot.reference,
      signature,
    );
  }

  return Buffer.from(await pdfDoc.save());
}
