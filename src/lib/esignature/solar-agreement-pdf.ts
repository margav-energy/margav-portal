import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { AgreementSnapshot } from "@/lib/esignature/agreement-document";
import type { AgreementCustomerAudit, AgreementRepSignature } from "@/lib/esignature/agreement-pdf";
import { SOLAR_AGREEMENT_BLOCKS, SOLAR_AGREEMENT_PARTIES, SOLAR_AGREEMENT_TITLE } from "@/lib/esignature/solar-agreement-terms";

/**
 * The Solar PV Installation Agreement. Unlike the boiler agreement (a fixed PDF whose signature blanks are filled in),
 * the solar one is laid out here from its clause text (solar-agreement-terms.ts) — the same pdf-lib approach as the
 * waiver's "Details and Signatures" page — so the unsigned and signed copies are one function: with no `signing` the
 * signature blocks are left blank (what the customer reads before signing), with it they are filled in.
 */

const LOGO_PATH = path.join(process.cwd(), "assets", "agreement-templates", "solar-agreement-logo.png");

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 55;
const TOP_Y = PAGE_H - 60;
const BOTTOM_Y = 70;
const TEXT_W = PAGE_W - MARGIN_X * 2;

const INK = rgb(0.1, 0.1, 0.1);
const BLUE = rgb(0.2, 0.2, 0.8); // brand-blue #3333cc
const MUTED = rgb(0.45, 0.45, 0.45);
const RULE = rgb(0.4, 0.8, 0.4);

const FOOTER = "Margav Renewables Ltd trading as Margav Solar | Unit 7-8 Kimberley Business Park, Kimberley Way, Brereton, Rugeley, WS15 1RE";

export interface SolarAgreementSigning {
  customer: AgreementCustomerAudit;
  rep: AgreementRepSignature | null;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Crude character-count wrap for the small audit footer (same approach as the other signed documents). */
function wrapChars(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) lines.push(text.slice(i, i + maxChars));
  return lines;
}

