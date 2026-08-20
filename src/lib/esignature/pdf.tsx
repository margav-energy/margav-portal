import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { DocumentSnapshot } from "@/lib/esignature/document";

/**
 * Renders the final signed-document PDF — the durable artifact stored in
 * the `signed-documents` bucket once a customer signs on `/sign/[token]`.
 * Pure JS (`@react-pdf/renderer`), no headless browser needed, so this runs
 * fine inside a Node.js Server Action.
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#0f172a" },
  brand: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subBrand: { fontSize: 10, color: "#64748b", marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginBottom: 8, marginTop: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  label: { color: "#64748b" },
  value: { fontWeight: 700 },
  lineItemRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: "#0f172a" },
  totalLabel: { fontSize: 12, fontWeight: 700 },
  disclaimer: { fontSize: 9, color: "#64748b", marginTop: 16, lineHeight: 1.4 },
  signatureBlockRow: { flexDirection: "row", marginTop: 28, borderTopWidth: 1, borderTopColor: "#e2e8f0", paddingTop: 16, gap: 24 },
  signatureBlock: { flex: 1 },
  signatureRole: { fontSize: 9, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 },
  signatureImage: { width: 200, height: 70, objectFit: "contain", marginTop: 6, marginBottom: 6 },
  signaturePlaceholder: { fontSize: 9, color: "#94a3b8", fontStyle: "italic", marginTop: 6, marginBottom: 6 },
  auditBlock: { marginTop: 20, padding: 10, backgroundColor: "#f8fafc", borderRadius: 4 },
  auditLine: { fontSize: 8, color: "#64748b", marginBottom: 2 },
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

function QuoteDocumentBody({ snapshot }: { snapshot: DocumentSnapshot }) {
  return (
    <>
      <Text style={styles.brand}>Margav Energy</Text>
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
      {snapshot.lineItems.map((item) => (
        <View key={item.name} style={styles.lineItemRow}>
          <Text>{item.name}</Text>
          <Text>{item.amountLabel}</Text>
        </View>
      ))}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total price</Text>
        <Text style={styles.totalLabel}>{snapshot.totalPriceLabel}</Text>
      </View>

      <Text style={styles.disclaimer}>
        This quote is subject to survey. A statutory 14-day cooling-off period applies from the date this document
        is signed, during which the customer may cancel without penalty.
      </Text>
    </>
  );
}

export async function renderSignedDocumentPdf(
  snapshot: DocumentSnapshot,
  audit: SignedDocumentAudit,
  repSignature: RepSignature | null,
): Promise<Buffer> {
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <QuoteDocumentBody snapshot={snapshot} />

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
            <Text style={styles.signatureRole}>For Margav Energy</Text>
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
