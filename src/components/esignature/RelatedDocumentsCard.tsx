import { FileText } from "lucide-react";
import { Card } from "@/components/ui/Card";

export interface RelatedDocumentLink {
  label: string;
  /** Omit while there's nothing to open yet (survey not submitted, agreement not sent) — renders as an inert status row instead of a link. */
  href?: string;
  statusLabel?: string;
}

/**
 * Cross-links to the *other* documents tied to this job — the boiler
 * survey and the Installation Agreement — so a quote doesn't read as an
 * island when there's more to the deal. Shown on both the internal "View
 * Quote" page (src/app/quotes/[id]/view/page.tsx, using authenticated
 * data) and the customer's /sign/[token] page (using the public/service-role
 * equivalents — see getPublicRelatedDocument, getPublicSurveyDocumentUrl).
 */
export function RelatedDocumentsCard({ documents }: { documents: RelatedDocumentLink[] }) {
  if (documents.length === 0) return null;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Related documents</h3>
      <div className="flex flex-col gap-2">
        {documents.map((doc) =>
          doc.href ? (
            <a
              key={doc.label}
              href={doc.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm hover:bg-slate-50"
            >
              <span className="flex items-center gap-2 text-slate-700">
                <FileText className="h-4 w-4 text-brand-blue" />
                {doc.label}
              </span>
              {doc.statusLabel && <span className="text-xs text-slate-400">{doc.statusLabel}</span>}
            </a>
          ) : (
            <div
              key={doc.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-400"
            >
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {doc.label}
              </span>
              {doc.statusLabel && <span className="text-xs">{doc.statusLabel}</span>}
            </div>
          ),
        )}
      </div>
    </Card>
  );
}
