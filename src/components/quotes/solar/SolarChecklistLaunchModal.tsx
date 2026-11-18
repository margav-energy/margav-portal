"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { requestInstallChecklistLink } from "@/components/quotes/actions";

/**
 * Opened from the "Checklist" action button on `SolarQuoteDetail` - the
 * install photo checklist's version of `SolarSurveyLaunchModal`. Left: the QR
 * code / launch link for `/checklist/[token]` (no login - the installer or
 * electrician opens it on their phone). Right: tools for what's been
 * uploaded - PDF, ZIP of the photos, an online read-only view and a gallery
 * (see `src/app/api/quotes/[id]/install-checklist/*` and
 * `src/app/quotes/[id]/checklist`).
 */
export function SolarChecklistLaunchModal({
  quoteId,
  customerName,
  photoCount,
  onClose,
}: {
  quoteId: string;
  customerName: string;
  photoCount: number;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { accessToken } = await requestInstallChecklistLink(quoteId, customerName);
        if (cancelled) return;
        const fullUrl = `${window.location.origin}/checklist/${accessToken}`;
        setUrl(fullUrl);
        const dataUrl = await QRCode.toDataURL(fullUrl, { margin: 1, width: 220 });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch (err) {
        console.error("SolarChecklistLaunchModal load failed", err);
        if (!cancelled) setError("Couldn't generate the checklist link. Please try again.");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [quoteId, customerName]);

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const toolsReady = url !== null;
  const hasPhotos = photoCount > 0;
  const apiBase = `/api/quotes/${quoteId}/install-checklist`;

  return (
    <Modal title="Install Photo Checklist" onClose={onClose} maxWidthClassName="max-w-4xl">
      <div className="grid grid-cols-1 gap-8 px-6 py-6 md:grid-cols-2">
        <section className="flex flex-col items-center gap-4 text-center">
          <h4 className="text-sm font-semibold text-slate-900">Launch form options</h4>
          <p className="max-w-sm text-sm text-slate-500">
            Scan the QR code with your phone camera to access this form on your mobile device, or just click{" "}
            <span className="font-medium text-slate-700">Launch form</span> to complete on your current device. No login is needed - whoever opens it
            says whether they&rsquo;re the installer or the electrician.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- locally generated data: URI, not a next/image candidate.
            <img src={qrDataUrl} alt="Checklist link QR code" className="h-56 w-56" />
          ) : (
            <div className="flex h-56 w-56 animate-pulse items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-400">
              Generating...
            </div>
          )}
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Button variant="primary" href={url ?? undefined} target="_blank" disabled={!url} className="w-full justify-center">
              Launch form →
            </Button>
            <Button variant="secondary" onClick={handleCopy} disabled={!url} className="w-full justify-center">
              {copied ? "Copied!" : "Copy link"}
            </Button>
          </div>
        </section>

        <section className="flex flex-col items-center gap-4 text-center">
          <h4 className="text-sm font-semibold text-slate-900">Download form tools</h4>
          <p className="max-w-sm text-sm text-slate-500">
            You can download the photos as a ZIP file, the checklist as a complete PDF document, or view online.
          </p>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Button
              variant="primary"
              href={`${apiBase}/pdf`}
              target="_blank"
              disabled={!toolsReady || !hasPhotos}
              title={hasPhotos ? undefined : "No photos have been uploaded yet"}
              className="w-full justify-center"
            >
              Download PDF
            </Button>
            <Button
              variant="primary"
              href={`${apiBase}/files`}
              target="_blank"
              disabled={!toolsReady || !hasPhotos}
              title={hasPhotos ? undefined : "No photos have been uploaded yet"}
              className="w-full justify-center"
            >
              Download files
            </Button>
            <Button variant="primary" href={`/quotes/${quoteId}/checklist`} target="_blank" disabled={!toolsReady} className="w-full justify-center">
              View online
            </Button>
            <Button
              variant="primary"
              href={`/quotes/${quoteId}/checklist/gallery`}
              target="_blank"
              disabled={!toolsReady || !hasPhotos}
              title={hasPhotos ? undefined : "No photos have been uploaded yet"}
              className="w-full justify-center"
            >
              View gallery
            </Button>
          </div>
        </section>
      </div>

      <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-5 py-4">
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
