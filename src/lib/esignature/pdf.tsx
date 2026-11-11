import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { DocumentSnapshot } from "@/lib/esignature/document";
import { ProposalIntroPage, QuoteCoverPage } from "@/lib/esignature/quote-cover";

/**
 * Renders the final signed-document PDF — the durable artifact stored in
 * the `signed-documents` bucket once a customer signs on `/sign/[token]`.
 * Pure JS (`@react-pdf/renderer`), no headless browser needed, so this runs
 * fine inside a Node.js Server Action.
 */

/** Solar quotes open with a branded cover page (see quote-cover.tsx); boilers use their own template. */
export function hasCover(snapshot: DocumentSnapshot): boolean {
  return snapshot.productTypeLabel !== "Boiler";
}

/** Pages that open the document ahead of the Easy PV proposal: the cover, plus the portal's "Your Solar Proposal" page when there is one. */
export function frontPageCount(snapshot: DocumentSnapshot): number {
  return (hasCover(snapshot) ? 1 : 0) + (snapshot.proposalPage ? 1 : 0);
}

/** "MarGav Solar" on a solar quote, "Margav Heating" otherwise (boilers). */
function brandNameFor(snapshot: DocumentSnapshot): string {
  return snapshot.productTypeLabel === "Boiler" ? "Margav Heating" : "MarGav Solar";
}

let solarLogo: Buffer | null | undefined;
/** public/solar.png — the MarGav Solar logo. Read once; null if it can't be found (the header falls back to text). */
function loadSolarLogo(): Buffer | null {
  if (solarLogo === undefined) {
    try {
      solarLogo = readFileSync(join(process.cwd(), "public", "solar.png"));
    } catch {
      solarLogo = null;
    }
  }
  return solarLogo;
}

