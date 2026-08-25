import { formatDateTime } from "@/lib/format";
import type { QuoteDocument } from "@/data/quote-documents-service";

/**
 * The uploaded document as the main content of "View Quote" — an admin
 * uploading an actual filled-in quote (see QuoteDocumentsCard) means that
 * file, not our own generated layout, is the thing to actually read.
 * Full-bleed, no card chrome around it — "View Quote" itself already opens
 * in a new tab (see build-action-buttons.ts), so there's no separate
 * "open in new tab" control needed here on top of that, and no reason to
 * box the document down when the whole tab is already dedicated to it.
 * Embeds it inline — browsers render PDFs in an <iframe> natively, complete
 * with their own scrolling/zoom/page navigation; other file types just
 * show the browser's built-in "can't preview this" state.
 */
export function UploadedDocumentViewer({ document }: { document: QuoteDocument }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{document.filename}</p>
        <p className="text-xs text-slate-500">
          {document.uploadedByName ? `${document.uploadedByName} · ` : ""}
          {formatDateTime(document.uploadedAt)}
        </p>
      </div>

      {document.url ? (
        <iframe src={document.url} title={document.filename} className="h-[90vh] w-full border-0" />
      ) : (
        <p className="rounded-lg border border-slate-100 bg-slate-50 p-6 text-center text-sm text-slate-500">
          This file is no longer available.
        </p>
      )}
    </div>
  );
}
