import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDate } from "@/lib/format";
import type { WaiverSnapshot } from "@/lib/esignature/waiver-document";

/**
 * The fixed Cooling-Off Waiver template — unmodified terms page, bundled
 * with the app (not user-uploaded, so plain filesystem storage rather than
 * Supabase Storage — same reasoning as `agreement-pdf.tsx`).
 *
 * Unlike the Boiler Installation Agreement (which fills in blanks on the
 * template's own signature page at hand-measured coordinates), this drops
 * the template's second page entirely and draws a fresh "Details and
 * Signatures" page instead — the template only has two pages (T&Cs, then a
 * details/signature page with more fields than the agreement has: customer
 * name, installation address, reference, contract date, agreed install
 * date, on top of the usual signature blocks), and there's no unmodified
 * terms content on that second page worth preserving verbatim. This is
 * simpler and more robust than coordinate-matching a page that isn't fixed
 * legal text.
 */
const TEMPLATE_PATH = path.join(process.cwd(), "assets", "agreement-templates", "cooling-off-waiver.pdf");
const TERMS_PAGE_INDEX = 0; // the one page of actual T&Cs text worth keeping verbatim.

async function loadTemplateBytes(): Promise<Buffer> {
  return readFile(TEMPLATE_PATH);
}

export interface WaiverCustomerAudit {
  typedName: string;
  signatureImage: Buffer | Uint8Array;
  signedAtLabel: string;
  ip: string;
  userAgent: string;
  documentHash: string;
}

export interface WaiverRepSignature {
  name: string;
  image: Buffer | Uint8Array;
  signedAtLabel: string;
}

const MARGIN_X = 55;
const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.58, 0.64, 0.72);
const LABEL = rgb(0.2, 0.25, 0.33);

/** Crude character-count wrap — good enough for a small monospace-ish audit footer, not real typesetting (same approach as agreement-pdf.tsx). */
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

class PageWriter {
  private y: number;
  constructor(
    private page: PDFPage,
    private font: PDFFont,
    private bold: PDFFont,
    topY: number,
  ) {
    this.y = topY;
  }

  heading(text: string) {
    this.page.drawText(text, { x: MARGIN_X, y: this.y, size: 13, font: this.bold, color: INK });
    this.y -= 22;
  }

  /** A label/value pair, one below the other — mirrors the template's own "Customer name" style fields. */
  field(label: string, value: string) {
    this.page.drawText(label, { x: MARGIN_X, y: this.y, size: 9, font: this.bold, color: LABEL });
    this.y -= 14;
    this.page.drawText(value || "—", { x: MARGIN_X, y: this.y, size: 11, font: this.font, color: INK });
    this.y -= 22;
  }

  gap(amount: number) {
    this.y -= amount;
  }

  currentY(): number {
    return this.y;
  }

  setY(y: number) {
    this.y = y;
  }
}

/**
 * Renders page 1 (T&Cs, verbatim from the template) followed by a freshly
 * drawn "Details and Signatures" page — see the module doc comment for why
 * this doesn't reuse the template's own second page.
 */
export async function buildSignedWaiverPdf(
  snapshot: WaiverSnapshot,
  customer: WaiverCustomerAudit,
  rep: WaiverRepSignature | null,
): Promise<Buffer> {
  const templateBytes = await loadTemplateBytes();
  const templateDoc = await PDFDocument.load(templateBytes);

  const pdfDoc = await PDFDocument.create();
  const [termsPage] = await pdfDoc.copyPages(templateDoc, [TERMS_PAGE_INDEX]);
  pdfDoc.addPage(termsPage);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const { width, height } = termsPage.getSize();
  const page = pdfDoc.addPage([width, height]);
  const w = new PageWriter(page, font, bold, height - 60);

  w.heading("Details and Signatures");
  w.field("Customer name", snapshot.customerName);
  w.field("Installation address", snapshot.installationAddress);
  w.field("Contract / quote reference", snapshot.reference);
  w.field("Contract date", snapshot.contractDateLabel);
  w.field("Agreed installation date", snapshot.agreedInstallDate ? formatDate(snapshot.agreedInstallDate) : "—");

  w.gap(10);
  const todayLabel = customer.signedAtLabel.split(" at ")[0] ?? customer.signedAtLabel;

  // Customer signature block.
  page.drawText("Customer signature", { x: MARGIN_X, y: w.currentY(), size: 9, font: bold, color: LABEL });
  w.gap(14);
  const signatureImage = await pdfDoc.embedPng(customer.signatureImage);
  const maxSigWidth = 220;
  const maxSigHeight = 60;
  const sigScale = Math.min(maxSigWidth / signatureImage.width, maxSigHeight / signatureImage.height, 1);
  page.drawImage(signatureImage, {
    x: MARGIN_X,
    y: w.currentY() - signatureImage.height * sigScale + 12,
    width: signatureImage.width * sigScale,
    height: signatureImage.height * sigScale,
  });
  w.gap(maxSigHeight);
  page.drawText(`${customer.typedName} — ${todayLabel}`, { x: MARGIN_X, y: w.currentY(), size: 10, font, color: INK });
  w.gap(30);

  // Rep ("Signed on behalf of MarGav Heating") block — same graceful
  // fallback as agreement-pdf.tsx when the rep has no saved signature.
  page.drawText("Signed on behalf of MarGav Heating", {
    x: MARGIN_X,
    y: w.currentY(),
    size: 9,
    font: bold,
    color: LABEL,
  });
  w.gap(14);
  if (rep) {
    const repImage = await pdfDoc.embedPng(rep.image);
    const repScale = Math.min(maxSigWidth / repImage.width, maxSigHeight / repImage.height, 1);
    page.drawImage(repImage, {
      x: MARGIN_X,
      y: w.currentY() - repImage.height * repScale + 12,
      width: repImage.width * repScale,
      height: repImage.height * repScale,
    });
    w.gap(maxSigHeight);
    const repDateLabel = rep.signedAtLabel.split(" at ")[0] ?? rep.signedAtLabel;
    page.drawText(`${rep.name} — ${repDateLabel}`, { x: MARGIN_X, y: w.currentY(), size: 10, font, color: INK });
    w.gap(30);
  } else {
    page.drawText("No representative signature on file", {
      x: MARGIN_X,
      y: w.currentY(),
      size: 9,
      font: italicFont,
      color: MUTED,
    });
    w.gap(30);
  }

  // Audit footer, pinned near the bottom of the page.
  w.setY(90);
  const auditLines = [
    `Quote ${snapshot.reference} — signed ${customer.signedAtLabel}`,
    ...wrapText(`IP address: ${customer.ip}`, 100),
    ...wrapText(`Browser: ${customer.userAgent}`, 100),
    ...wrapText(`Document hash (SHA-256): ${customer.documentHash}`, 100),
  ];
  for (const line of auditLines) {
    page.drawText(line, { x: MARGIN_X, y: w.currentY(), size: 7, font, color: MUTED });
    w.gap(10);
  }

  return Buffer.from(await pdfDoc.save());
}