const styles = StyleSheet.create({
  tableHeader: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#000000", fontSize: 9, color: "#737373" },
  tableRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  colItem: { flex: 5 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 2, textAlign: "right" },
  colTotal: { flex: 2, textAlign: "right" },
  sheetTitle: { fontSize: 20, fontWeight: 700, marginTop: 6, marginBottom: 10 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 14 },
  sheetMeta: { flexDirection: "row", gap: 6, marginBottom: 2 },
  sheetMetaLabel: { color: "#737373" },
  goodsHeading: { fontWeight: 700, marginTop: 8, marginBottom: 4 },
  logo: { height: 34, objectFit: "contain", objectPosition: "left", marginBottom: 6 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#000000" },
  brand: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subBrand: { fontSize: 10, color: "#737373", marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginBottom: 8, marginTop: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#e5e5e5" },
  label: { color: "#737373" },
  value: { fontWeight: 700 },
  lineItemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: "#000000" },
  totalLabel: { fontSize: 12, fontWeight: 700 },
  disclaimer: { fontSize: 9, color: "#737373", marginTop: 16, lineHeight: 1.4 },
  signatureBlockRow: { flexDirection: "row", marginTop: 28, borderTopWidth: 1, borderTopColor: "#e5e5e5", paddingTop: 16, gap: 24 },
  signatureBlock: { flex: 1 },
  designImage: { width: "100%", maxHeight: 220, objectFit: "contain", marginTop: 12 },
  signatureRole: { fontSize: 9, color: "#a3a3a3", textTransform: "uppercase", marginBottom: 4 },
  signatureImage: { width: 200, height: 70, objectFit: "contain", marginTop: 6, marginBottom: 6 },
  signaturePlaceholder: { fontSize: 9, color: "#a3a3a3", fontStyle: "italic", marginTop: 6, marginBottom: 6 },
  auditBlock: { marginTop: 20, padding: 10, backgroundColor: "#fafafa", borderRadius: 4 },
  auditLine: { fontSize: 8, color: "#737373", marginBottom: 2 },
});

export interface SignedDocumentAudit {
  typedName: string;
  signatureImage: Buffer | Uint8Array;
  signedAtLabel: string;
  ip: string;
  userAgent: string;
  documentHash: string;
}

export interface RepSignature {
  name: string;
  image: Buffer | Uint8Array;
}

/** The solar design image bytes (jpeg/png), when the quote has one — see `readLockedDesignImage`. */
export type DesignImageBytes = Buffer | Uint8Array;

/** The solar quote laid out like Easy PV's own Quote page. */
function SolarQuoteSheet({ snapshot, logo }: { snapshot: DocumentSnapshot; logo: Buffer | null }) {
  const sheet = snapshot.solarSheet!;
  const monthly = snapshot.monthlyPlans?.[0];
  return (
    <>
      {logo ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- this is @react-pdf/renderer's PDF-drawing <Image>, not an HTML <img>; it has no alt prop.
        <Image src={logo} style={styles.logo} />
      ) : (
        <Text style={styles.brand}>{brandNameFor(snapshot)}</Text>
      )}
      <Text style={styles.sheetTitle}>Quote</Text>

      <View style={styles.sheetHeader}>
        <View>
          <Text style={styles.value}>{snapshot.customerName}</Text>
          {snapshot.customerAddressLines.map((line, index) => (
            <Text key={index}>{line}</Text>
          ))}
        </View>
        <View>
          <View style={styles.sheetMeta}>
            <Text style={styles.sheetMetaLabel}>Quote reference:</Text>
            <Text>{snapshot.reference}</Text>
          </View>
          <View style={styles.sheetMeta}>
            <Text style={styles.sheetMetaLabel}>Quote date:</Text>
            <Text>{snapshot.sentDateLabel}</Text>
          </View>
          {snapshot.repName && (
            <View style={styles.sheetMeta}>
              <Text style={styles.sheetMetaLabel}>Quote by:</Text>
              <Text>{snapshot.repName}</Text>
            </View>
          )}
          <View style={styles.sheetMeta}>
            <Text style={styles.sheetMetaLabel}>Quote validity:</Text>
            <Text>{sheet.validityLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.tableHeader}>
        <Text style={styles.colItem}>Description of goods and services</Text>
        <Text style={styles.colTotal}>Price</Text>
      </View>
      <Text style={styles.goodsHeading}>Goods</Text>
      {sheet.goods.map((line, index) => (
        <View key={`${index}-${line}`} style={styles.tableRow} wrap={false}>
          <Text style={styles.colItem}>{line}</Text>
        </View>
      ))}
      <View style={styles.totalsRow}>
        <Text style={styles.value}>System cost</Text>
        <Text style={styles.value}>{sheet.systemCostLabel}</Text>
      </View>

      {sheet.additionalItems.length > 0 && (
        <>
          <Text style={styles.goodsHeading}>Additional items</Text>
          {sheet.additionalItems.map((item, index) => (
            <View key={`${index}-${item.name}`} style={styles.tableRow} wrap={false}>
              <Text style={styles.colItem}>
                {item.quantity > 1 ? `${item.quantity} \u00d7 ` : ""}
                {item.name}
              </Text>
              <Text style={styles.colTotal}>{item.amountLabel}</Text>
            </View>
          ))}
        </>
      )}

      {snapshot.discountLabel && (
        <View style={styles.totalsRow}>
          <Text style={styles.label}>Discount</Text>
          <Text>-{snapshot.discountLabel}</Text>
        </View>
      )}
      {sheet.totalBeforeVatLabel && sheet.vatLabel && (
        <>
          <View style={styles.totalsRow}>
            <Text style={styles.label}>Total before VAT</Text>
            <Text>{sheet.totalBeforeVatLabel}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.label}>VAT</Text>
            <Text>{sheet.vatLabel}</Text>
          </View>
        </>
      )}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total including VAT</Text>
        <Text style={styles.totalLabel}>{snapshot.totalPriceLabel}</Text>
      </View>
      {snapshot.depositLabel && (
        <View style={styles.totalsRow}>
          <Text style={styles.label}>{snapshot.depositPaidUpfront ? "Deposit (paid up front)" : "Deposit"}</Text>
          <Text>{snapshot.depositLabel}</Text>
        </View>
      )}
      {snapshot.amountFinancedLabel && (
        <View style={styles.totalsRow}>
          <Text style={styles.label}>Amount financed</Text>
          <Text>{snapshot.amountFinancedLabel}</Text>
        </View>
      )}
      <View style={styles.totalsRow}>
        <Text style={styles.label}>Payment method</Text>
        <Text>{snapshot.paymentMethodLabel}</Text>
      </View>
      {monthly && (
        <View style={styles.totalsRow}>
          <Text style={styles.label}>Monthly payment ({monthly.years} years)</Text>
          <Text>{monthly.monthlyLabel}</Text>
        </View>
      )}

      <Text style={styles.disclaimer}>
        This quote is subject to survey. A statutory 14-day cooling-off period applies from the date this document
        is signed, during which the customer may cancel without penalty.
      </Text>
    </>
  );
}

