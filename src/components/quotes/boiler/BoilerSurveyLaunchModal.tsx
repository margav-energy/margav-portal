"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import QRCode from "qrcode";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { requestBoilerSurvey } from "@/components/quotes/actions";
import { BoilerSurveyAnswers } from "@/components/quotes/boiler/BoilerSurveyAnswers";
import type { BoilerSurveyDetail } from "@/types/boiler-survey";

/**
 * Opened from the "Survey" action button on `BoilerQuoteDetail`. When a
 * survey already exists for this quote, leads with its answers (so
 * re-clicking "Survey" on a completed one shows what was submitted,
 * instead of only offering to fill in a new one) — the QR/launch-link
 * section further down still lets the office resend the link if the
 * surveyor needs to go back and update something.
 *
 * The QR/launch flow itself mirrors the "scan or launch" pattern
 * surveyors are already used to — see the Spark reference screenshot this
 * was modelled on — but points at our own `/survey/[token]` form instead
 * of a third-party form builder.
 */
export function BoilerSurveyLaunchModal({
  quoteId,
  customerName,
  survey,
  documentUrl,
  onClose,
}: {
  quoteId: string;
  customerName: string;
  survey: BoilerSurveyDetail | undefined;
  /** Signed URL to the generated survey PDF (see `getSurveyDocumentUrl`) — present once a surveyor has submitted at least once. */
  documentUrl: string | undefined;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Already-submitted answers should be visible immediately on reopening
  // "Survey" rather than requiring an extra click — a still-pending survey
  // has nothing worth showing yet, so that case starts collapsed.
  const [showAnswers, setShowAnswers] = useState(survey?.status === "submitted");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { accessToken } = await requestBoilerSurvey(quoteId, customerName);
        if (cancelled) return;
        const fullUrl = `${window.location.origin}/survey/${accessToken}`;
        setUrl(fullUrl);
        const dataUrl = await QRCode.toDataURL(fullUrl, { margin: 1, width: 220 });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch (err) {
        console.error("BoilerSurveyLaunchModal load failed", err);
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

  return (
    <Modal title="Pre-Installation Survey" onClose={onClose}>
      {survey && (
        <div className="border-b border-slate-100">
          <button
            type="button"
            onClick={() => setShowAnswers((open) => !open)}
            className="flex w-full items-center justify-between px-6 py-4"
          >
            <div className="text-left">
              <p className="text-sm font-medium text-slate-900">
                {survey.answers.surveyorName ? `${survey.answers.surveyorName} · ` : ""}
                {survey.submittedAt ? formatDateTime(survey.submittedAt) : "Not yet submitted"}
              </p>
              <p className="text-xs text-slate-500">{showAnswers ? "Hide" : "View"} the submitted answers</p>
            </div>
            <div className="flex items-center gap-2">
              <Pill
                label={survey.status === "submitted" ? "Submitted" : "Pending"}
                className={survey.status === "submitted" ? "bg-brand-green-mid/10 text-brand-green-mid" : "bg-amber-100 text-amber-700"}
              />
              <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", showAnswers && "rotate-180")} />
            </div>
          </button>
          {showAnswers && (
            <div className="max-h-96 overflow-y-auto px-6 pb-5">
              {survey.status === "submitted" && documentUrl && (
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-4 inline-flex text-sm font-medium text-brand-blue hover:underline"
                >
                  Download survey PDF →
                </a>
              )}
              <BoilerSurveyAnswers answers={survey.answers} photos={survey.photos} />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col items-center gap-4 px-6 py-6 text-center">
        <p className="text-sm text-slate-500">
          {survey
            ? "Need to update it? Scan the QR code or launch the form again on this device."
            : "Scan the QR code with your phone camera to fill in the survey on-site, or launch it on this device."}
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
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button variant="primary" href={url ?? undefined} target="_blank" disabled={!url} className="flex-1 justify-center">
            Launch form →
          </Button>
          <Button variant="secondary" onClick={handleCopy} disabled={!url} className="flex-1 justify-center">
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>
      </div>
      <div className="flex justify-end border-t border-slate-100 px-5 py-4">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
