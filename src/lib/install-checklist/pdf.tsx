import "server-only";
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { CHECKLIST_ITEMS, CHECKLIST_STAGES, countCompleted } from "@/lib/solar-install-checklist";
import type { ChecklistPhotoBytes } from "@/data/solar-install-checklist-service";

/**
 * "Download PDF" for the solar install photo checklist - every item by stage
 * with its photos (JPEG/PNG are embedded; other formats such as HEIC are
 * listed by name, since react-pdf can't draw them), N/A items marked and
 * anything with neither flagged as missing. Same approach as
 * `src/lib/solar-survey/pdf.tsx`, rendered on demand by
 * `src/app/api/quotes/[id]/install-checklist/pdf/route.ts`.
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#000000" },
  brand: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  subBrand: { fontSize: 10, color: "#737373", marginBottom: 4 },
  meta: { fontSize: 9, color: "#a3a3a3" },
  stageTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 6,
    textTransform: "uppercase",
    color: "#404040",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingBottom: 4,
  },
  itemRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  itemLabel: { fontSize: 9, fontWeight: 700, color: "#404040", flexShrink: 1, paddingRight: 8 },
  statusMissing: { fontSize: 8, color: "#b91c1c", fontWeight: 700 },
  statusNa: { fontSize: 8, color: "#737373", fontWeight: 700 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  photoTile: { width: "33.33%", paddingRight: 8, paddingBottom: 10 },
  photoImage: { width: "100%", height: 110, objectFit: "cover", borderRadius: 4 },
  filePlaceholder: {
    width: "100%",
    height: 110,
    backgroundColor: "#f5f5f5",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  filePlaceholderText: { fontSize: 8, color: "#737373", textAlign: "center" },
});

export async function renderInstallChecklistPdf(params: {
  customerName: string;
  reference: string;
  address: string;
  naItems: string[];
  photos: ChecklistPhotoBytes[];
  statusLabel: string;
}): Promise<Buffer> {
  const { customerName, reference, address, naItems, photos, statusLabel } = params;
  const { done, total } = countCompleted(
    photos.map((photo) => photo.itemKey),
    naItems,
  );

  return renderToBuffer(
    <Document title={`Install photo checklist - ${reference}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Install photo checklist</Text>
        <Text style={styles.subBrand}>{[customerName, address].filter(Boolean).join(" · ")}</Text>
        <Text style={styles.meta}>
          {reference} · {statusLabel} · {done}/{total} items · {photos.length} photo{photos.length === 1 ? "" : "s"}
        </Text>

        {CHECKLIST_STAGES.map((stage) => (
          <View key={stage.stage}>
            <Text style={styles.stageTitle}>{stage.title}</Text>
            {CHECKLIST_ITEMS.filter((item) => item.stage === stage.stage).map((item) => {
              const itemPhotos = photos.filter((photo) => photo.itemKey === item.key);
              const isNa = naItems.includes(item.key);
              return (
                <View key={item.key}>
                  <View style={styles.itemRow} wrap={false}>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                    {isNa ? (
                      <Text style={styles.statusNa}>N/A</Text>
                    ) : itemPhotos.length === 0 ? (
                      <Text style={styles.statusMissing}>MISSING</Text>
                    ) : null}
                  </View>
                  {itemPhotos.length > 0 && (
                    <View style={styles.photoGrid}>
                      {itemPhotos.map((photo) => {
                        const embeddable = photo.contentType === "image/jpeg" || photo.contentType === "image/png";
                        return (
                          <View key={photo.id} style={styles.photoTile} wrap={false}>
                            {embeddable ? (
                              // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's <Image> has no alt prop.
                              <Image src={photo.bytes} style={styles.photoImage} />
                            ) : (
                              <View style={styles.filePlaceholder}>
                                <Text style={styles.filePlaceholderText}>{photo.fileName}</Text>
                                <Text style={styles.filePlaceholderText}>Photo - view in portal</Text>
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
        ))}
      </Page>
    </Document>,
  );
}
