import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { AgreementSnapshot } from "@/lib/esignature/agreement-document";

/**
 * The fixed Boiler Installation Agreement template — unmodified terms
 * pages, bundled with the app (not user-uploaded, so plain filesystem
 * storage rather than Supabase Storage — see the migration this shipped
 * alongside for why).
 */
const TEMPLATE_PATH = path.join(process.cwd(), "assets", "agreement-templates", "boiler-installation-agreement.pdf");

async function loadTemplateBytes(): Promise<Buffer> {
  return readFile(TEMPLATE_PATH);
}

/**
 * Page 4's own "Representative"/"Customer" name/signature/date blanks,
 * each a thin filled rectangle in the template — extracted once via
 * pdfjs-dist's operator list (`page.getOperatorList()`, filtered to thin
 * horizontal rects around y 400–560) rather than guessed, so text/images
 * land exactly on the existing lines instead of floating nearby. The
 * template is fixed and never changes, so these are hardcoded rather than
 * re-extracted on every request.
 */
const SIGNATURE_PAGE_INDEX = 3; // page 4, 0-indexed
const FIELD_LAYOUT = {
  company: { nameLineY: 491.23, signatureLineY: 457.75, dateLineY: 424.39, x1: 61.6, x2: 282.3 },
  customer: { nameLineY: 490.03, signatureLineY: 456.67, dateLineY: 423.19, x1: 295.4, x2: 516.1 },
};

export interface AgreementCustomerAudit {
  typedName: string;
  signatureImage: Buffer | Uint8Array;
  signedAtLabel: string;
  ip: string;
  userAgent: string;
  documentHash: string;
}

export interface AgreementRepSignature {
  name: string;
  image: Buffer | Uint8Array;
  signedAtLabel: string;
}

function drawSignatureImage(
  page: PDFPage,
  image: PDFImage,
  layout: { x1: number; x2: number; signatureLineY: number; nameLineY: number },
) {
  const maxWidth = layout.x2 - layout.x1 - 8;
  const maxHeight = layout.nameLineY - layout.signatureLineY - 6;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  page.drawImage(image, {
    x: layout.x1 + 4,
    y: layout.signatureLineY + 3,
    width: image.width * scale,
    height: image.height * scale,
  });
}

function drawFieldText(page: PDFPage, font: PDFFont, text: string, x: number, lineY: number) {
  page.drawText(text, { x: x + 4, y: lineY + 3, size: 10, font, color: rgb(0.06, 0.09, 0.16) });
}

/** Crude character-count wrap — good enough for a small monospace-ish audit footer, not real typesetting. */
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

/**
 * Fills in the template's own blank signature lines directly (see
 * `FIELD_LAYOUT`) rather than appending a new page — the final document is
 * the same 4 pages as the original, just with the blanks completed and a
 * small audit footer added in the page's existing empty space below the
 * signature box.
 */
export async function buildSignedAgreementPdf(
  snapshot: AgreementSnapshot,
  customer: AgreementCustomerAudit,
  rep: AgreementRepSignature | null,
): Promise<Buffer> {
  const templateBytes = await loadTemplateBytes();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const page = pdfDoc.getPage(SIGNATURE_PAGE_INDEX);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const todayLabel = customer.signedAtLabel.split(" at ")[0] ?? customer.signedAtLabel;

  // Customer column — always present, this is what was just signed.
  const customerSignatureImage = await pdfDoc.embedPng(customer.signatureImage);
  drawSignatureImage(page, customerSignatureImage, FIELD_LAYOUT.customer);
  drawFieldText(page, font, customer.typedName, FIELD_LAYOUT.customer.x1, FIELD_LAYOUT.customer.nameLineY);
  drawFieldText(page, font, todayLabel, FIELD_LAYOUT.customer.x1, FIELD_LAYOUT.customer.dateLineY);

  // Company column — the rep's saved Settings signature (see
  // src/data/profile-signature-service.ts). Left blank, same as the
  // original unsigned template, if the rep hasn't set one up.
  if (rep) {
    const repSignatureImage = await pdfDoc.embedPng(rep.image);
    drawSignatureImage(page, repSignatureImage, FIELD_LAYOUT.company);
    drawFieldText(page, font, rep.name, FIELD_LAYOUT.company.x1, FIELD_LAYOUT.company.nameLineY);
    const repDateLabel = rep.signedAtLabel.split(" at ")[0] ?? rep.signedAtLabel;
    drawFieldText(page, font, repDateLabel, FIELD_LAYOUT.company.x1, FIELD_LAYOUT.company.dateLineY);
  } else {
    page.drawText("No representative signature on file", {
      x: FIELD_LAYOUT.company.x1 + 4,
      y: FIELD_LAYOUT.company.signatureLineY + 3,
      size: 8,
      font: italicFont,
      color: rgb(0.58, 0.64, 0.72),
    });
  }

  // Audit footer — the template's signature box ends well above the page
  // footer branding, leaving room to add this without a new page.
  const auditLines = [
    `Quote ${snapshot.reference} — signed ${customer.signedAtLabel}`,
    ...wrapText(`IP address: ${customer.ip}`, 100),
    ...wrapText(`Browser: ${customer.userAgent}`, 100),
    ...wrapText(`Document hash (SHA-256): ${customer.documentHash}`, 100),
  ];
  let auditY = 390;
  for (const line of auditLines) {
    page.drawText(line, { x: 55, y: auditY, size: 7, font, color: rgb(0.58, 0.64, 0.72) });
    auditY -= 10;
  }

  return Buffer.from(await pdfDoc.save());
}
