import { createClient } from "@/lib/supabase/server";

/**
 * Reads for the admin-uploaded Presenter sales deck
 * (`supabase/migrations/0005_presenter_decks.sql`). Mutations (upload,
 * conversion, positioning the live quote slides) live in
 * `src/app/settings/presenter-deck/actions.ts`.
 */

export type PresenterSlideType = "image" | "quote_system_summary" | "quote_pricing" | "quote_monthly_cost";

export interface PresenterSlideRow {
  id: string;
  position: number;
  slideType: PresenterSlideType;
  /** Signed URL, resolved here — only present for slideType "image". */
  imageUrl?: string;
}

export interface PresenterDeck {
  id: string;
  originalFilename: string;
  uploadedAt: string;
  slides: PresenterSlideRow[];
}

const SLIDE_IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour — plenty for one presenting session

interface PresenterDeckRow {
  id: string;
  original_filename: string;
  created_at: string;
}

interface PresenterSlideDbRow {
  id: string;
  position: number;
  slide_type: PresenterSlideType;
  image_storage_path: string | null;
}

export async function getActivePresenterDeck(): Promise<PresenterDeck | null> {
  const supabase = await createClient();

  const { data: deck } = await supabase
    .from("presenter_decks")
    .select("id, original_filename, created_at")
    .eq("is_active", true)
    .maybeSingle<PresenterDeckRow>();

  if (!deck) return null;

  const { data: slideRows } = await supabase
    .from("presenter_slides")
    .select("id, position, slide_type, image_storage_path")
    .eq("deck_id", deck.id)
    .order("position", { ascending: true })
    .returns<PresenterSlideDbRow[]>();

  const slides: PresenterSlideRow[] = await Promise.all(
    (slideRows ?? []).map(async (row) => {
      if (row.slide_type !== "image" || !row.image_storage_path) {
        return { id: row.id, position: row.position, slideType: row.slide_type };
      }
      const { data: signed } = await supabase.storage
        .from("presenter-slides")
        .createSignedUrl(row.image_storage_path, SLIDE_IMAGE_SIGNED_URL_TTL_SECONDS);
      return { id: row.id, position: row.position, slideType: row.slide_type, imageUrl: signed?.signedUrl };
    }),
  );

  return {
    id: deck.id,
    originalFilename: deck.original_filename,
    uploadedAt: deck.created_at,
    slides,
  };
}