function QuoteDocumentBody({ snapshot }: { snapshot: DocumentSnapshot }) {
  if (snapshot.solarSheet) {
    return <SolarQuoteSheet snapshot={snapshot} logo={loadSolarLogo()} />;
  }
  const logo = snapshot.productTypeLabel === "Boiler" ? null : loadSolarLogo();
  // The discount and deposit are shown so the lines above add up to the total (a quote with a discount
  // otherwise lists items that sum to more than the price at the bottom).
  const hasAdjustments = Boolean(snapshot.discountLabel || snapshot.depositLabel);
  const monthly = snapshot.monthlyPlans?.[0];
  return (
    <>
      {logo ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- this is @react-pdf/renderer's PDF-drawing <Image>, not an HTML <img>; it has no alt prop.
        <Image src={logo} style={styles.logo} />
      ) : (
        <Text style={styles.brand}>{brandNameFor(snapshot)}</Text>
      )}
      <Text style={styles.subBrand}>Quote {snapshot.reference} — {snapshot.productTypeLabel}</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Customer</Text>
        <Text style={styles.value}>{snapshot.customerName}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Address</Text>
        <Text style={styles.value}>{snapshot.customerAddressLines.join(", ") || "—"}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Sent</Text>
        <Text style={styles.value}>{snapshot.sentDateLabel}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Payment method</Text>
        <Text style={styles.value}>{snapshot.paymentMethodLabel}</Text>
      </View>

      <Text style={styles.sectionTitle}>What&rsquo;s included</Text>
      <View style={styles.tableHeader}>
        <Text style={styles.colItem}>Item</Text>
        <Text style={styles.colQty}>Qty</Text>
        <Text style={styles.colUnit}>Unit price</Text>
        <Text style={styles.colTotal}>Total</Text>
      </View>
      {snapshot.lineItems.map((item, index) => (
        <View key={`${index}-${item.name}`} style={styles.tableRow} wrap={false}>
          <Text style={styles.colItem}>{item.name}</Text>
          <Text style={styles.colQty}>{item.quantity ?? ""}</Text>
          <Text style={styles.colUnit}>{item.unitPriceLabel ?? ""}</Text>
          <Text style={styles.colTotal}>{item.amountLabel}</Text>
        </View>
      ))}
      {hasAdjustments && snapshot.subtotalLabel && (
        <View style={styles.totalsRow}>
          <Text style={styles.label}>Subtotal</Text>
          <Text>{snapshot.subtotalLabel}</Text>
        </View>
      )}
      {snapshot.discountLabel && (
        <View style={styles.totalsRow}>
          <Text style={styles.label}>Discount</Text>
          <Text>-{snapshot.discountLabel}</Text>
        </View>
      )}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total price</Text>
        <Text style={styles.totalLabel}>{snapshot.totalPriceLabel}</Text>
      </View>
      {snapshot.depositLabel && (
        <View style={styles.totalsRow}>
          <Text style={styles.label}>{snapshot.depositPaidUpfront ? "Deposit (paid up front)" : "Deposit"}</Text>
          <Text>{snapshot.depositLabel}</Text>
        </View>
      )}
      {snapshot.amountFinancedLabel && (
        <View style={styles.totalsRow}>
          <Text style={styles.label}>Amount financed</Text>
          <Text>{snapshot.amountFinancedLabel}</Text>
        </View>
      )}
      {monthly && (
        <View style={styles.totalsRow}>
          <Text style={styles.label}>Monthly payment ({monthly.years} years)</Text>
          <Text>{monthly.monthlyLabel}</Text>
        </View>
      )}

      <Text style={styles.disclaimer}>
        This quote is subject to survey. A statutory 14-day cooling-off period applies from the date this document
        is signed, during which the customer may cancel without penalty.
      </Text>
    </>
  );
}

