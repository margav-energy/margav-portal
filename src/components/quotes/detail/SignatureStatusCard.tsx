import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { formatDateTime } from "@/lib/format";
import type { SignatureRequestSummary } from "@/data/signature-service";

const STATUS_STYLES: Record<SignatureRequestSummary["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  viewed: "bg-brand-blue/10 text-brand-blue",
  signed: "bg-brand-green-mid/10 text-brand-green-mid",
  declined: "bg-red-100 text-red-700",
  expired: "bg-slate-100 text-slate-500",
};

const STATUS_LABELS: Record<SignatureRequestSummary["status"], string> = {
  pending: "Sent, not yet opened",
  viewed: "Opened, not yet signed",
  signed: "Signed",
  declined: "Declined",
  expired: "Link expired",
};

/**
 * Product-agnostic (both boiler and solar quotes can be sent for
 * signature) — see `src/data/signature-service.ts`. Dropbox Sign never
 * surfaced signing status in-portal at all; this is new. Also reused for
 * the boiler-only Installation Agreement (see `title`/`emptyActionLabel`).
 */
export function SignatureStatusCard({
  title = "Signature",
  emptyActionLabel = "Send Quote",
  request,
  signedDocumentUrl,
}: {
  title?: string;
  emptyActionLabel?: string;
  request: SignatureRequestSummary | undefined;
  signedDocumentUrl: string | undefined;
}) {
  if (!request) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">
          Not sent for signature yet — click &ldquo;{emptyActionLabel}&rdquo; above.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <Pill label={STATUS_LABELS[request.status]} className={STATUS_STYLES[request.status]} />
      </div>
      <p className="mt-2 text-sm text-slate-600">
        {request.signerName} <span className="text-slate-400">({request.signerEmail})</span>
      </p>
      <p className="mt-1 text-xs text-slate-400">Sent {formatDateTime(request.sentAt)}</p>
      {request.status === "signed" && request.signedAt && (
        <p className="text-xs text-slate-400">Signed {formatDateTime(request.signedAt)}</p>
      )}
      {request.status === "declined" && (
        <p className="mt-1 text-xs text-red-600">
          {request.declineReason ? `Reason given: ${request.declineReason}` : "No reason given."}
        </p>
      )}
      {signedDocumentUrl && (
        <a
          href={signedDocumentUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-sm font-medium text-brand-blue hover:underline"
        >
          Download signed PDF →
        </a>
      )}
    </Card>
  );
}
