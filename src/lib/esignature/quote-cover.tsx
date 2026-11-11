import "server-only";
import { Defs, Image, LinearGradient, Page, Rect, Stop, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { HEAD_OFFICE_PHONE } from "@/lib/constants";
import type { DocumentSnapshot } from "@/lib/esignature/document";

/**
 * The cover page of a solar quote — MarGav Solar branding (see "Margav brand"
 * in CLAUDE.md): white page, the 3-stop green gradient (#66cc66 → #33cc66 →
 * #00cc99, middle stop dead centre), brand blue #3333cc for the system
 * headline, black for the footer. Uses Helvetica: the brand's Poppins/Myriad Pro
 * font files aren't in the repo, so PDFs can't embed them yet.
 *
 * Page size is A4 (595 x 842 pt). The design image (panels drawn on the roof,
 * usually from Easy PV) is the hero; without one the hero is a black panel
 * carrying the headline instead, so the page never looks half-empty.
 */

const BLUE = "#3333cc";
const GREEN_START = "#66cc66";
const GREEN_MID = "#33cc66";
const GREEN_END = "#00cc99";

const styles = StyleSheet.create({
  page: { padding: 0, fontFamily: "Helvetica", color: "#000000", backgroundColor: "#ffffff" },
  gradientBar: { position: "absolute", top: 0, left: 0 },
  logo: { position: "absolute", top: 44, left: 40, height: 40, objectFit: "contain", objectPosition: "left" },
  brandText: { position: "absolute", top: 52, left: 40, fontSize: 22, fontFamily: "Helvetica-Bold" },
  eyebrow: { position: "absolute", top: 118, left: 40, fontSize: 10, letterSpacing: 2, color: "#737373", textTransform: "uppercase" },
  title: { position: "absolute", top: 134, left: 40, width: 515, fontSize: 38, fontFamily: "Helvetica-Bold", lineHeight: 1.1 },
  headline: { position: "absolute", top: 232, left: 40, width: 515, fontSize: 18, fontFamily: "Helvetica-Bold", color: BLUE },
  subheadline: { position: "absolute", top: 256, left: 40, width: 515, fontSize: 12, color: "#525252" },
  hero: { position: "absolute", top: 292, left: 40, width: 515, height: 270, borderRadius: 10, objectFit: "cover" },
  heroFallback: {
    position: "absolute",
    top: 292,
    left: 40,
    width: 515,
    height: 270,
    borderRadius: 10,
    backgroundColor: "#000000",
    padding: 28,
    justifyContent: "flex-end",
  },
  heroFallbackText: { color: "#ffffff", fontSize: 30, fontFamily: "Helvetica-Bold", lineHeight: 1.15 },
  details: { position: "absolute", top: 596, left: 40, width: 515, flexDirection: "row", justifyContent: "space-between" },
  detailsColumn: { width: 250 },
  label: { fontSize: 8, letterSpacing: 1.5, color: "#737373", textTransform: "uppercase", marginBottom: 4 },
  customerName: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  line: { fontSize: 10.5, lineHeight: 1.4, color: "#262626" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#d4d4d4" },
  metaLabel: { fontSize: 10, color: "#737373" },
  metaValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 0, left: 0, width: 595, height: 78, backgroundColor: "#000000", paddingHorizontal: 40, justifyContent: "center" },
  footerBrand: { color: "#ffffff", fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  footerLine: { color: "#d4d4d4", fontSize: 9, lineHeight: 1.4 },
  footerGradient: { position: "absolute", bottom: 78, left: 0 },
});

function Gradient({ id, width, height }: { id: string; width: number; height: number }) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor={GREEN_START} />
          <Stop offset="50%" stopColor={GREEN_MID} />
          <Stop offset="100%" stopColor={GREEN_END} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

export function QuoteCoverPage({
  snapshot,
  logo,
  designImage,
}: {
  snapshot: DocumentSnapshot;
  logo: Buffer | null;
  designImage?: Buffer | Uint8Array;
}) {
  const repContact = [snapshot.repEmail, snapshot.repPhone].filter(Boolean).join("  |  ");

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.gradientBar}>
        <Gradient id="coverTop" width={595} height={14} />
      </View>

      {logo ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- this is @react-pdf/renderer's PDF-drawing <Image>, not an HTML <img>; it has no alt prop.
        <Image src={logo} style={styles.logo} />
      ) : (
        <Text style={styles.brandText}>MarGav Solar</Text>
      )}

      <Text style={styles.eyebrow}>Solar proposal</Text>
      <Text style={styles.title}>Your solar{"\n"}quote &amp; proposal</Text>
      {snapshot.headlineLabel && <Text style={styles.headline}>{snapshot.headlineLabel}</Text>}
      {snapshot.subheadlineLabel && <Text style={styles.subheadline}>{snapshot.subheadlineLabel}</Text>}

      {designImage ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- see note above.
        <Image src={designImage as Buffer} style={styles.hero} />
      ) : (
        <View style={styles.heroFallback}>
          <Text style={styles.heroFallbackText}>{snapshot.headlineLabel ?? "Solar PV system"}</Text>
        </View>
      )}

      <View style={styles.details}>
        <View style={styles.detailsColumn}>
          <Text style={styles.label}>Prepared for</Text>
          <Text style={styles.customerName}>{snapshot.customerName}</Text>
          {snapshot.customerAddressLines.map((line, index) => (
            <Text key={index} style={styles.line}>
              {line}
            </Text>
          ))}
        </View>
        <View style={styles.detailsColumn}>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Quote reference</Text>
            <Text style={styles.metaValue}>{snapshot.reference}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{snapshot.sentDateLabel}</Text>
          </View>
          {snapshot.offerValidUntilLabel && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Valid until</Text>
              <Text style={styles.metaValue}>{snapshot.offerValidUntilLabel}</Text>
            </View>
          )}
          {snapshot.repName && (
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Prepared by</Text>
              <Text style={styles.metaValue}>{snapshot.repName}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.footerGradient}>
        <Gradient id="coverFooter" width={595} height={4} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerBrand}>MarGav Solar</Text>
        {repContact ? <Text style={styles.footerLine}>{repContact}</Text> : null}
        {HEAD_OFFICE_PHONE ? <Text style={styles.footerLine}>Head office: {HEAD_OFFICE_PHONE}</Text> : null}
      </View>
    </Page>
  );
}

