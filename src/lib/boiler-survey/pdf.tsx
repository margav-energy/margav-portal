import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { BOILER_SURVEY_SECTIONS } from "@/lib/boiler-survey-fields";
import {
  PHOTO_CHECKLIST_ITEMS,
  type BoilerSurveyAnswers,
  type BoilerSurveyJobContext,
  type PhotoChecklistItemKey,
} from "@/types/boiler-survey";

/**
 * Renders the "Download survey PDF" artifact once a surveyor submits the
 * on-site pre-installation form — the same idea as
 * `src/lib/esignature/pdf.tsx`'s signed-quote PDF, just for the boiler
 * survey (every answer + the photo checklist). Orchestrated from
 * `generateAndStoreSurveyPdf` in `src/data/boiler-survey-service.ts`, which
 * stores the result in the existing `boiler-survey-photos` bucket.
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  brand: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subBrand: { fontSize: 10, color: "#64748b", marginBottom: 4 },
  meta: { fontSize: 9, color: "#94a3b8" },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 6,
    textTransform: "uppercase",
    color: "#334155",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 4,
  },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap" },
  field: { width: "50%", paddingRight: 12, paddingVertical: 3 },
  fieldLabel: { fontSize: 8, color: "#64748b" },
  fieldValue: { fontSize: 10, fontWeight: 700, marginTop: 1 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  photoTile: { width: "33.33%", paddingRight: 8, paddingBottom: 12 },
  photoImage: { width: "100%", height: 110, objectFit: "cover", borderRadius: 4 },
  photoPlaceholder: {
    width: "100%",
    height: 110,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  photoPlaceholderText: { fontSize: 8, color: "#94a3b8", textAlign: "center" },
  photoLabel: { fontSize: 8, color: "#475569", marginTop: 4 },
});

function displayValue(value: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export interface SurveyPdfPhoto {
  itemKey: PhotoChecklistItemKey;
  bytes: Buffer;
  /** react-pdf's `<Image>` only reliably decodes JPEG/PNG — other formats (e.g. HEIC straight off an iPhone camera) are listed by label but not embedded, see `embeddable` below. */
  embeddable: boolean;
}

export async function renderSurveySummaryPdf(params: {
  job: BoilerSurveyJobContext;
  answers: BoilerSurveyAnswers;
  photos: SurveyPdfPhoto[];
  submittedAtLabel: string;
}): Promise<Buffer> {
  const { job, answers, photos, submittedAtLabel } = params;
  const photoByKey = new Map(photos.map((photo) => [photo.itemKey, photo]));

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Margav Energy</Text>
        <Text style={styles.subBrand}>Pre-Installation Survey — {job.reference}</Text>
        <Text style={styles.meta}>
          {job.customerName} · {job.addressLines.join(", ") || "—"} · Rep {job.repName}
        </Text>
        <Text style={styles.meta}>
          Surveyor: {answers.surveyorName || "—"} · Submitted {submittedAtLabel}
        </Text>

        {BOILER_SURVEY_SECTIONS.map((section) => (
          <View key={section.title} wrap={false}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.fieldGrid}>
              {section.fields.map((field) => (
                <View key={field.key} style={styles.field}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text style={styles.fieldValue}>{displayValue(answers[field.key] as string | number | null)}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>
          Photos ({photos.length}/{PHOTO_CHECKLIST_ITEMS.length})
        </Text>
        <View style={styles.photoGrid}>
          {PHOTO_CHECKLIST_ITEMS.map((item) => {
            const photo = photoByKey.get(item.key);
            return (
              <View key={item.key} style={styles.photoTile} wrap={false}>
                {photo?.embeddable ? (
                  // eslint-disable-next-line jsx-a11y/alt-text -- this is @react-pdf/renderer's PDF-drawing <Image>, not an HTML <img>; it has no alt prop.
                  <Image src={photo.bytes} style={styles.photoImage} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoPlaceholderText}>
                      {photo ? "Photo attached — view in portal" : "Not photographed"}
                    </Text>
                  </View>
                )}
                <Text style={styles.photoLabel}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
