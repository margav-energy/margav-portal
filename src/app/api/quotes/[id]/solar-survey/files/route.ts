import { NextResponse } from "next/server";
import { zipSync } from "fflate";
import { requireStaffUser } from "@/data/current-user";
import { getSolarSurveyBundle, loadSolarSurveyFileBytes } from "@/data/solar-survey-service";
import { getSolarFileItem } from "@/lib/solar-survey-fields";

/** "Download files" in the solar survey modal — every upload in one ZIP, grouped in a folder per question. Staff-only, same 404 rule as the PDF route. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser();
  const { id } = await params;

  const bundle = await getSolarSurveyBundle(id, user);
  if (!bundle) return NextResponse.json({ error: "Survey not found" }, { status: 404 });

  const files = await loadSolarSurveyFileBytes(bundle.survey.id);
  if (files.length === 0) return NextResponse.json({ error: "No files have been uploaded yet" }, { status: 404 });

  const entries: Record<string, Uint8Array> = {};
  for (const file of files) {
    const folder = (getSolarFileItem(file.itemKey)?.label ?? file.itemKey).replace(/[\\/:*?"<>|]/g, "-");
    const safeName = file.fileName.replace(/[\\/:*?"<>|]/g, "-");
    let path = `${folder}/${safeName}`;
    // Two uploads can share a name (e.g. a camera's "IMAGE.jpg") — keep both.
    if (path in entries) path = `${folder}/${file.id.slice(0, 6)}-${safeName}`;
    entries[path] = new Uint8Array(file.bytes);
  }

  // Photos/videos are already compressed, so store without deflating.
  const zip = zipSync(entries, { level: 0 });

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Pre-Installation-Survey-Files-${bundle.job.reference}.zip"`,
    },
  });
}
