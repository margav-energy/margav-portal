"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, type CurrentUser } from "@/data/current-user";
import { getCloudConvertClient } from "@/lib/cloudconvert";
import { logActivity } from "@/lib/activity";
import type { PresenterSlideType } from "@/data/presenter-deck-service";

/**
 * Mutations for the admin-uploaded Presenter sales deck. Reads live in
 * `src/data/presenter-deck-service.ts`. Upload → conversion is a two-step
 * flow (`uploadDeckAction` then polled `checkDeckConversionStatusAction`)
 * so neither Server Action call has to block for however long CloudConvert
 * takes to render every slide — the job id + the metadata needed to finish
 * the job are round-tripped through the client's component state between
 * the two calls rather than persisted server-side.
 */

async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("Only admins can manage the Presenter sales deck.");
  }
  return user;
}

export interface UploadDeckResult {
  jobId?: string;
  storagePath?: string;
  filename?: string;
  error?: string;
}

export async function uploadDeckAction(_prev: UploadDeckResult, formData: FormData): Promise<UploadDeckResult> {
  try {
    await requireAdmin();
  } catch (error) {
    return { error: (error as Error).message };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a .pptx file to upload." };
  }
  if (!file.name.toLowerCase().endsWith(".pptx")) {
    return { error: "Only .pptx files are supported." };
  }

  const arrayBuffer = await file.arrayBuffer();
  const storagePath = `${Date.now()}-${file.name}`;

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage.from("presenter-decks").upload(storagePath, arrayBuffer, {
    contentType: file.type || "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });

  if (uploadError) {
    console.error("uploadDeckAction storage upload failed", uploadError);
    return { error: "Could not upload the file. Please try again." };
  }

  try {
    const cloudConvert = getCloudConvertClient();
    const job = await cloudConvert.jobs.create({
      tasks: {
        "upload-deck": { operation: "import/upload" },
        "convert-deck": {
          operation: "convert",
          input: "upload-deck",
          output_format: "png",
          engine: "libreoffice",
        },
        "export-deck": { operation: "export/url", input: "convert-deck" },
      },
    });

    const uploadTask = job.tasks.find((task) => task.name === "upload-deck");
    if (!uploadTask) throw new Error("CloudConvert job is missing its upload task.");

    await cloudConvert.tasks.upload(uploadTask, Buffer.from(arrayBuffer), file.name);

    return { jobId: job.id, storagePath, filename: file.name };
  } catch (error) {
    console.error("uploadDeckAction CloudConvert job failed", error);
    return { error: "Could not start the conversion. Please try again." };
  }
}

export interface ConversionStatusResult {
  status: "processing" | "finished" | "error";
  message?: string;
  slideCount?: number;
  /** Present alongside "finished" — compare against slideCount to tell if some slides failed to download after retries. */
  expectedCount?: number;
}

/** CloudConvert names multi-page png output like "deck-1.png".."deck-12.png" — sort numerically, not lexically, so slide 10 doesn't land before slide 2. */
function slideNumberFromFilename(filename: string): number {
  return Number(filename.match(/(\d+)(?=\.\w+$)/)?.[1] ?? 0);
}

/** CloudConvert's export URLs are plain HTTP(S) links, no auth — flaky connections (ECONNRESET etc.) are common on larger downloads, so retry a few times before giving up on a slide. */
async function fetchWithRetry(url: string, attempts = 3): Promise<Response | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      console.error(`fetchWithRetry: ${url} responded ${response.status} (attempt ${attempt}/${attempts})`);
    } catch (error) {
      console.error(`fetchWithRetry: ${url} threw (attempt ${attempt}/${attempts})`, error);
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
  }
  return null;
}

