import { createHash } from "node:crypto";
import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { SOLAR_SURVEY_BUCKET } from "@/lib/solar-survey-bucket";
import { ensurePropertyPhotosBucketExists, PROPERTY_PHOTOS_BUCKET } from "@/data/property-photo-service";
import { downloadEasyPvFile, listEasyPvFiles } from "@/data/easypv-service";
import type { EasyPvFile } from "@/types/easypv";

/**
 * Copies a quote's Easy PV design images and proposal PDF into our private
 * bucket (supabase/migrations/0046_easypv_files.sql) so they survive changes
 * in Easy PV and open without an Easy PV login. Uses the service-role client,
 * so callers MUST have authorised the request for this quote first (see
 * `authorise` in src/components/quotes/easypv-actions.ts).
 */

const MAX_FILE_BYTES = 25 * 1024 * 1024;

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|~]/g, "-");
}

function contentTypeFor(name: string, reported: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return reported || "application/octet-stream";
}

/**
 * Sanitising can make two different Easy PV names identical ("A/B.jpg" and "A-B.jpg"), so a short hash of the
 * raw key keeps every file's storage object its own.
 */
function storagePathFor(quoteId: string, category: string, group: string, name: string): string {
  const hash = createHash("sha1").update(keyOf(category, group, name)).digest("hex").slice(0, 8);
  return `easypv/${quoteId}/${category}/${safeName(group)}/${hash}-${safeName(name)}`;
}

function keyOf(category: string, group: string, name: string): string {
  return `${category}|${group}|${name}`;
}

/** Brings our copies in line with what's in Easy PV now: new/changed files are downloaded, files Easy PV no longer has are removed. */
export async function syncEasyPvFiles(quoteId: string, projectId: number): Promise<{ added: number; removed: number }> {
  const supabase = createServiceRoleClient();
  const remote = await listEasyPvFiles(projectId);

  const { data: existingRows } = await supabase
    .from("easypv_files")
    .select("id, category, group_name, source_name, storage_path, source_modified_at")
    .eq("quote_id", quoteId);
  const existing = existingRows ?? [];
  const have = new Map(existing.map((row) => [keyOf(row.category, row.group_name, row.source_name), row]));
  const wanted = new Set(remote.map((file) => keyOf(file.category, file.groupName, file.name)));

  let added = 0;
  for (const file of remote) {
    const current = have.get(keyOf(file.category, file.groupName, file.name));
    const unchanged =
      current?.source_modified_at && file.modified && new Date(current.source_modified_at).getTime() === new Date(file.modified).getTime();
    if (current && unchanged) continue;

    try {
      const { bytes, contentType } = await downloadEasyPvFile(projectId, file.category, file.name);
      if (bytes.length === 0 || bytes.length > MAX_FILE_BYTES) continue;
      const path = storagePathFor(quoteId, file.category, file.groupName, file.name);
      const type = contentTypeFor(file.name, contentType);
      const { error: uploadError } = await supabase.storage.from(SOLAR_SURVEY_BUCKET).upload(path, bytes, { contentType: type, upsert: true });
      if (uploadError) {
        console.error("syncEasyPvFiles: upload failed", path, uploadError);
        continue;
      }
      const { error: rowError } = await supabase.from("easypv_files").upsert(
        {
          quote_id: quoteId,
          category: file.category,
          group_name: file.groupName,
          source_name: file.name,
          storage_path: path,
          content_type: type,
          size_bytes: bytes.length,
          source_modified_at: file.modified ?? null,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "quote_id,category,group_name,source_name" },
      );
      if (rowError) console.error("syncEasyPvFiles: row failed", rowError);
      else {
        added += 1;
        // A file stored under an older path scheme: drop the object it no longer uses.
        if (current && current.storage_path !== path) await supabase.storage.from(SOLAR_SURVEY_BUCKET).remove([current.storage_path]);
      }
    } catch (error) {
      console.error("syncEasyPvFiles: file failed", file.category, file.groupName, error);
    }
  }

  const stale = existing.filter((row) => !wanted.has(keyOf(row.category, row.group_name, row.source_name)));
  if (stale.length > 0) {
    // Never delete an object a live row still points at (older rows could share a sanitised path).
    const livePaths = new Set(existing.filter((row) => wanted.has(keyOf(row.category, row.group_name, row.source_name))).map((row) => row.storage_path));
    const orphaned = stale.map((row) => row.storage_path).filter((path) => !livePaths.has(path));
    if (orphaned.length > 0) await supabase.storage.from(SOLAR_SURVEY_BUCKET).remove(orphaned);
    await supabase.from("easypv_files").delete().in("id", stale.map((row) => row.id));
  }
  return { added, removed: stale.length };
}

