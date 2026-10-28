"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Camera,
  Check,
  FileText,
  Loader2,
  Upload,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { inputClassName } from "@/components/ui/FormField";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { compressPhoto } from "@/lib/compress-image";
import {
  clearDraft,
  useAutosaveDraft,
  useDraftRestore,
} from "@/hooks/useAutosaveDraft";
import {
  createSolarUploadUrl,
  registerSolarFile,
  removeSolarFile,
  saveSolarSurvey,
} from "@/app/survey/[token]/solar-actions";
import { SOLAR_SURVEY_BUCKET } from "@/lib/solar-survey-bucket";
import {
  ADDITIONAL_MEDIA_ITEMS,
  FILE_KIND_ACCEPT,
  FILE_KIND_BADGE,
  GENERAL_PHOTO_ITEMS,
  ROOF_LETTERS,
  ROOF_PHOTO_ITEMS,
  SOLAR_LOCATION_QUESTIONS,
  SOLAR_NOTES_QUESTIONS,
  SOLAR_PROPERTY_QUESTIONS,
  SOLAR_ROOF_QUESTIONS,
  VIDEO_ITEMS,
  findMissingRequired,
  isContentTypeAllowed,
  type SolarSurveyFileItem,
  type SolarSurveyQuestion,
} from "@/lib/solar-survey-fields";
import {
  applyTextFormat,
  formatMpan,
  formatName,
  formatPastedMpan,
  formatSolarSurveyAnswers,
  formatTitle,
} from "@/lib/solar-survey-format";
import type { PublicSolarSurvey } from "@/data/solar-survey-service";
import type {
  SolarSurveyAnswers,
  SolarSurveyFile,
  SolarSurveyRoof,
  SolarSurveyRoofKey,
} from "@/types/solar-survey";

/** Roof questions shown under the "Inside the roof" heading, after the roof photos. */
const INSIDE_ROOF_KEYS: SolarSurveyRoofKey[] = ["loftAccess", "notes"];

function RadioDot({
  selected,
  className,
}: {
  selected: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
        selected ? "border-brand-blue" : "border-slate-400",
        className,
      )}
    >
      {selected && <span className="h-2 w-2 rounded-full bg-brand-blue" />}
    </span>
  );
}