const introStyles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", color: "#000000", backgroundColor: "#ffffff", fontSize: 11 },
  bar: { position: "absolute", top: 0, left: 0 },
  title: { fontSize: 28, fontFamily: "Helvetica-Bold", marginTop: 18, marginBottom: 22 },
  columns: { flexDirection: "row", gap: 28 },
  letter: { flex: 3 },
  paragraph: { fontSize: 11, lineHeight: 1.5, marginBottom: 10, color: "#262626" },
  sign: { marginTop: 14, fontSize: 11, lineHeight: 1.5 },
  signName: { fontFamily: "Helvetica-Bold" },
  side: { flex: 2 },
  forBox: { backgroundColor: "#f5f5f5", borderRadius: 8, padding: 14, marginBottom: 14 },
  forLabel: { fontSize: 8, letterSpacing: 1.5, color: "#737373", textTransform: "uppercase", marginBottom: 4 },
  forName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  forLine: { fontSize: 10.5, lineHeight: 1.4, color: "#262626" },
  forMeta: { fontSize: 9, color: "#737373", marginTop: 8 },
  statRow: { marginBottom: 12, paddingLeft: 10, borderLeftWidth: 3, borderLeftColor: GREEN_MID },
  statBig: { fontSize: 13, fontFamily: "Helvetica-Bold", color: BLUE },
  statSmall: { fontSize: 10, color: "#525252", lineHeight: 1.4, marginTop: 1 },
});

/**
 * The portal's own "Your Solar Proposal" page, in the layout of Easy PV's first page but with the quote's
 * customer, price, rep and dates — see `DocumentSnapshot.proposalPage`. Stands in for Easy PV's page 1
 * (add page 1 to the pages to leave out). No contents list: Easy PV's page numbers don't line up once
 * pages are replaced.
 */
export function ProposalIntroPage({ snapshot }: { snapshot: DocumentSnapshot }) {
  const page = snapshot.proposalPage;
  if (!page) return null;
  const address = snapshot.customerAddressLines.join(", ");

  return (
    <Page size="A4" style={introStyles.page}>
      <View style={introStyles.bar}>
        <Gradient id="introTop" width={595} height={10} />
      </View>

      <Text style={introStyles.title}>Your Solar Proposal</Text>

      <View style={introStyles.columns}>
        <View style={introStyles.letter}>
          <Text style={introStyles.paragraph}>
            Thanks for choosing MarGav Solar to provide a design for a solar PV system{address ? ` at ${address}` : ""}. We&apos;re
            delighted to supply the attached proposal for a {page.kwpLabel.replace(" PV System", "")} solar array.
          </Text>
          {page.genY1Label && (
            <Text style={introStyles.paragraph}>
              We expect your system to generate {page.genY1Label.replace(" a year", "")} of clean electricity every year.
            </Text>
          )}
          <Text style={introStyles.paragraph}>
            There are full details on the following pages. We hope you enjoy the read!
          </Text>
          <View style={introStyles.sign}>
            <Text>Kind regards,</Text>
            {snapshot.repName && <Text style={introStyles.signName}>{snapshot.repName}</Text>}
            <Text>MarGav Solar</Text>
          </View>
        </View>

        <View style={introStyles.side}>
          <View style={introStyles.forBox}>
            <Text style={introStyles.forLabel}>This proposal is for</Text>
            <Text style={introStyles.forName}>{snapshot.customerName}</Text>
            {snapshot.customerAddressLines.map((line, index) => (
              <Text key={index} style={introStyles.forLine}>
                {line}
              </Text>
            ))}
            <Text style={introStyles.forMeta}>Quote {snapshot.reference}</Text>
            <Text style={introStyles.forMeta}>
              Prepared {snapshot.sentDateLabel} · valid for {page.validityLabel}
            </Text>
          </View>

          <View style={introStyles.statRow}>
            <Text style={introStyles.statBig}>{page.kwpLabel}</Text>
            <Text style={introStyles.statSmall}>
              {page.priceLabel} inc VAT
              {page.paybackLabel ? `. Expected payback ${page.paybackLabel}` : ""}
              {page.savingY1Label ? `. Estimated first year savings ${page.savingY1Label}` : ""}
            </Text>
          </View>
          {page.genY1Label && (
            <View style={introStyles.statRow}>
              <Text style={introStyles.statBig}>{page.genY1Label}</Text>
              <Text style={introStyles.statSmall}>Estimated annual generation</Text>
            </View>
          )}
          {page.batteryLabel && (
            <View style={introStyles.statRow}>
              <Text style={introStyles.statBig}>Battery storage</Text>
              <Text style={introStyles.statSmall}>{page.batteryLabel}</Text>
            </View>
          )}
        </View>
      </View>
    </Page>
  );
}