/** Removes every stored Easy PV copy for a quote (used when the project is unlinked). Authorise the caller first. */
export async function clearEasyPvFiles(quoteId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data: rows, error } = await supabase.from("easypv_files").select("storage_path").eq("quote_id", quoteId);
  if (error) {
    console.error("clearEasyPvFiles failed", error);
    return false;
  }
  const { error: deleteError } = await supabase.from("easypv_files").delete().eq("quote_id", quoteId);
  if (deleteError) {
    console.error("clearEasyPvFiles: delete failed", deleteError);
    return false;
  }
  const paths = (rows ?? []).map((row) => row.storage_path);
  if (paths.length > 0) await supabase.storage.from(SOLAR_SURVEY_BUCKET).remove(paths);
  return true;
}

/**
 * Makes one of the stored Easy PV design views the quote's design image (the
 * "Solar design" card — `quotes.property_photo_path`). The previous image
 * is replaced and its object removed. Callers must have authorised the
 * request for this quote; the update uses the service role because a rep
 * refreshing from Easy PV isn't allowed to upload a solar design by hand.
 */
export async function setQuotePhotoFromEasyPvFile(quoteId: string, fileId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data: file } = await supabase
    .from("easypv_files")
    .select("source_name, storage_path, content_type")
    .eq("id", fileId)
    .eq("quote_id", quoteId)
    .eq("category", "images")
    .maybeSingle();
  if (!file || !file.content_type.startsWith("image/")) return false;

  const { data: blob, error: downloadError } = await supabase.storage.from(SOLAR_SURVEY_BUCKET).download(file.storage_path);
  if (downloadError || !blob) {
    console.error("setQuotePhotoFromEasyPvFile: download failed", downloadError);
    return false;
  }

  const { data: quote } = await supabase.from("quotes").select("property_photo_path").eq("id", quoteId).maybeSingle();
  const previousPath = quote?.property_photo_path ?? undefined;

  await ensurePropertyPhotosBucketExists();
  const extension = file.content_type === "image/png" ? "png" : "jpg";
  const photoPath = `${quoteId}/easypv-${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(PROPERTY_PHOTOS_BUCKET)
    .upload(photoPath, Buffer.from(await blob.arrayBuffer()), { contentType: file.content_type, upsert: true });
  if (uploadError) {
    console.error("setQuotePhotoFromEasyPvFile: upload failed", uploadError);
    return false;
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ property_photo_path: photoPath, property_photo_source: "easypv", easypv_photo_name: file.source_name })
    .eq("id", quoteId);
  if (updateError) {
    console.error("setQuotePhotoFromEasyPvFile: quote update failed", updateError);
    return false;
  }

  if (previousPath && previousPath !== photoPath) {
    await supabase.storage.from(PROPERTY_PHOTOS_BUCKET).remove([previousPath]);
  }
  return true;
}

/**
 * After a sync: if Easy PV has a design view newer than the one already
 * applied, make it the quote's image. A quote whose image was picked by hand
 * keeps it until Easy PV produces a *new* snapshot.
 */
export async function applyNewestDesignPhoto(quoteId: string): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: newest } = await supabase
    .from("easypv_files")
    .select("id, source_name")
    .eq("quote_id", quoteId)
    .eq("category", "images")
    .eq("content_type", "image/jpeg")
    .order("source_modified_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!newest) return;

  const { data: quote } = await supabase.from("quotes").select("easypv_photo_name").eq("id", quoteId).maybeSingle();
  if (quote?.easypv_photo_name === newest.source_name) return;
  await setQuotePhotoFromEasyPvFile(quoteId, newest.id);
}

/** Our stored copies, with signed URLs — authorise the caller for the quote first. */
export async function getEasyPvFiles(quoteId: string): Promise<EasyPvFile[]> {
  const supabase = createServiceRoleClient();
  const { data: rows, error } = await supabase
    .from("easypv_files")
    .select("id, category, group_name, source_name, storage_path, content_type, size_bytes")
    .eq("quote_id", quoteId)
    .order("source_modified_at", { ascending: false, nullsFirst: false });
  if (error) console.error("getEasyPvFiles failed", error);
  if (!rows || rows.length === 0) return [];

  const { data: signed } = await supabase.storage.from(SOLAR_SURVEY_BUCKET).createSignedUrls(
    rows.map((row) => row.storage_path),
    60 * 60,
  );
  const urlByPath = new Map((signed ?? []).map((item) => [item.path, item.signedUrl]));

  return rows.flatMap((row): EasyPvFile[] => {
    const url = urlByPath.get(row.storage_path);
    if (!url) return [];
    return [
      {
        id: row.id,
        category: row.category as "images" | "uploads",
        groupName: row.group_name,
        name: row.source_name,
        contentType: row.content_type,
        sizeBytes: Number(row.size_bytes),
        url,
      },
    ];
  });
}
