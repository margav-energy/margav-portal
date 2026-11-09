"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  RotateCcw,
  Send,
  X,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { compressPhoto } from "@/lib/compress-image";
import { createClient } from "@/lib/supabase/client";
import { SOLAR_SURVEY_BUCKET } from "@/lib/solar-survey-bucket";
import {
  CHECKLIST_ITEMS,
  CHECKLIST_STAGES,
  countCompleted,
  countStageCompleted,
  type ChecklistItem,
} from "@/lib/solar-install-checklist";
import {
  createChecklistPhotoUploadUrl,
  registerChecklistPhoto,
  removeChecklistPhoto,
  setChecklistItemNotApplicable,
  submitInstallChecklist,
} from "@/app/jobs/checklist-actions";
import type {
  ChecklistPhoto,
  SolarInstallChecklist,
} from "@/data/solar-install-checklist-service";

interface PendingUpload {
  id: string;
  itemKey: string;
  file: File;
  status: "uploading" | "error";
  error?: string;
}

const BUTTON_CLASS =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50";

/**
 * "Solar Image Checklist.pdf" as a form: for each PRE / MID / POST item the
 * installer takes, uploads or selects one or more photos (or marks it N/A),
 * then submits the lot to the admins to check. Photos go straight from the
 * browser to Storage on a signed URL (see `createChecklistPhotoUploadUrl`),
 * after being shrunk with `compressPhoto`.
 */