/**
 * The "Download PDF" button on the quote document (both the internal View
 * Quote page and the customer's pre-signing `/sign/[token]` page) — same
 * body as the final signed PDF, minus the signature block that doesn't
 * exist yet at this point.
 */
export async function renderUnsignedQuotePdf(snapshot: DocumentSnapshot, designImage?: DesignImageBytes): Promise<Buffer> {
  const doc = (
    <Document>
      {hasCover(snapshot) && <QuoteCoverPage snapshot={snapshot} logo={loadSolarLogo()} designImage={designImage} />}
      {snapshot.proposalPage && <ProposalIntroPage snapshot={snapshot} />}
      <Page size="A4" style={styles.page}>
        <QuoteDocumentBody snapshot={snapshot} />
      </Page>
      {hasCover(snapshot) && (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>Acceptance</Text>
          <Text style={styles.value}>
            To accept this quote, sign online using the secure link we emailed you. Your signed copy, including the
            signatures below, will be sent to you once you have signed.
          </Text>
          <View style={styles.signatureBlockRow}>
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureRole}>Customer</Text>
              <Text style={styles.signaturePlaceholder}>Signed online by the customer</Text>
            </View>
            <View style={styles.signatureBlock}>
              <Text style={styles.signatureRole}>For {brandNameFor(snapshot)}</Text>
              <Text style={styles.signaturePlaceholder}>Added when the quote is signed</Text>
            </View>
          </View>
        </Page>
      )}
    </Document>
  );

  return renderToBuffer(doc);
}

export async function renderSignedDocumentPdf(
  snapshot: DocumentSnapshot,
  audit: SignedDocumentAudit,
  repSignature: RepSignature | null,
  designImage?: DesignImageBytes,
): Promise<Buffer> {
  const doc = (
    <Document>
      {hasCover(snapshot) && <QuoteCoverPage snapshot={snapshot} logo={loadSolarLogo()} designImage={designImage} />}
      {snapshot.proposalPage && <ProposalIntroPage snapshot={snapshot} />}
      <Page size="A4" style={styles.page}>
        <QuoteDocumentBody snapshot={snapshot} />
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Signatures</Text>
        <View style={styles.signatureBlockRow}>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureRole}>Customer</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- this is @react-pdf/renderer's PDF-drawing <Image>, not an HTML <img>; it has no alt prop. */}
            <Image src={audit.signatureImage as Buffer} style={styles.signatureImage} />
            <Text style={styles.value}>{audit.typedName}</Text>
            <Text style={styles.label}>Signed {audit.signedAtLabel}</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureRole}>For {brandNameFor(snapshot)}</Text>
            {repSignature ? (
              <>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- see note above. */}
                <Image src={repSignature.image as Buffer} style={styles.signatureImage} />
                <Text style={styles.value}>{repSignature.name}</Text>
              </>
            ) : (
              <Text style={styles.signaturePlaceholder}>No representative signature on file</Text>
            )}
          </View>
        </View>

        <View style={styles.auditBlock}>
          <Text style={styles.auditLine}>IP address: {audit.ip}</Text>
          <Text style={styles.auditLine}>Browser: {audit.userAgent}</Text>
          <Text style={styles.auditLine}>Document hash (SHA-256): {audit.documentHash}</Text>
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
