import "server-only";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getCurrentUser } from "@/data/current-user";

/**
 * A rep's own saved signature (Settings → "My signature") — drawn/typed
 * once, then stamped automatically onto every quote they're the assigned
 * rep for once the customer signs (see `src/data/signature-service.ts`'s
 * `performSignedSideEffects`). No per-quote signing step for the rep.
 */

export const PROFILE_SIGNATURES_BUCKET = "profile-signatures";

function signaturePathFor(profileId: string): string {
  return `${profileId}/signature.png`;
}

/** For the "My signature" card in Settings — a short-lived URL to preview the currently-saved signature, if any. */
export async function getMySignatureUrl(): Promise<string | undefined> {
  const user = await getCurrentUser();
  if (!user) return undefined;

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("signature_image_path")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.signature_image_path) return undefined;

  const { data: signed, error } = await supabase.storage
    .from(PROFILE_SIGNATURES_BUCKET)
    .createSignedUrl(profile.signature_image_path, 60 * 5);

  if (error || !signed) {
    console.error("getMySignatureUrl: createSignedUrl failed", error);
    return undefined;
  }
  return signed.signedUrl;
}

export async function saveMySignature(
  signatureImageDataUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in to do that." };

  const base64 = signatureImageDataUrl.replace(/^data:image\/png;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  const path = signaturePathFor(user.id);

  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(PROFILE_SIGNATURES_BUCKET)
    .upload(path, buffer, { contentType: "image/png", upsert: true });

  if (uploadError) {
    console.error("saveMySignature: upload failed", uploadError);
    return { ok: false, error: "Could not save your signature. Please try again." };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ signature_image_path: path })
    .eq("id", user.id);

  if (updateError) {
    console.error("saveMySignature: profile update failed", updateError);
    return { ok: false, error: "Could not save your signature. Please try again." };
  }

  revalidatePath("/settings");
  return { ok: true };
}

export async function clearMySignature(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be signed in to do that." };

  const supabase = await createClient();
  await supabase.storage.from(PROFILE_SIGNATURES_BUCKET).remove([signaturePathFor(user.id)]);
  const { error } = await supabase.from("profiles").update({ signature_image_path: null }).eq("id", user.id);

  if (error) {
    console.error("clearMySignature failed", error);
    return { ok: false, error: "Could not remove your signature. Please try again." };
  }

  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Raw image bytes (not a signed URL) for embedding into the final signed
 * PDF — called from `src/data/signature-service.ts` with the service-role
 * client, since that runs from the unauthenticated `/sign/[token]` flow.
 */
export async function getRepSignatureImageBytes(repId: string | null | undefined): Promise<Buffer | null> {
  if (!repId) return null;

  const supabase = createServiceRoleClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("signature_image_path")
    .eq("id", repId)
    .maybeSingle();

  if (!profile?.signature_image_path) return null;

  const { data, error } = await supabase.storage
    .from(PROFILE_SIGNATURES_BUCKET)
    .download(profile.signature_image_path);

  if (error || !data) {
    console.error("getRepSignatureImageBytes: download failed", error);
    return null;
  }

  return Buffer.from(await data.arrayBuffer());
}
