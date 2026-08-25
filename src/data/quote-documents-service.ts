import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAllProfiles } from "@/data/profiles-service";
import { buildProfileMap } from "@/data/quotes-mappers";

/**
 * Data-access layer for admin/rep-uploaded files attached to a quote (see
 * supabase/migrations/0019_quote_documents.sql) — a filled-in boiler quote
 * PDF prepared outside the portal, a scanned signed copy, or anything else
 * worth keeping with the record. Separate from `signature-service.ts`,
 * which only ever holds PDFs the portal itself generated.
 */

const BUCKET = "quote-documents";

export interface QuoteDocument {
  id: string;
  filename: string;
  uploadedAt: string;
  uploadedByName: string | undefined;
  /** Short-lived signed URL — `undefined` if the file's gone missing from storage. */
  url: string | undefined;
}

interface QuoteDocumentRow {
  id: string;
  storage_path: string;
  original_filename: string;
  uploaded_by: string | null;
  uploaded_at: string;
}

export async function getQuoteDocuments(quoteId: string): Promise<QuoteDocument[]> {
  const supabase = await createClient();
  const [{ data, error }, profiles] = await Promise.all([
    supabase
      .from("quote_documents")
      .select("id, storage_path, original_filename, uploaded_by, uploaded_at")
      .eq("quote_id", quoteId)
      .order("uploaded_at", { ascending: false }),
    getAllProfiles(),
  ]);

  if (error) {
    console.error("getQuoteDocuments failed", error);
    return [];
  }

  const profileMap = buildProfileMap(profiles);
  const rows = (data ?? []) as QuoteDocumentRow[];

  return Promise.all(
    rows.map(async (row) => {
      const { data: signed, error: signError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(row.storage_path, 60 * 60);
      if (signError) console.error("getQuoteDocuments: createSignedUrl failed", signError);

      return {
        id: row.id,
        filename: row.original_filename,
        uploadedAt: row.uploaded_at,
        uploadedByName: row.uploaded_by ? profileMap.get(row.uploaded_by)?.fullName : undefined,
        url: signed?.signedUrl,
      };
    }),
  );
}