export async function buildSolarAgreementPdf(snapshot: AgreementSnapshot, signing?: SolarAgreementSigning): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const logo = await pdf.embedPng(await readFile(LOGO_PATH));

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = TOP_Y;

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = TOP_Y;
  };
  const ensure = (needed: number) => {
    if (y - needed < BOTTOM_Y) newPage();
  };
  const paragraph = (text: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number; after?: number; bullet?: boolean }) => {
    const size = opts.size ?? 9.5;
    const f = opts.font ?? font;
    const indent = opts.indent ?? 0;
    const lineHeight = size * 1.4;
    const lines = wrap(text, f, size, TEXT_W - indent);
    lines.forEach((line, index) => {
      ensure(lineHeight);
      if (opts.bullet && index === 0) page.drawText("•", { x: MARGIN_X + indent - 11, y, size, font: f, color: opts.color ?? INK });
      page.drawText(line, { x: MARGIN_X + indent, y, size, font: f, color: opts.color ?? INK });
      y -= lineHeight;
    });
    y -= opts.after ?? 0;
  };

  // Title block.
  const logoWidth = 170;
  const logoHeight = (logo.height / logo.width) * logoWidth;
  page.drawImage(logo, { x: MARGIN_X, y: y - logoHeight, width: logoWidth, height: logoHeight });
  y -= logoHeight + 24;
  paragraph(SOLAR_AGREEMENT_TITLE, { size: 17, font: bold, color: BLUE, after: 4 });
  page.drawRectangle({ x: MARGIN_X, y: y + 4, width: TEXT_W, height: 1.5, color: RULE });
  y -= 10;
  paragraph("BETWEEN", { font: bold, after: 2 });
  paragraph(SOLAR_AGREEMENT_PARTIES[0], { after: 6 });
  paragraph("AND", { font: bold, after: 2 });
  paragraph(SOLAR_AGREEMENT_PARTIES[1], { after: 4 });
  if (snapshot.reference) paragraph(`Quote reference ${snapshot.reference} \u2014 ${snapshot.customerName}`, { font: italic, color: MUTED, after: 8 });

  for (const block of SOLAR_AGREEMENT_BLOCKS) {
    if (block.kind === "heading") {
      ensure(40);
      y -= 6;
      paragraph(block.text, { size: 11, font: bold, color: BLUE, after: 3 });
    } else if (block.kind === "bullet") {
      paragraph(block.text, { indent: 30, bullet: true, after: 1 });
    } else if (block.kind === "line") {
      paragraph(block.text, { indent: 24, font: bold, after: 1 });
    } else {
      paragraph(block.text, { after: 3 });
    }
  }

  // Signatures — always start on a fresh page so the blocks are never split.
  newPage();
  paragraph("Signatures", { size: 14, font: bold, color: BLUE, after: 10 });

  const todayLabel = (label: string) => label.split(" at ")[0] ?? label;
  const block = async (
    heading: string,
    name: string | undefined,
    dateLabel: string | undefined,
    image: Buffer | Uint8Array | undefined,
    emptyNote?: string,
  ) => {
    ensure(150);
    paragraph(heading, { font: bold, size: 10.5, after: 6 });
    paragraph("Name", { size: 8, font: bold, color: MUTED, after: 0 });
    paragraph(name ?? "", { size: 11, after: 2 });
    paragraph("Signature", { size: 8, font: bold, color: MUTED, after: 0 });
    const boxHeight = 56;
    if (image) {
      const png = await pdf.embedPng(image);
      const scale = Math.min(220 / png.width, (boxHeight - 6) / png.height, 1);
      page.drawImage(png, { x: MARGIN_X, y: y - png.height * scale - 2, width: png.width * scale, height: png.height * scale });
    } else if (emptyNote) {
      page.drawText(emptyNote, { x: MARGIN_X, y: y - 24, size: 8, font: italic, color: MUTED });
    }
    y -= boxHeight;
    page.drawRectangle({ x: MARGIN_X, y: y + 2, width: 240, height: 0.7, color: MUTED });
    y -= 10;
    paragraph("Date", { size: 8, font: bold, color: MUTED, after: 0 });
    paragraph(dateLabel ?? "", { size: 11, after: 18 });
  };

  await block(
    "Company: Margav Renewables Ltd trading as Margav Solar",
    signing?.rep?.name,
    signing?.rep ? todayLabel(signing.rep.signedAtLabel) : undefined,
    signing?.rep?.image,
    signing && !signing.rep ? "No representative signature on file" : undefined,
  );
  await block(
    "Customer",
    signing?.customer.typedName ?? snapshot.customerName,
    signing ? todayLabel(signing.customer.signedAtLabel) : undefined,
    signing?.customer.signatureImage,
  );

  if (signing) {
    const lines = [
      `Quote ${snapshot.reference} — signed ${signing.customer.signedAtLabel}`,
      ...wrapChars(`IP address: ${signing.customer.ip}`, 100),
      ...wrapChars(`Browser: ${signing.customer.userAgent}`, 100),
      ...wrapChars(`Document hash (SHA-256): ${signing.customer.documentHash}`, 100),
    ];
    let auditY = BOTTOM_Y + lines.length * 10;
    for (const line of lines) {
      page.drawText(line, { x: MARGIN_X, y: auditY, size: 7, font, color: MUTED });
      auditY -= 10;
    }
  }

  // Footer + page numbers on every page.
  const pages = pdf.getPages();
  pages.forEach((p, index) => {
    p.drawText(FOOTER, { x: MARGIN_X, y: 34, size: 6.5, font, color: MUTED });
    const label = `Page ${index + 1} of ${pages.length}`;
    p.drawText(label, { x: PAGE_W - MARGIN_X - font.widthOfTextAtSize(label, 7), y: 22, size: 7, font, color: MUTED });
  });

  return Buffer.from(await pdf.save());
}
