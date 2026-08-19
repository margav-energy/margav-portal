"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField, inputClassName } from "@/components/ui/FormField";
import {
  checkDeckConversionStatusAction,
  setLiveSlidePositionAction,
  uploadDeckAction,
  type UploadDeckResult,
} from "@/app/settings/presenter-deck/actions";

const UPLOAD_INITIAL_STATE: UploadDeckResult = {};
const POLL_INTERVAL_MS = 4000;

export interface DeckSummary {
  id: string;
  originalFilename: string;
  uploadedAt: string;
  imageSlideCount: number;
  /** Where the 3 live quote slides currently sit, or null if never configured. */
  liveSlidesAfterPosition: number | null;
}

export function PresenterDeckManager({ deck }: { deck: DeckSummary | null }) {
  const [uploadState, uploadFormAction, isUploading] = useActionState(uploadDeckAction, UPLOAD_INITIAL_STATE);
  // Terminal outcome of polling — while this is null but a job is in
  // flight, `displayStatus` below derives "processing" from that alone, so
  // the effect never needs to set state synchronously on its own. A fully
  // successful "finished" reloads immediately instead of landing here; this
  // only holds an error, or a "finished but some slides failed" warning
  // that needs to stay on screen for the admin to actually read.
  const [pollResult, setPollResult] = useState<
    { status: "error"; message?: string } | { status: "finished"; slideCount: number; expectedCount: number } | null
  >(null);

  useEffect(() => {
    if (!uploadState.jobId || !uploadState.storagePath || !uploadState.filename) return;
    const job = { jobId: uploadState.jobId, storagePath: uploadState.storagePath, filename: uploadState.filename };

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (cancelled) return;
      const result = await checkDeckConversionStatusAction(job);
      if (cancelled) return;

      if (result.status === "processing") {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }
      if (result.status === "finished") {
        const slideCount = result.slideCount ?? 0;
        const expectedCount = result.expectedCount ?? slideCount;
        if (slideCount >= expectedCount) {
          // Fully successful — full reload so the server component
          // re-fetches the new active deck.
          window.location.reload();
          return;
        }
        // Some slides failed to download even after retries — stay put and
        // let the admin decide whether to re-upload, rather than silently
        // reloading into an incomplete deck.
        setPollResult({ status: "finished", slideCount, expectedCount });
        return;
      }
      setPollResult({ status: "error", message: result.message ?? "Conversion failed." });
    }

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [uploadState.jobId, uploadState.storagePath, uploadState.filename]);

  const conversionStatus: "idle" | "processing" | "finished" | "error" =
    pollResult?.status ?? (uploadState.jobId ? "processing" : "idle");
  const conversionMessage = pollResult?.status === "error" ? pollResult.message : null;
  const isBusy = isUploading || conversionStatus === "processing";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-1 font-semibold text-slate-900">Current deck</h3>
        {deck ? (
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-900">{deck.originalFilename}</span> — {deck.imageSlideCount}{" "}
            slides, uploaded {new Date(deck.uploadedAt).toLocaleDateString("en-GB")}
          </p>
        ) : (
          <p className="text-sm text-slate-400">No sales deck uploaded yet.</p>
        )}
      </div>

      <form action={uploadFormAction} className="flex flex-col gap-3">
        <FormField label="Replace with" htmlFor="file">
          <input
            id="file"
            name="file"
            type="file"
            accept=".pptx"
            required
            disabled={isBusy}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-blue file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-blue/90 disabled:opacity-60"
          />
        </FormField>

        {uploadState.error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:ml-[196px]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {uploadState.error}
          </div>
        )}

        <div className="sm:ml-[196px]">
          <Button type="submit" disabled={isBusy} className="gap-1.5">
            <UploadCloud className="h-4 w-4" />
            {isUploading ? "Uploading…" : "Upload deck"}
          </Button>
        </div>
      </form>

      {conversionStatus === "processing" && (
        <p className="text-sm text-slate-500 sm:ml-[196px]">Converting slides — this can take a minute…</p>
      )}
      {conversionStatus === "error" && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:ml-[196px]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {conversionMessage}
        </div>
      )}
      {pollResult?.status === "finished" && (
        <div className="flex flex-col gap-3 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700 sm:ml-[196px]">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Only {pollResult.slideCount} of {pollResult.expectedCount} slides could be saved (some downloads failed —
            worth trying again).
          </div>
          <Button variant="secondary" className="w-fit" onClick={() => window.location.reload()}>
            Use it anyway
          </Button>
        </div>
      )}

      {deck && deck.imageSlideCount > 0 && (
        <LiveSlidePositionForm
          deckId={deck.id}
          imageSlideCount={deck.imageSlideCount}
          initialPosition={deck.liveSlidesAfterPosition ?? deck.imageSlideCount}
        />
      )}
    </div>
  );
}

function LiveSlidePositionForm({
  deckId,
  imageSlideCount,
  initialPosition,
}: {
  deckId: string;
  imageSlideCount: number;
  initialPosition: number;
}) {
  const [position, setPosition] = useState(initialPosition);
  const [state, setState] = useState<{ error?: string; saved?: boolean }>({});
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    setState({});
    const result = await setLiveSlidePositionAction(deckId, position);
    setIsSaving(false);
    setState(result.error ? { error: result.error } : { saved: true });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 pt-6">
      <h3 className="font-semibold text-slate-900">Quote slides</h3>
      <p className="text-sm text-slate-500">
        The 3 live quote slides (system summary, pricing, monthly cost) are inserted after this slide number in the
        uploaded deck — a rep fills in per-quote details on those when presenting.
      </p>
      <FormField label="Insert after slide" htmlFor="position">
        <input
          id="position"
          type="number"
          min={0}
          max={imageSlideCount}
          value={position}
          onChange={(event) => {
            setPosition(Number(event.target.value));
            setState({});
          }}
          className={inputClassName}
        />
      </FormField>
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:ml-[196px]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}
      {state.saved && (
        <div className="flex items-center gap-2 rounded-lg bg-brand-green-mid/10 px-3 py-2 text-sm text-brand-green-mid sm:ml-[196px]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Saved.
        </div>
      )}
      <div className="sm:ml-[196px]">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save position"}
        </Button>
      </div>
    </div>
  );
}
