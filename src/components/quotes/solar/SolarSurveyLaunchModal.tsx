"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { requestSolarSurvey } from "@/components/quotes/actions";
import type { SolarSurveyDetail } from "@/types/solar-survey";

/**
 * Opened from the "Survey" action button on `SolarQuoteDetail`. Left: the QR
 * code / launch link for `/survey/[token]`. Right: tools for the submitted
 * survey — PDF, ZIP of the uploads, an online read-only view and a gallery
 * (see `src/app/api/quotes/[id]/solar-survey/*` and
 * `src/app/quotes/[id]/survey`). The tools are enabled once the survey
 * record exists, which opening this modal guarantees (`requestSolarSurvey`).
 */
export function SolarSurveyLaunchModal({
  quoteId,
  customerName,
  survey,
  onClose,
}: {
  quoteId: string;
  customerName: string;
  survey: SolarSurveyDetail | undefined;
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
        const { accessToken } = await requestSolarSurvey(quoteId, customerName);
        if (cancelled) return;
        const fullUrl = `${window.location.origin}/survey/${accessToken}`;
        setUrl(fullUrl);
        const dataUrl = await QRCode.toDataURL(fullUrl, { margin: 1, width: 220 });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch (err) {
        console.error("SolarSurveyLaunchModal load failed", err);
        if (!cancelled) setError("Couldn't generate the survey link. Please try again.");
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
  const hasFiles = (survey?.files.length ?? 0) > 0;
  const apiBase = `/api/quotes/${quoteId}/solar-survey`;

  return (
    <Modal title="Pre-Installation Survey" onClose={onClose} maxWidthClassName="max-w-4xl">
      <div className="grid grid-cols-1 gap-8 px-6 py-6 md:grid-cols-2">
        <section className="flex flex-col items-center gap-4 text-center">
          <h4 className="text-sm font-semibold text-slate-900">Launch form options</h4>
          <p className="max-w-sm text-sm text-slate-500">
            Scan the QR code with your phone camera to access this form on your mobile device, or just click{" "}
            <span className="font-medium text-slate-700">Launch form</span> to complete on your current device.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- locally generated data: URI, not a next/image candidate.
            <img src={qrDataUrl} alt="Survey link QR code" className="h-56 w-56" />
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
            You can download the form images as a ZIP file, the form as a complete PDF document, or view online.
          </p>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Button variant="primary" href={`${apiBase}/pdf`} target="_blank" disabled={!toolsReady} className="w-full justify-center">
              Download PDF
            </Button>
            <Button
              variant="primary"
              href={`${apiBase}/files`}
              target="_blank"
              disabled={!toolsReady || !hasFiles}
              title={hasFiles ? undefined : "No files have been uploaded yet"}
              className="w-full justify-center"
            >
              Download files
            </Button>
            <Button variant="primary" href={`/quotes/${quoteId}/survey`} target="_blank" disabled={!toolsReady} className="w-full justify-center">
              View online
            </Button>
            <Button
              variant="primary"
              href={`/quotes/${quoteId}/survey/gallery`}
              target="_blank"
              disabled={!toolsReady || !hasFiles}
              title={hasFiles ? undefined : "No files have been uploaded yet"}
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