function Question({
  question,
  id,
  value,
  onChange,
  showError,
  otherValue,
  onOtherChange,
}: {
  question: SolarSurveyQuestion;
  id: string;
  value: string;
  onChange: (value: string) => void;
  showError: boolean;
  /** For a select with an "Other" option: the free-typed text shown in a box once "Other" is chosen. */
  otherValue?: string;
  onOtherChange?: (value: string) => void;
}) {
  const [touched, setTouched] = useState(false);
  const hasError = showError && question.required && !value.trim();
  const label = (
    <label htmlFor={id} className="text-sm font-medium text-slate-700">
      {question.label}
      {question.required && <span className="text-red-500"> *</span>}
      {!question.required && (
        <span className="ml-1.5 text-[10px] font-normal text-slate-400">
          Optional
        </span>
      )}
    </label>
  );
  const help = question.help && (
    <p className="text-xs text-slate-500">{question.help}</p>
  );
  const error = hasError && (
    <p className="text-xs text-red-600">This is required.</p>
  );

  // Illustrated options (roof shape / covering): label on top, a full-width tile grid, help underneath.
  if (question.type === "choice" && question.optionImages) {
    const images = question.optionImages;
    return (
      <div className="flex flex-col gap-2">
        {label}
        <div
          id={id}
          role="radiogroup"
          aria-label={question.label}
          className={cn(
            "grid grid-cols-2 gap-3",
            question.options.length > 6 ? "sm:grid-cols-5" : "sm:grid-cols-3",
          )}
        >
          {question.options.map((option) => {
            const selected = value === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                // Tapping the selected option again clears it.
                onClick={() => onChange(selected ? "" : option)}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-lg border px-2 pt-6 pb-3 text-xs font-medium transition-colors",
                  selected
                    ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                )}
              >
                <RadioDot
                  selected={selected}
                  className="absolute top-2 right-2"
                />
                {/* eslint-disable-next-line @next/next/no-img-element -- static illustration, no optimisation needed. */}
                <img
                  src={images[option]}
                  alt=""
                  className="h-20 w-auto max-w-full object-contain"
                />
                {option}
              </button>
            );
          })}
        </div>
        {help}
        {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0 sm:grid-cols-[2fr_3fr] sm:gap-6">
      <div className="flex flex-col gap-1 sm:pt-2">{label}</div>

      <div className="flex min-w-0 flex-col gap-1.5">
        {question.helpImage && (
          // eslint-disable-next-line @next/next/no-img-element -- static illustration, no optimisation needed.
          <img
            src={question.helpImage.src}
            alt={question.helpImage.alt}
            className="mb-1 w-full"
          />
        )}
        {question.type === "choice" && (
          <div
            id={id}
            role="radiogroup"
            aria-label={question.label}
            className="flex flex-wrap gap-2"
          >
            {question.options.map((option) => {
              const selected = value === option;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  // Tapping the selected option again clears it — optional questions need a way back to "unanswered".
                  onClick={() => onChange(selected ? "" : option)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    selected
                      ? "border-brand-blue bg-brand-blue/5 text-brand-blue"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  <RadioDot selected={selected} />
                  {option}
                </button>
              );
            })}
          </div>
        )}
        {question.type === "select" && (
          <select
            id={id}
            className={inputClassName}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">Select…</option>
            {/* Keeps a value saved before this became a dropdown (e.g. free-typed) from silently vanishing. */}
            {value && !question.options.includes(value) && (
              <option value={value}>{value}</option>
            )}
            {question.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}
        {question.type === "select" && value === "Other" && onOtherChange && (
          <>
            <input
              id={`${id}-other`}
              type="text"
              aria-label={`${question.label} (other)`}
              placeholder="Type your energy supplier"
              className={inputClassName}
              value={otherValue ?? ""}
              onChange={(e) => onOtherChange(e.target.value)}
              onBlur={() => onOtherChange(formatTitle(otherValue ?? ""))}
            />
            {showError && !(otherValue ?? "").trim() && (
              <p className="text-xs text-red-600">
                Please enter the supplier name.
              </p>
            )}
          </>
        )}
        {question.type === "text" && (
          <input
            id={id}
            type="text"
            className={inputClassName}
            value={value}
            // MPAN: numbers only, 13 digits — a phone shows the numeric keypad.
            inputMode={question.format === "mpan" ? "numeric" : undefined}
            maxLength={question.format === "mpan" ? 13 : undefined}
            onChange={(e) =>
              onChange(
                question.format === "mpan"
                  ? formatMpan(e.target.value)
                  : e.target.value,
              )
            }
            onPaste={
              question.format === "mpan"
                ? (e) => {
                    e.preventDefault();
                    onChange(formatPastedMpan(e.clipboardData.getData("text")));
                  }
                : undefined
            }
            // Capitalisation/whitespace is tidied once the user leaves the field, so typing never fights the cursor.
            onBlur={() => {
              setTouched(true);
              if (question.format)
                onChange(applyTextFormat(question.format, value));
            }}
          />
        )}
        {question.type === "textarea" && (
          <textarea
            id={id}
            rows={3}
            className={inputClassName}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={() => {
              if (question.format)
                onChange(applyTextFormat(question.format, value));
            }}
          />
        )}
        {question.format === "mpan" &&
          value.length > 0 &&
          value.length < 13 &&
          (touched || showError) && (
            <p className="text-xs text-red-600">
              MPAN must be exactly 13 digits ({value.length}/13 entered).
            </p>
          )}
        {error}
        {help}
      </div>
    </div>
  );
}

function ReadOnlyGrid({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-slate-500">{label}</dt>
          <dd className="mt-0.5 text-sm font-medium break-words text-slate-900">
            {value || "—"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SectionCard({
  number,
  title,
  subtitle,
  children,
}: {
  number: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-900">
          <span className="mr-2 text-slate-400">{number}</span>
          {title}
        </h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-col gap-4 p-4">{children}</div>
    </div>
  );
}

/** An upload in flight, or one that failed and can be retried. */
interface PendingUpload {
  id: string;
  itemKey: string;
  file: File;
  status: "uploading" | "error";
  error?: string;
}

function FileTile({
  file,
  localUrl,
  onRemove,
  onPreview,
  removing,
}: {
  file: SolarSurveyFile;
  /** `blob:` URL of the file as picked on this device — shown in preference to the signed URL, which is slower and can be empty. */
  localUrl?: string;
  onRemove: () => void;
  onPreview: () => void;
  removing: boolean;
}) {
  const isImage = file.contentType.startsWith("image/");
  const isVideo = file.contentType.startsWith("video/");
  // Some formats (e.g. an iPhone's HEIC photo) can't be drawn by most browsers — fall back to the file icon.
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = isImage && !imageFailed;

  return (
    <div className="relative flex h-20 w-20 shrink-0 flex-col items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={onPreview}
        aria-label={`Preview ${file.fileName}`}
        className="flex h-full w-full cursor-zoom-in flex-col items-center justify-center gap-1 px-1 text-center text-slate-500"
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL or local blob, not a static asset next/image can optimize.
          <img
            src={localUrl ?? file.url}
            alt={file.fileName}
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <>
            {isVideo ? (
              <Video className="h-5 w-5" />
            ) : (
              <FileText className="h-5 w-5" />
            )}
            <span className="line-clamp-2 w-full text-[10px] break-all">
              {file.fileName}
            </span>
          </>
        )}
      </button>
      {removing ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        </div>
      ) : (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${file.fileName}`}
          className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/** Full-size look at an uploaded photo / video / document. Closes on backdrop click, the X, or Escape. */
function PreviewLightbox({
  file,
  localUrl,
  onClose,
}: {
  file: SolarSurveyFile;
  localUrl?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const src = localUrl ?? file.url;
  const isImage = file.contentType.startsWith("image/");
  const isVideo = file.contentType.startsWith("video/");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className="flex max-h-full max-w-5xl flex-col items-center gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL or local blob.
          <img
            src={src}
            alt={file.fileName}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
          />
        ) : isVideo ? (
          <video
            src={src}
            controls
            autoPlay
            className="max-h-[80vh] max-w-full rounded-lg bg-black"
          />
        ) : (
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-white px-4 py-3 text-sm font-medium text-brand-blue"
          >
            Open {file.fileName} in a new tab
          </a>
        )}
        <p className="text-xs text-white/80">{file.fileName}</p>
      </div>
    </div>
  );
}

function PendingTile({
  upload,
  onDismiss,
  onRetry,
}: {
  upload: PendingUpload;
  onDismiss: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="relative flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1 text-center">
      {upload.status === "uploading" ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : (
        <button
          type="button"
          onClick={onRetry}
          title={upload.error}
          className="text-[10px] font-medium text-red-600 underline"
        >
          Failed — retry
        </button>
      )}
      <span className="line-clamp-1 w-full text-[10px] break-all text-slate-400">
        {upload.file.name}
      </span>
      {upload.status === "error" && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Dismiss ${upload.file.name}`}
          className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

const FILE_BUTTON_CLASS =
  "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium whitespace-nowrap text-slate-800 shadow-sm hover:bg-slate-50";

/** The "open the camera" buttons each kind of upload offers on a phone/tablet. */
const CAMERA_OPTIONS: Record<
  SolarSurveyFileItem["kind"],
  { label: string; accept: string }[]
> = {
  photos: [{ label: "Take photo", accept: "image/*" }],
  photos_video: [
    { label: "Take photo", accept: "image/*" },
    { label: "Record video", accept: "video/*" },
  ],
  video: [{ label: "Record video", accept: "video/*" }],
  files: [{ label: "Take photo", accept: "image/*" }],
};

/** Help text where `link.text` (if present in `text`) becomes an external link. */
function HelpText({
  text,
  link,
}: {
  text: string;
  link?: { text: string; href: string };
}) {
  const at = link ? text.indexOf(link.text) : -1;
  if (!link || at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-blue underline underline-offset-2 hover:opacity-80"
      >
        {link.text}
      </a>
      {text.slice(at + link.text.length)}
    </>
  );
}

function FileGroup({
  item,
  files,
  pending,
  removingIds,
  error,
  showError,
  onAdd,
  onRemove,
  onPreview,
  localUrls,
  onDismissPending,
  onRetryPending,
}: {
  item: SolarSurveyFileItem;
  files: SolarSurveyFile[];
  pending: PendingUpload[];
  removingIds: Record<string, boolean>;
  error: string | null;
  showError: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (file: SolarSurveyFile) => void;
  onPreview: (file: SolarSurveyFile) => void;
  localUrls: Record<string, string>;
  onDismissPending: (id: string) => void;
  onRetryPending: (id: string) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const total = files.length + pending.length;
  const isMissing = showError && item.required && files.length === 0;
  const isSingle = item.kind === "video";

  function addPicked(picked: File[]) {
    const allowed = picked.filter((file) =>
      isContentTypeAllowed(item.kind, file.type),
    );
    onAdd(isSingle ? allowed.slice(0, 1) : allowed);
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border bg-white p-4",
        isMissing ? "border-red-300" : "border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900">
            {item.label}
            {item.required && <span className="text-red-500"> *</span>}
          </p>
          {!item.required && (
            <span className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
              Optional
            </span>
          )}
        </div>
        <span className="shrink-0 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          {FILE_KIND_BADGE[item.kind]}
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        <HelpText text={item.help} link={item.helpLink} />
      </p>
      {isMissing && (
        <p className="mt-1 text-xs text-red-600">
          Please add at least one file.
        </p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          addPicked(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "mt-auto flex items-center justify-between gap-3 rounded-lg border border-dashed px-3 py-3 transition-colors",
          isDragging
            ? "border-brand-blue bg-brand-blue/5"
            : "border-slate-300 bg-slate-50",
          "mt-4",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <label className={FILE_BUTTON_CLASS}>
            <Upload className="h-3.5 w-3.5" />
            {isSingle ? "Choose file" : total > 0 ? "Add more" : "Add files"}
            {/* No `capture` here, so phones offer the photo gallery (with multi-select) as well as the camera. */}
            <input
              type="file"
              accept={FILE_KIND_ACCEPT[item.kind]}
              multiple={!isSingle}
              className="hidden"
              onChange={(e) => {
                addPicked(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
          {/* Straight to the camera. Shown on touch devices only — on a desktop `capture` is ignored and it would just duplicate "Add files". */}
          {CAMERA_OPTIONS[item.kind].map((option) => (
            <label
              key={option.label}
              className={cn(FILE_BUTTON_CLASS, "hidden pointer-coarse:flex")}
            >
              <Camera className="h-3.5 w-3.5" />
              {option.label}
              <input
                type="file"
                accept={option.accept}
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  addPicked(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
            </label>
          ))}
        </div>
        <span className="text-xs text-slate-500">
          {isSingle ? "or drop a file here" : "or drop files here"}
        </span>
      </div>

      {total > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((file) => (
            <FileTile
              key={file.id}
              file={file}
              localUrl={localUrls[file.id]}
              removing={!!removingIds[file.id]}
              onRemove={() => onRemove(file)}
              onPreview={() => onPreview(file)}
            />
          ))}
          {pending.map((upload) => (
            <PendingTile
              key={upload.id}
              upload={upload}
              onDismiss={() => onDismissPending(upload.id)}
              onRetry={() => onRetryPending(upload.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SolarSurveyForm({
  token,
  survey,
}: {
  token: string;
  survey: PublicSolarSurvey;
}) {
  // Autosaved locally so a closed tab or crashed browser doesn't lose a half-completed form.
  const draftKey = `solar-survey-draft-${token}`;
  const [answers, setAnswers] = useState<SolarSurveyAnswers>(survey.answers);
  const draftRestored = useDraftRestore<SolarSurveyAnswers>(
    draftKey,
    setAnswers,
  );
  const [files, setFiles] = useState<SolarSurveyFile[]>(survey.files);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  // `blob:` URLs for files picked on this device, keyed by file id — instant previews that don't depend on a signed URL.
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({});
  const [previewFile, setPreviewFile] = useState<SolarSurveyFile | null>(null);
  const [removingIds, setRemovingIds] = useState<Record<string, boolean>>({});
  const [itemErrors, setItemErrors] = useState<Record<string, string | null>>(
    {},
  );
  const [status, setStatus] = useState(survey.status);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useAutosaveDraft(draftKey, answers);

  // Roof A is always shown (at least one roof is required) so its questions are visible before the count is chosen.
  const roofCount = Math.min(Math.max(Number(answers.roofCount) || 1, 1), 3);
  const isUploading = pending.some((upload) => upload.status === "uploading");

  function set<K extends keyof SolarSurveyAnswers>(
    key: K,
    value: SolarSurveyAnswers[K],
  ) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function setRoof(index: number, key: SolarSurveyRoofKey, value: string) {
    setAnswers((current) => ({
      ...current,
      roofs: current.roofs.map((roof: SolarSurveyRoof, i: number) =>
        i === index ? { ...roof, [key]: value } : roof,
      ),
    }));
  }

  async function uploadOne(upload: {
    id: string;
    itemKey: string;
    file: File;
  }) {
    setItemErrors((current) => ({ ...current, [upload.itemKey]: null }));
    try {
      const target = await createSolarUploadUrl(
        token,
        upload.itemKey,
        upload.id,
        upload.file.name,
        upload.file.type,
      );
      if (!target.ok || !target.path || !target.uploadToken)
        throw new Error(target.error ?? "Could not start the upload.");

      const { error: uploadError } = await createClient()
        .storage.from(SOLAR_SURVEY_BUCKET)
        .uploadToSignedUrl(target.path, target.uploadToken, upload.file, {
          contentType: upload.file.type,
        });
      if (uploadError) throw new Error(uploadError.message || "Upload failed.");

      const registered = await registerSolarFile(
        token,
        upload.itemKey,
        upload.id,
        target.path,
        upload.file.name,
        upload.file.type,
        upload.file.size,
      );
      if (!registered.ok || !registered.file)
        throw new Error(registered.error ?? "Could not save the file.");

      setPending((current) => current.filter((p) => p.id !== upload.id));
      setFiles((current) => [
        ...current,
        {
          id: upload.id,
          itemKey: upload.itemKey,
          fileName: upload.file.name,
          contentType: upload.file.type,
          sizeBytes: upload.file.size,
          url: registered.file!.url,
          uploadedAt: registered.file!.uploadedAt,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      setPending((current) =>
        current.map((p) =>
          p.id === upload.id ? { ...p, status: "error", error: message } : p,
        ),
      );
    }
  }

  async function handleAddFiles(itemKey: string, picked: File[]) {
    for (const raw of picked) {
      // Downscaled before upload (videos / PDFs pass through untouched) — see compress-image.ts.
      const file = await compressPhoto(raw);
      const id = crypto.randomUUID();
      setLocalUrls((current) => ({
        ...current,
        [id]: URL.createObjectURL(file),
      }));
      setPending((current) => [
        ...current,
        { id, itemKey, file, status: "uploading" },
      ]);
      void uploadOne({ id, itemKey, file });
    }
  }

  function handleRetry(id: string) {
    const upload = pending.find((p) => p.id === id);
    if (!upload) return;
    setPending((current) =>
      current.map((p) =>
        p.id === id ? { ...p, status: "uploading", error: undefined } : p,
      ),
    );
    void uploadOne(upload);
  }

  async function handleRemove(file: SolarSurveyFile) {
    setRemovingIds((current) => ({ ...current, [file.id]: true }));
    try {
      await removeSolarFile(token, file.id);
      setFiles((current) => current.filter((f) => f.id !== file.id));
    } catch {
      setItemErrors((current) => ({
        ...current,
        [file.itemKey]: "Couldn't remove that file — please try again.",
      }));
    }
    setRemovingIds((current) => {
      const next = { ...current };
      delete next[file.id];
      return next;
    });
  }

  function renderFileGroup(item: SolarSurveyFileItem) {
    return (
      <FileGroup
        key={item.key}
        item={item}
        files={files.filter((f) => f.itemKey === item.key)}
        pending={pending.filter((p) => p.itemKey === item.key)}
        removingIds={removingIds}
        error={itemErrors[item.key] ?? null}
        showError={showErrors}
        onAdd={(picked) => void handleAddFiles(item.key, picked)}
        onRemove={(file) => void handleRemove(file)}
        onPreview={setPreviewFile}
        localUrls={localUrls}
        onDismissPending={(id) =>
          setPending((current) => current.filter((p) => p.id !== id))
        }
        onRetryPending={handleRetry}
      />
    );
  }

  function renderRoofQuestion(
    letter: string,
    index: number,
    question: (typeof SOLAR_ROOF_QUESTIONS)[number],
  ) {
    return (
      <Question
        key={question.key}
        id={`roof${letter}-${question.key}`}
        question={question}
        value={answers.roofs[index][question.key]}
        onChange={(value) => setRoof(index, question.key, value)}
        showError={showErrors}
      />
    );
  }

  function handleSave(submit: boolean) {
    setError(null);
    setSavedNotice(false);

    // Final tidy of every typed answer (same rules the server re-applies).
    const formatted = formatSolarSurveyAnswers(answers);
    setAnswers(formatted);

    if (submit) {
      const missingNow = findMissingRequired(
        formatted,
        new Set(files.map((f) => f.itemKey)),
      );
      setShowErrors(true);
      setMissing(missingNow);
      if (missingNow.length > 0) {
        setError("Please complete the required items before submitting.");
        return;
      }
      if (isUploading) {
        setError("Some files are still uploading — please wait a moment.");
        return;
      }
    }

    startTransition(async () => {
      try {
        const result = await saveSolarSurvey(token, formatted, submit);
        if (!result.ok) {
          setError(result.error ?? "Something went wrong — please try again.");
          if (result.missing) setMissing(result.missing);
          return;
        }
        if (submit) {
          clearDraft(draftKey);
          setStatus("submitted");
          setMissing([]);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          setSavedNotice(true);
        }
      } catch {
        setError(
          "Couldn't reach the server — check your connection and try again.",
        );
      }
    });
  }

  const { job } = survey;

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <div className="bg-slate-900 px-5 py-5 text-white">
        <div className="mx-auto w-full max-w-5xl">
          <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
            Pre-Installation Survey
          </p>
          <h1 className="mt-1 text-lg font-semibold">{job.customerName}</h1>
          <p className="mt-0.5 text-sm text-slate-300">
            {job.addressLines.join(", ")}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            Ref {job.reference} · Rep {job.repName}
            {job.phone ? ` · ${job.phone}` : ""}
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl">
        {status === "submitted" && (
          <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-brand-green-mid/30 bg-brand-green-mid/10 px-4 py-3 text-sm text-brand-green-mid">
            <Check className="h-4 w-4 shrink-0" />
            Thank you — this survey has been submitted. You can still make
            changes and resubmit.
          </div>
        )}

        {draftRestored && status !== "submitted" && (
          <div className="mx-4 mt-4 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Unsaved answers from your last session on this device were restored.
          </div>
        )}

        <div className="flex flex-col gap-4 px-4 py-4">
          <SectionCard number="01" title="Customer & job details">
            <ReadOnlyGrid
              rows={[
                ["Reference Number", job.reference],
                ["Rep Name", job.repName],
                ["First name", job.firstName],
                ["Last name", job.lastName],
                ["Phone", job.phone],
                ["Address line 1", job.address.line1],
                ["Address line 2", job.address.line2],
                ["Address line 3", job.address.line3],
                ["City", job.address.city],
                ["County", job.address.county],
                ["Postcode", job.address.postcode],
              ]}
            />
            <div className="border-t border-slate-100 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                Proposed solar installation
              </h3>
              <ReadOnlyGrid
                rows={[
                  ["Panel make/model", job.panelModel],
                  [
                    "Panel quantity",
                    job.panelQuantity ? String(job.panelQuantity) : "",
                  ],
                  ["Mounting system", job.mountingSystem],
                ]}
              />
            </div>
          </SectionCard>

          <SectionCard number="02" title="Property details">
            {SOLAR_PROPERTY_QUESTIONS.map((question) => (
              <Question
                key={question.key}
                id={question.key}
                question={question}
                value={answers[question.key]}
                onChange={(value) => set(question.key, value)}
                showError={showErrors}
                otherValue={
                  question.key === "energySupplier"
                    ? answers.energySupplierOther
                    : undefined
                }
                onOtherChange={
                  question.key === "energySupplier"
                    ? (value) => set("energySupplierOther", value)
                    : undefined
                }
              />
            ))}
          </SectionCard>

          {ROOF_LETTERS.slice(0, roofCount).map((letter, index) => (
            <SectionCard
              key={letter}
              number={`0${index + 3}`}
              title={`Roof ${letter}`}
              subtitle="Complete this section once for the roof, covering all of its panel arrays."
            >
              {SOLAR_ROOF_QUESTIONS.filter(
                (question) => !INSIDE_ROOF_KEYS.includes(question.key),
              ).map((question) => renderRoofQuestion(letter, index, question))}
              {renderFileGroup(ROOF_PHOTO_ITEMS[index])}
              <div className="border-t border-slate-100 pt-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  Inside the roof
                </h3>
              </div>
              {SOLAR_ROOF_QUESTIONS.filter((question) =>
                INSIDE_ROOF_KEYS.includes(question.key),
              ).map((question) => renderRoofQuestion(letter, index, question))}
            </SectionCard>
          ))}

          <SectionCard number="06" title="Key locations">
            {SOLAR_LOCATION_QUESTIONS.map((question) => (
              <Question
                key={question.key}
                id={question.key}
                question={question}
                value={answers[question.key]}
                onChange={(value) => set(question.key, value)}
                showError={showErrors}
              />
            ))}
          </SectionCard>

          <SectionCard number="07" title="General photo survey">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {GENERAL_PHOTO_ITEMS.map(renderFileGroup)}
            </div>
          </SectionCard>

          <SectionCard number="08" title="General video survey">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {VIDEO_ITEMS.map(renderFileGroup)}
            </div>
          </SectionCard>

          <SectionCard number="09" title="Additional images & videos">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {ADDITIONAL_MEDIA_ITEMS.map(renderFileGroup)}
            </div>
          </SectionCard>

          <SectionCard number="10" title="Notes">
            {SOLAR_NOTES_QUESTIONS.map((question) => (
              <Question
                key={question.key}
                id={question.key}
                question={question}
                value={answers[question.key]}
                onChange={(value) => set(question.key, value)}
                showError={showErrors}
              />
            ))}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_3fr] sm:gap-6">
              <label
                htmlFor="completedBy"
                className="text-sm font-medium text-slate-700"
              >
                Your name<span className="text-red-500"> *</span>
              </label>
              <div className="flex min-w-0 flex-col gap-1.5">
                <input
                  id="completedBy"
                  className={inputClassName}
                  value={answers.completedBy}
                  onChange={(e) => set("completedBy", e.target.value)}
                  onBlur={() =>
                    set("completedBy", formatName(answers.completedBy))
                  }
                />
                {showErrors && !answers.completedBy.trim() && (
                  <p className="text-xs text-red-600">This is required.</p>
                )}
              </div>
            </div>
          </SectionCard>

          {missing.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <p className="font-medium">Still needed before you can submit:</p>
              <ul className="mt-1 list-disc pl-5">
                {missing.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {previewFile && (
        <PreviewLightbox
          file={previewFile}
          localUrl={localUrls[previewFile.id]}
          onClose={() => setPreviewFile(null)}
        />
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white py-3">
        <div className="mx-auto w-full max-w-5xl px-4">
          {error && (
            <p className="mb-2 text-center text-sm text-red-600">{error}</p>
          )}
          {savedNotice && !error && (
            <p className="mb-2 text-center text-sm text-brand-green-mid">
              Progress saved.
            </p>
          )}
          {isUploading && !error && (
            <p className="mb-2 text-center text-xs text-slate-500">
              Uploading files — keep this page open…
            </p>
          )}
          <div className="flex gap-2">
            {status !== "submitted" && (
              <Button
                variant="secondary"
                className="flex-1 basis-0 justify-center py-3 text-sm"
                onClick={() => handleSave(false)}
                disabled={isPending}
              >
                Save progress
              </Button>
            )}
            <Button
              variant="success"
              className="flex-1 basis-0 justify-center py-3 text-sm"
              onClick={() => handleSave(true)}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : status === "submitted" ? (
                "Save changes"
              ) : (
                "Submit survey"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