export function InstallerChecklistCard({
  quoteId,
  initial,
}: {
  quoteId: string;
  initial: SolarInstallChecklist;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<ChecklistPhoto[]>(initial.photos);
  const [naItems, setNaItems] = useState<string[]>(initial.naItems);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState(initial.status);
  const [submittedAt, setSubmittedAt] = useState(initial.submittedAt);
  const [itemErrors, setItemErrors] = useState<Record<string, string | null>>(
    {},
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);

  const { done, total } = countCompleted(
    photos.map((photo) => photo.itemKey),
    naItems,
  );
  const isUploading = pending.some((upload) => upload.status === "uploading");

  // Any edit after a submission puts the checklist back to a draft that needs sending again (the server does the same).
  function markEdited() {
    setStatus("draft");
  }

  async function uploadOne(upload: PendingUpload) {
    setItemErrors((current) => ({ ...current, [upload.itemKey]: null }));
    setPending((current) =>
      current.map((p) =>
        p.id === upload.id
          ? { ...p, status: "uploading", error: undefined }
          : p,
      ),
    );
    try {
      const file = await compressPhoto(upload.file);
      const contentType = file.type || upload.file.type || "image/jpeg";
      const target = await createChecklistPhotoUploadUrl(
        quoteId,
        upload.itemKey,
        upload.id,
        file.name,
        contentType,
      );
      if (!target.ok || !target.path || !target.uploadToken)
        throw new Error(target.error ?? "Could not start the upload.");

      supabaseRef.current ??= createClient();
      const { error: uploadError } = await supabaseRef.current.storage
        .from(SOLAR_SURVEY_BUCKET)
        .uploadToSignedUrl(target.path, target.uploadToken, file, {
          contentType,
        });
      if (uploadError) throw new Error(uploadError.message || "Upload failed.");

      const registered = await registerChecklistPhoto(
        quoteId,
        upload.itemKey,
        upload.id,
        target.path,
        file.name,
        contentType,
        file.size,
      );
      if (!registered.ok || !registered.photo)
        throw new Error(registered.error ?? "Could not save the photo.");

      setPhotos((current) => [...current, registered.photo!]);
      setNaItems((current) => current.filter((key) => key !== upload.itemKey));
      setPending((current) => current.filter((p) => p.id !== upload.id));
      markEdited();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      setPending((current) =>
        current.map((p) =>
          p.id === upload.id ? { ...p, status: "error", error: message } : p,
        ),
      );
    }
  }

  function addFiles(itemKey: string, files: File[]) {
    const images = files.filter(
      (file) =>
        file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name),
    );
    if (images.length === 0) {
      if (files.length > 0)
        setItemErrors((current) => ({
          ...current,
          [itemKey]: "Only photos can be added here.",
        }));
      return;
    }
    const uploads: PendingUpload[] = images.map((file) => ({
      id: crypto.randomUUID(),
      itemKey,
      file,
      status: "uploading",
    }));
    setPending((current) => [...current, ...uploads]);
    uploads.forEach((upload) => void uploadOne(upload));
  }

  async function handleRemovePhoto(photo: ChecklistPhoto) {
    const previous = photos;
    setPhotos((current) => current.filter((p) => p.id !== photo.id));
    const result = await removeChecklistPhoto(quoteId, photo.id);
    if (!result.ok) {
      setPhotos(previous);
      setItemErrors((current) => ({
        ...current,
        [photo.itemKey]: result.error,
      }));
    } else markEdited();
  }

  async function handleToggleNa(item: ChecklistItem) {
    const makeNa = !naItems.includes(item.key);
    const previous = naItems;
    setNaItems(
      makeNa
        ? [...naItems, item.key]
        : naItems.filter((key) => key !== item.key),
    );
    const result = await setChecklistItemNotApplicable(
      quoteId,
      item.key,
      makeNa,
    );
    if (!result.ok) {
      setNaItems(previous);
      setItemErrors((current) => ({ ...current, [item.key]: result.error }));
    } else markEdited();
  }

  function handleSubmit() {
    setSubmitError(null);
    startSubmit(async () => {
      const result = await submitInstallChecklist(quoteId);
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      setStatus("submitted");
      setSubmittedAt(new Date().toISOString());
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Install photo checklist
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Take, upload or select one or more photos for each item — or mark it
            N/A — then send it to the office to check.
          </p>
        </div>
        <Pill
          label={status === "submitted" ? "Submitted" : `${done}/${total} done`}
          className={
            status === "submitted"
              ? "bg-brand-green-mid/10 text-brand-green-mid"
              : "bg-amber-100 text-amber-700"
          }
        />
      </div>

      {/* Step indicator — Pre → During → Post. Steps can be opened in any order (some photos, like serial numbers, get taken out of sequence); the ticks show which are finished. */}
      <ol className="grid grid-cols-3 gap-2">
        {CHECKLIST_STAGES.map((stage, index) => {
          const counts = countStageCompleted(
            stage.stage,
            photos.map((photo) => photo.itemKey),
            naItems,
          );
          const complete = counts.done === counts.total;
          const active = index === stepIndex;
          return (
            <li key={stage.stage}>
              <button
                type="button"
                onClick={() => setStepIndex(index)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex w-full flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-colors",
                  active
                    ? "border-brand-blue bg-brand-blue/5"
                    : "border-slate-200 bg-white hover:bg-slate-50",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      complete
                        ? "bg-brand-green-mid text-white"
                        : active
                          ? "bg-brand-blue text-white"
                          : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {complete ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      active ? "text-brand-blue" : "text-slate-700",
                    )}
                  >
                    {stage.title}
                  </span>
                </span>
                <span className="text-[11px] text-slate-500">
                  {counts.done}/{counts.total} done
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {(() => {
        const stage = CHECKLIST_STAGES[stepIndex];
        return (
          <section className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2 border-b border-slate-100 pb-1.5">
              <h4 className="text-xs font-semibold tracking-wide text-slate-900 uppercase">
                Step {stepIndex + 1} of {CHECKLIST_STAGES.length} ·{" "}
                {stage.title}
              </h4>
              <span className="text-xs text-slate-400">
                {stage.description}
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {CHECKLIST_ITEMS.filter((item) => item.stage === stage.stage).map(
                (item) => (
                  <ChecklistRow
                    key={item.key}
                    item={item}
                    photos={photos.filter(
                      (photo) => photo.itemKey === item.key,
                    )}
                    pending={pending.filter(
                      (upload) => upload.itemKey === item.key,
                    )}
                    isNa={naItems.includes(item.key)}
                    error={itemErrors[item.key] ?? null}
                    onAddFiles={(files) => addFiles(item.key, files)}
                    onRemovePhoto={handleRemovePhoto}
                    onToggleNa={() => void handleToggleNa(item)}
                    onRetry={(id) => {
                      const upload = pending.find((p) => p.id === id);
                      if (upload) void uploadOne(upload);
                    }}
                    onDismiss={(id) =>
                      setPending((current) =>
                        current.filter((p) => p.id !== id),
                      )
                    }
                  />
                ),
              )}
            </ul>
          </section>
        );
      })()}

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="secondary"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((i) => i - 1)}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        {stepIndex < CHECKLIST_STAGES.length - 1 && (
          <Button
            variant="primary"
            onClick={() => setStepIndex((i) => i + 1)}
            className="gap-1"
          >
            Next: {CHECKLIST_STAGES[stepIndex + 1].title}
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {stepIndex === CHECKLIST_STAGES.length - 1 && (
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-4">
          {status === "submitted" && submittedAt && (
            <p className="flex items-center gap-1.5 text-sm text-brand-green-mid">
              <CheckCircle2 className="h-4 w-4" />
              Sent to the office {formatDateTime(submittedAt)}. If you add or
              change anything you&rsquo;ll need to send it again.
            </p>
          )}
          {done < total && status !== "submitted" && (
            <p className="text-xs text-slate-500">
              {total - done} item{total - done === 1 ? "" : "s"} still to do.
              You can send it now, but the office will see what&rsquo;s missing.
            </p>
          )}
          {submitError && <p className="text-xs text-red-600">{submitError}</p>}
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || isUploading || status === "submitted"}
            className="w-full justify-center gap-1.5"
          >
            <Send className="h-4 w-4" />
            {isSubmitting
              ? "Sending…"
              : isUploading
                ? "Uploading photos…"
                : status === "submitted"
                  ? "Sent to the office"
                  : "Send to the office"}
          </Button>
        </div>
      )}
    </Card>
  );
}

function ChecklistRow({
  item,
  photos,
  pending,
  isNa,
  error,
  onAddFiles,
  onRemovePhoto,
  onToggleNa,
  onRetry,
  onDismiss,
}: {
  item: ChecklistItem;
  photos: ChecklistPhoto[];
  pending: PendingUpload[];
  isNa: boolean;
  error: string | null;
  onAddFiles: (files: File[]) => void;
  onRemovePhoto: (photo: ChecklistPhoto) => void;
  onToggleNa: () => void;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const hasPhotos = photos.length > 0;
  return (
    <li className="flex flex-col gap-2.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <CheckCircle2
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0",
              hasPhotos
                ? "text-brand-green-mid"
                : isNa
                  ? "text-slate-400"
                  : "text-slate-200",
            )}
          />
          <p
            className={cn(
              "text-sm",
              isNa ? "text-slate-400 line-through" : "text-slate-800",
            )}
          >
            {item.label}
          </p>
        </div>
        {isNa && (
          <Pill label="N/A" className="shrink-0 bg-slate-100 text-slate-500" />
        )}
        {hasPhotos && (
          <span className="shrink-0 text-xs text-slate-400">
            {photos.length} photo{photos.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {!isNa && (
        <div className="flex flex-wrap items-center gap-2 pl-6">
          {/* Straight to the camera — touch devices only; on a desktop `capture` is ignored and it would just duplicate "Add photos". */}
          <label
            className={cn(BUTTON_CLASS, "hidden pointer-coarse:inline-flex")}
          >
            <Camera className="h-3.5 w-3.5" />
            Take photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                onAddFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
          </label>
          {/* No `capture`, so phones offer the gallery (multi-select) as well as the camera. */}
          <label className={BUTTON_CLASS}>
            <ImagePlus className="h-3.5 w-3.5" />
            Add photos
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                onAddFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
          </label>
        </div>
      )}

      {(hasPhotos || pending.length > 0) && (
        <div className="flex flex-wrap gap-2 pl-6">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
            >
              <a
                href={photo.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${photo.fileName || "photo"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not a next/image candidate. */}
                <img
                  src={photo.url}
                  alt={photo.fileName || item.label}
                  className="h-full w-full object-cover"
                />
              </a>
              <button
                type="button"
                onClick={() => onRemovePhoto(photo)}
                aria-label={`Remove ${photo.fileName || "photo"}`}
                className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {pending.map((upload) => (
            <div
              key={upload.id}
              className="relative flex h-16 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center"
              title={upload.error}
            >
              {upload.status === "uploading" ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <button
                    type="button"
                    onClick={() => onRetry(upload.id)}
                    className="flex items-center gap-0.5 text-[10px] font-medium text-brand-blue"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismiss(upload.id)}
                    aria-label="Dismiss failed upload"
                    className="absolute top-0.5 right-0.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="pl-6 text-xs text-red-600">{error}</p>}

      {!hasPhotos && pending.length === 0 && (
        <div className="pl-6">
          <button
            type="button"
            onClick={onToggleNa}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline"
          >
            {isNa ? "Undo N/A" : "Mark as N/A"}
          </button>
        </div>
      )}
    </li>
  );
}
