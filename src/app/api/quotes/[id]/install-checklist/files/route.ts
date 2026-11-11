import { NextResponse } from "next/server";
import { zipSync } from "fflate";
import { getCurrentUser } from "@/data/current-user";
import { getInstallerJobDetail } from "@/data/installer-jobs-service";
import { getQuoteDetail } from "@/data/quotes-service";
import { loadChecklistPhotoBytes } from "@/data/solar-install-checklist-service";
import { CHECKLIST_ITEMS, CHECKLIST_STAGES, getChecklistItem } from "@/lib/solar-install-checklist";

const unsafe = /[\/:*?"<>|]/g;

/**
 * "Download" on the install photo checklist — a ZIP of the photos, one
 * folder per stage (and a sub-folder per checklist item). `?stage=pre|mid|post`
 * limits it to one stage; omit for everything. Used by both the office
 * (admin, or the rep who owns the quote) and the installer assigned to the job.
 * Anyone else gets the same 404 as a nonexistent quote.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await params;

  let reference: string | null | undefined;
  if (user.role === "installer") {
    const job = await getInstallerJobDetail(user.id, id);
    if (!job || job.productType === "boiler") return NextResponse.json({ error: "Not found" }, { status: 404 });
    reference = job.reference;
  } else {
    const result = await getQuoteDetail(id);
    if (!result || (user.role === "rep" && result.detail.assignedRepId !== user.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    reference = result.detail.reference;
  }

  const stageParam = new URL(request.url).searchParams.get("stage");
  const stage = CHECKLIST_STAGES.find((s) => s.stage === stageParam);
  if (stageParam && stageParam !== "all" && !stage) return NextResponse.json({ error: "Unknown stage" }, { status: 400 });

  const keys = stage ? CHECKLIST_ITEMS.filter((item) => item.stage === stage.stage).map((item) => item.key) : undefined;
  const photos = await loadChecklistPhotoBytes(id, keys);
  if (photos.length === 0) return NextResponse.json({ error: "No photos have been uploaded yet" }, { status: 404 });

  const entries: Record<string, Uint8Array> = {};
  for (const photo of photos) {
    const item = getChecklistItem(photo.itemKey);
    const stageTitle = CHECKLIST_STAGES.find((s) => s.stage === item?.stage)?.title ?? "Other";
    const folder = `${stageTitle}/${(item?.label ?? photo.itemKey).replace(unsafe, "-").slice(0, 80)}`;
    const safeName = photo.fileName.replace(unsafe, "-");
    let path = `${folder}/${safeName}`;
    // Two uploads can share a name (e.g. a camera's "IMAGE.jpg") — keep both.
    if (path in entries) path = `${folder}/${photo.id.slice(0, 6)}-${safeName}`;
    entries[path] = new Uint8Array(photo.bytes);
  }

  const label = stage ? stage.title : "All";
  return new NextResponse(new Uint8Array(zipSync(entries, { level: 0 })), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Install-Photos-${label}-${(reference ?? id).replace(unsafe, "-")}.zip"`,
    },
  });
}