export async function checkDeckConversionStatusAction(params: {
  jobId: string;
  storagePath: string;
  filename: string;
}): Promise<ConversionStatusResult> {
  let user: CurrentUser;
  try {
    user = await requireAdmin();
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }

  const cloudConvert = getCloudConvertClient();
  const job = await cloudConvert.jobs.get(params.jobId);

  if (job.status === "error") {
    return { status: "error", message: "Conversion failed — check the file and try again." };
  }
  if (job.status !== "finished") {
    return { status: "processing" };
  }

  const exportUrls = cloudConvert.jobs
    .getExportUrls(job)
    .slice()
    .sort((a, b) => slideNumberFromFilename(a.filename) - slideNumberFromFilename(b.filename));

  if (exportUrls.length === 0) {
    return { status: "error", message: "Conversion finished but produced no slides." };
  }

  const supabase = await createClient();

  // Inserted inactive — only promoted (and the previous deck retired) once
  // we know at least one slide made it, so a flaky download never leaves a
  // half-built deck live for reps to present from.
  const { data: deck, error: deckError } = await supabase
    .from("presenter_decks")
    .insert({
      uploaded_by: user.id,
      original_filename: params.filename,
      pptx_storage_path: params.storagePath,
      is_active: false,
    })
    .select("id")
    .single();

  if (deckError || !deck) {
    console.error("checkDeckConversionStatusAction deck insert failed", deckError);
    return { status: "error", message: "Conversion finished, but saving the deck failed. Please try again." };
  }

  let savedCount = 0;
  for (let i = 0; i < exportUrls.length; i++) {
    const exported = exportUrls[i];
    if (!exported.url) continue;

    try {
      const response = await fetchWithRetry(exported.url);
      if (!response) {
        console.error(`checkDeckConversionStatusAction: giving up on slide ${i + 1} — download kept failing`);
        continue;
      }

      const bytes = await response.arrayBuffer();
      const slideStoragePath = `${deck.id}/${i + 1}.png`;

      const { error: slideUploadError } = await supabase.storage
        .from("presenter-slides")
        .upload(slideStoragePath, bytes, { contentType: "image/png" });
      if (slideUploadError) {
        console.error("checkDeckConversionStatusAction slide upload failed", slideUploadError);
        continue;
      }

      await supabase.from("presenter_slides").insert({
        deck_id: deck.id,
        position: i + 1,
        slide_type: "image" satisfies PresenterSlideType,
        image_storage_path: slideStoragePath,
      });
      savedCount++;
    } catch (error) {
      // Never let one bad slide take the whole conversion down.
      console.error(`checkDeckConversionStatusAction: unexpected failure on slide ${i + 1}`, error);
    }
  }

  if (savedCount === 0) {
    await supabase.from("presenter_decks").delete().eq("id", deck.id);
    return { status: "error", message: "Conversion finished, but none of the slides could be saved. Please try again." };
  }

  await supabase.from("presenter_decks").update({ is_active: false }).eq("is_active", true);
  await supabase.from("presenter_decks").update({ is_active: true }).eq("id", deck.id);

  if (savedCount < exportUrls.length) {
    console.error(
      `checkDeckConversionStatusAction: only saved ${savedCount}/${exportUrls.length} slides for deck ${deck.id} — some downloads failed after retries`,
    );
  }

  await logActivity({
    actorId: user.id,
    customerName: "Presenter deck",
    description: `Uploaded a new Presenter sales deck (${params.filename}, ${savedCount}/${exportUrls.length} slides)`,
    status: "allocated",
    entityType: "presenter_deck",
    entityId: deck.id,
  });

  revalidatePath("/settings/presenter-deck");
  revalidatePath("/quotes", "layout");

  return { status: "finished", slideCount: savedCount, expectedCount: exportUrls.length };
}

export interface SetLiveSlidePositionResult {
  error?: string;
}

/** Removes any existing live quote-slide markers for the deck and re-inserts all 3 right after `afterPosition`. */
export async function setLiveSlidePositionAction(
  deckId: string,
  afterPosition: number,
): Promise<SetLiveSlidePositionResult> {
  try {
    await requireAdmin();
  } catch (error) {
    return { error: (error as Error).message };
  }

  const supabase = await createClient();

  await supabase.from("presenter_slides").delete().eq("deck_id", deckId).neq("slide_type", "image");

  const { data: toShift } = await supabase
    .from("presenter_slides")
    .select("id, position")
    .eq("deck_id", deckId)
    .gt("position", afterPosition)
    .order("position", { ascending: false });

  for (const row of toShift ?? []) {
    await supabase
      .from("presenter_slides")
      .update({ position: row.position + 3 })
      .eq("id", row.id);
  }

  const liveTypes: PresenterSlideType[] = ["quote_system_summary", "quote_pricing", "quote_monthly_cost"];
  const { error: insertError } = await supabase.from("presenter_slides").insert(
    liveTypes.map((slideType, index) => ({
      deck_id: deckId,
      position: afterPosition + index + 1,
      slide_type: slideType,
    })),
  );

  if (insertError) {
    console.error("setLiveSlidePositionAction insert failed", insertError);
    return { error: "Could not save the slide position. Please try again." };
  }

  revalidatePath("/settings/presenter-deck");
  revalidatePath("/quotes", "layout");
  return {};
}
