"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Trash2, UploadCloud } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/format";
import { deleteQuoteDocumentAction, uploadQuoteDocumentAction } from "@/app/quotes/[id]/documents-actions";
import type { QuoteDocument } from "@/data/quote-documents-service";

/**
 * Lets an admin/rep attach an arbitrary file to a quote — a filled-in
 * boiler quote PDF prepared outside the portal, a scanned signed copy,
 * anything worth keeping with the record. `router.refresh()` after upload
 * (rather than an optimistic local push) because a fresh signed download
 * URL only exists once the server's re-read the row — there's nothing
 * client-side to show immediately.
 */
export function QuoteDocumentsCard({
  quoteId,
  customerName,
  documents,
}: {
  quoteId: string;
  customerName: string;
  documents: QuoteDocument[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const router = useRouter();

  function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Choose a file to upload.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await uploadQuoteDocumentAction(quoteId, customerName, formData);
      if (result.error) {
        setError(result.error);
      } else {
        form.reset();
        router.refresh();
      }
    });
  }

  function handleDelete(documentId: string) {
    setError(null);
    setPendingDeleteId(documentId);
    startTransition(async () => {
      const result = await deleteQuoteDocumentAction(documentId, quoteId);
      if (result.error) setError(result.error);
      else router.refresh();
      setPendingDeleteId(null);
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
        <FileText className="h-4 w-4 text-slate-400" />
        Documents
      </h3>

      {documents.length === 0 ? (
        <p className="text-sm text-slate-500">No documents uploaded yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
            >
              <div className="min-w-0">
                {doc.url ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate font-medium text-brand-blue hover:underline"
                  >
                    {doc.filename}
                  </a>
                ) : (
                  <span className="block truncate text-slate-500">{doc.filename}</span>
                )}
                <p className="truncate text-xs text-slate-400">
                  {doc.uploadedByName ? `${doc.uploadedByName} · ` : ""}
                  {formatDateTime(doc.uploadedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(doc.id)}
                disabled={isPending}
                aria-label={`Remove ${doc.filename}`}
                className="shrink-0 text-slate-400 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              {isPending && pendingDeleteId === doc.id && <span className="sr-only">Removing…</span>}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <form onSubmit={handleUpload} className="flex flex-col gap-2">
        <input
          type="file"
          name="file"
          disabled={isPending}
          className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 disabled:opacity-50"
        />
        <Button type="submit" variant="secondary" disabled={isPending} className="gap-1.5">
          <UploadCloud className="h-4 w-4" />
          {isPending ? "Uploading…" : "Upload document"}
        </Button>
      </form>
    </Card>
  );
}
