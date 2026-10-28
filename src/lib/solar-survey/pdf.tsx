import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import {
  ADDITIONAL_MEDIA_ITEMS,
  GENERAL_PHOTO_ITEMS,
  ROOF_LETTERS,
  ROOF_PHOTO_ITEMS,
  SOLAR_LOCATION_QUESTIONS,
  SOLAR_NOTES_QUESTIONS,
  SOLAR_PROPERTY_QUESTIONS,
  SOLAR_ROOF_QUESTIONS,
  VIDEO_ITEMS,
  type SolarSurveyFileItem,
  type SolarSurveyQuestion,
} from "@/lib/solar-survey-fields";
import type { SolarSurveyAnswers, SolarSurveyJobContext } from "@/types/solar-survey";
import type { SolarSurveyFileBytes } from "@/data/solar-survey-service";

/**
 * "Download PDF" for the solar pre-installation survey — every answer plus
 * the uploaded photos (JPEG/PNG are embedded; videos, PDFs and other image
 * formats such as HEIC are listed by name, since react-pdf can't draw them).
 * Same idea as `src/lib/boiler-survey/pdf.tsx`, rendered on demand by
 * `src/app/api/quotes/[id]/solar-survey/pdf/route.ts`.
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
  fieldThird: { width: "33.33%", paddingRight: 12, paddingVertical: 3 },
  fieldLabel: { fontSize: 8, color: "#64748b" },
  fieldValue: { fontSize: 10, fontWeight: 700, marginTop: 1 },
  itemLabel: { fontSize: 9, fontWeight: 700, marginTop: 8, color: "#334155" },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  photoTile: { width: "33.33%", paddingRight: 8, paddingBottom: 10 },
  photoImage: { width: "100%", height: 110, objectFit: "cover", borderRadius: 4 },
  filePlaceholder: {
    width: "100%",
    height: 110,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  filePlaceholderText: { fontSize: 8, color: "#64748b", textAlign: "center" },
  none: { fontSize: 9, color: "#94a3b8", marginTop: 2 },
});

function display(value: string): string {
  return value.trim() ? value : "—";
}

function QuestionGrid({ title, rows }: { title: string; rows: { question: SolarSurveyQuestion; value: string }[] }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.fieldGrid}>
        {rows.map(({ question, value }) => (
          <View key={question.label} style={styles.field} wrap={false}>
            <Text style={styles.fieldLabel}>{question.label}</Text>
            <Text style={styles.fieldValue}>{display(value)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function FileSection({ title, items, files }: { title: string; items: SolarSurveyFileItem[]; files: SolarSurveyFileBytes[] }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item) => {
        const itemFiles = files.filter((file) => file.itemKey === item.key);
        return (
          <View key={item.key}>
            <Text style={styles.itemLabel}>{item.label}</Text>
            {itemFiles.length === 0 ? (
              <Text style={styles.none}>Nothing uploaded</Text>
            ) : (
              <View style={styles.photoGrid}>
                {itemFiles.map((file) => {
                  const embeddable = file.contentType === "image/jpeg" || file.contentType === "image/png";
                  return (
                    <View key={file.id} style={styles.photoTile} wrap={false}>
                      {embeddable ? (
                        // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's <Image> has no alt prop.
                        <Image src={file.bytes} style={styles.photoImage} />
                      ) : (
                        <View style={styles.filePlaceholder}>
                          <Text style={styles.filePlaceholderText}>{file.fileName}</Text>
                          <Text style={styles.filePlaceholderText}>
                            {file.contentType.startsWith("video/") ? "Video" : "File"} — view in portal
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export async function renderSolarSurveyPdf(params: {
  job: SolarSurveyJobContext;
  answers: SolarSurveyAnswers;
  files: SolarSurveyFileBytes[];
  submittedAtLabel: string;
}): Promise<Buffer> {
  const { job, answers, files, submittedAtLabel } = params;
  const roofCount = Math.min(Math.max(Number(answers.roofCount) || 0, 0), 3);

  const jobRows: [string, string][] = [
    ["Reference Number", job.reference],
    ["Rep Name", job.repName],
    ["First name", job.firstName],
    ["Last name", job.lastName],
    ["Phone", job.phone],
    ["Address line 1", job.address.line1],
    ["Address line 2", job.address.line2],
    ["Address line 3", job.address.line3],
    ["City", job.address.city],
    ["County", job.address.county],
    ["Postcode", job.address.postcode],
    ["Panel make/model", job.panelModel],
    ["Panel quantity", job.panelQuantity ? String(job.panelQuantity) : ""],
    ["Mounting system", job.mountingSystem],
  ];

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Margav Energy</Text>
        <Text style={styles.subBrand}>Pre-Installation Survey — {job.reference}</Text>
        <Text style={styles.meta}>
          {job.customerName} · {job.addressLines.join(", ") || "—"} · Rep {job.repName}
        </Text>
        <Text style={styles.meta}>
          Completed by: {answers.completedBy || "—"} · {submittedAtLabel}
        </Text>

        <Text style={styles.sectionTitle}>01 Customer & job details</Text>
        <View style={styles.fieldGrid}>
          {jobRows.map(([label, value]) => (
            <View key={label} style={styles.fieldThird} wrap={false}>
              <Text style={styles.fieldLabel}>{label}</Text>
              <Text style={styles.fieldValue}>{display(value)}</Text>
            </View>
          ))}
        </View>

        <QuestionGrid
          title="02 Property details"
          rows={SOLAR_PROPERTY_QUESTIONS.map((question) => ({
            question,
            value:
              question.key === "energySupplier" && answers.energySupplier === "Other" && answers.energySupplierOther.trim()
                ? `Other — ${answers.energySupplierOther.trim()}`
                : answers[question.key],
          }))}
        />

        {ROOF_LETTERS.slice(0, roofCount).map((letter, index) => (
          <View key={letter}>
            <QuestionGrid
              title={`0${index + 3} Roof ${letter}`}
              rows={SOLAR_ROOF_QUESTIONS.map((question) => ({ question, value: answers.roofs[index][question.key] }))}
            />
            <FileSection title={`Roof ${letter} photos`} items={[ROOF_PHOTO_ITEMS[index]]} files={files} />
          </View>
        ))}

        <QuestionGrid
          title="06 Key locations"
          rows={SOLAR_LOCATION_QUESTIONS.map((question) => ({ question, value: answers[question.key] }))}
        />
        <FileSection title="07 General photo survey" items={GENERAL_PHOTO_ITEMS} files={files} />
        <FileSection title="08 General video survey" items={VIDEO_ITEMS} files={files} />
        <FileSection title="09 Additional images & videos" items={ADDITIONAL_MEDIA_ITEMS} files={files} />
        <QuestionGrid
          title="10 Notes"
          rows={SOLAR_NOTES_QUESTIONS.map((question) => ({ question, value: answers[question.key] }))}
        />
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
