"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Camera, Check, Clock, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { cn } from "@/lib/utils";
import { removeSurveyPhoto, submitBoilerSurvey, uploadSurveyPhoto } from "@/app/survey/[token]/actions";
import { BOILER_SURVEY_SECTIONS, type BoilerSurveyFieldConfig } from "@/lib/boiler-survey-fields";
import { PHOTO_CHECKLIST_ITEMS, type BoilerSurveyAnswers, type BoilerSurveyPhoto, type PhotoChecklistItemKey } from "@/types/boiler-survey";
import type { PublicBoilerSurvey } from "@/data/boiler-survey-service";
import { clearDraft, useAutosaveDraft, useDraftRestore } from "@/hooks/useAutosaveDraft";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { compressPhoto } from "@/lib/compress-image";
import {
  clearPendingSubmit,
  getPendingSubmit,
  listPendingPhotos,
  queuePendingPhoto,
  queuePendingSubmit,
  removePendingPhoto,
  type PendingPhoto,
} from "@/lib/survey-offline-queue";

function Field({
  field,
  value,
  onChange,
}: {
  field: BoilerSurveyFieldConfig;
  value: string | number | null;
  onChange: (value: string | number | null) => void;
}) {
  const id = field.key;

  if (field.type === "select") {
    return (
      <FormField label={field.label} htmlFor={id}>
        <select id={id} className={inputClassName} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {/* Preserves a pre-existing free-text value entered before this became a dropdown, so it isn't silently wiped. */}
          {value && !field.options.includes(value as string) && <option value={value as string}>{value as string}</option>}
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </FormField>
    );
  }

  if (field.type === "textarea") {
    return (
      <FormField label={field.label} htmlFor={id}>
        <textarea
          id={id}
          rows={2}
          className={inputClassName}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </FormField>
    );
  }

  if (field.type === "number") {
    return (
      <FormField label={field.label} htmlFor={id}>
        <input
          id={id}
          type="number"
          min={0}
          inputMode="numeric"
          className={inputClassName}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      </FormField>
    );
  }

  return (
    <FormField label={field.label} htmlFor={id}>
      <input id={id} type="text" className={inputClassName} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
    </FormField>
  );
}

/** A photo picked/queued on this device that hasn't been confirmed uploaded yet. */
interface LocalPhoto {
  /** Generated up front (`crypto.randomUUID()`) — becomes `boiler_survey_photos.id` once it uploads, so a retry never creates a duplicate. */
  id: string;
  itemKey: PhotoChecklistItemKey;
  file: File;
  /** Local `blob:` URL (`URL.createObjectURL`) — shown before this has ever reached the server. */
  previewUrl: string;
  status: "uploading" | "queued" | "error";
  error?: string;
}

function PhotoThumbnail({
  label,
  previewUrl,
  status,
  error,
  onRemove,
  onRetry,
}: {
  label: string;
  previewUrl: string;
  status: "uploaded" | "uploading" | "queued" | "error";
  error?: string;
  onRemove: () => void;
  onRetry?: () => void;
}) {
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-slate-200">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL or a local blob: preview, not a static asset next/image can optimize. */}
      <img src={previewUrl} alt={label} className="h-full w-full object-cover" />
      {status === "uploading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        </div>
      )}
      {status === "queued" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40" title="Queued — will upload when you're back online.">
          <Clock className="h-4 w-4 text-amber-300" />
        </div>
      )}
      {status === "error" && (
        <button
          type="button"
          onClick={onRetry}
          aria-label={`Retry uploading photo for ${label}`}
          title={error ?? "Upload failed — tap to retry"}
          className="absolute inset-0 flex items-center justify-center bg-red-600/70 text-white"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      )}
      {status !== "uploading" && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove photo for ${label}`}
          className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/**
 * One checklist item, now able to hold any number of photos rather than
 * exactly one — "Add another" stays available even once photos exist.
 * Upload/queue/retry logic lives in `SurveyForm` (`handlePhotoFile`/
 * `tryUploadPhoto`) since it has to be reachable from the offline-queue
 * flush too, not just this item's own file input.
 */
function PhotoItemGroup({
  label,
  confirmedPhotos,
  localPhotos,
  removingIds,
  error,
  onAddFile,
  onRemoveConfirmed,
  onRemoveLocal,
  onRetryLocal,
}: {
  label: string;
  confirmedPhotos: BoilerSurveyPhoto[];
  localPhotos: LocalPhoto[];
  removingIds: Record<string, boolean>;
  error: string | null;
  onAddFile: (file: File) => void;
  onRemoveConfirmed: (photo: BoilerSurveyPhoto) => void;
  onRemoveLocal: (id: string) => void;
  onRetryLocal: (id: string) => void;
}) {
  const totalCount = confirmedPhotos.length + localPhotos.length;

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-700">{label}</p>
          <p className="mt-0.5 text-xs text-slate-400">{totalCount === 0 ? "No photos yet" : `${totalCount} photo${totalCount === 1 ? "" : "s"}`}</p>
          {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-slate-700 hover:bg-slate-200">
          <Camera className="h-3.5 w-3.5" />
          {totalCount > 0 ? "Add another" : "Add photo"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onAddFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {totalCount > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {confirmedPhotos.map((photo) => (
            <PhotoThumbnail
              key={photo.id}
              label={label}
              previewUrl={photo.url}
              status={removingIds[photo.id] ? "uploading" : "uploaded"}
              onRemove={() => onRemoveConfirmed(photo)}
            />
          ))}
          {localPhotos.map((photo) => (
            <PhotoThumbnail
              key={photo.id}
              label={label}
              previewUrl={photo.previewUrl}
              status={photo.status}
              error={photo.error}
              onRemove={() => onRemoveLocal(photo.id)}
              onRetry={() => onRetryLocal(photo.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SurveyForm({ token, survey }: { token: string; survey: PublicBoilerSurvey }) {
  // Autosaved locally so a crashed/restarted device or a closed tab doesn't wipe out
  // everything typed since the last submit — this form is often filled in over a long
  // on-site session. Keyed by token so different survey links never collide.
  const draftKey = `survey-draft-${token}`;
  const [answers, setAnswers] = useState<BoilerSurveyAnswers>(survey.answers);
  const draftRestored = useDraftRestore<BoilerSurveyAnswers>(draftKey, setAnswers);
  const [photos, setPhotos] = useState<BoilerSurveyPhoto[]>(survey.photos);
  const [status, setStatus] = useState(survey.status);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isOnline = useOnlineStatus();

  // Photos picked on this device that aren't confirmed-uploaded yet — mid-upload,
  // queued offline, or failed. See `LocalPhoto`'s doc comment.
  const [localPhotos, setLocalPhotos] = useState<LocalPhoto[]>([]);
  // Confirmed (server-saved) photos currently being deleted, keyed by photo id.
  const [removingIds, setRemovingIds] = useState<Record<string, boolean>>({});
  // A transient error message per checklist item (e.g. "couldn't remove while offline").
  const [itemErrors, setItemErrors] = useState<Record<string, string | null>>({});
  // Whether the last "Submit survey" attempt failed to reach the server and was queued for retry.
  const [submitQueued, setSubmitQueued] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const hasQueuedItems = localPhotos.some((p) => p.status === "queued") || submitQueued;

  useAutosaveDraft(draftKey, answers);

  function set<K extends keyof BoilerSurveyAnswers>(key: K, value: BoilerSurveyAnswers[K]) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  const updateLocalPhoto = useCallback((id: string, patch: Partial<LocalPhoto>) => {
    setLocalPhotos((current) => current.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const removeLocalPhoto = useCallback((id: string) => {
    setLocalPhotos((current) => {
      const entry = current.find((p) => p.id === id);
      if (entry) URL.revokeObjectURL(entry.previewUrl);
      return current.filter((p) => p.id !== id);
    });
  }, []);

  /**
   * Tries to upload one photo; on a network failure (no signal) it queues the
   * file locally instead of surfacing an error, so the rep can keep going.
   * A real server-side rejection (bad file, invalid token) is NOT queued —
   * retrying it later wouldn't help, so it's left as a dismissible/retryable
   * error tile instead.
   */
  const tryUploadPhoto = useCallback(
    async (photo: { id: string; itemKey: PhotoChecklistItemKey; file: File }): Promise<"uploaded" | "rejected" | "offline"> => {
      const formData = new FormData();
      formData.set("file", photo.file);
      try {
        const result = await uploadSurveyPhoto(token, photo.itemKey, photo.id, formData);
        if (!result.ok || !result.photo) {
          await removePendingPhoto(photo.id);
          updateLocalPhoto(photo.id, { status: "error", error: result.error ?? "Upload failed." });
          return "rejected";
        }
        await removePendingPhoto(photo.id);
        removeLocalPhoto(photo.id);
        setPhotos((current) => [...current, { id: result.photo!.id, itemKey: photo.itemKey, url: result.photo!.url, uploadedAt: result.photo!.uploadedAt }]);
        return "uploaded";
      } catch {
        await queuePendingPhoto(token, photo.id, photo.itemKey, photo.file);
        updateLocalPhoto(photo.id, { status: "queued", error: undefined });
        return "offline";
      }
    },
    [token, updateLocalPhoto, removeLocalPhoto],
  );

  const trySubmit = useCallback(
    async (answersToSubmit: BoilerSurveyAnswers): Promise<boolean> => {
      try {
        const result = await submitBoilerSurvey(token, answersToSubmit);
        if (!result.ok) {
          setError(result.error ?? "Something went wrong — please try again.");
          return false;
        }
        await clearPendingSubmit(token);
        setSubmitQueued(false);
        clearDraft(draftKey);
        setStatus("submitted");
        setError(null);
        return true;
      } catch {
        await queuePendingSubmit(token, answersToSubmit);
        setSubmitQueued(true);
        return false;
      }
    },
    [token, draftKey],
  );

  // Retries everything queued on this device — photos first (the final submit's
  // PDF regen needs them all in place), then a queued submit once every photo
  // is through. Called on mount (in case the page was reopened after being
  // closed offline) and on the browser's `online` event.
  //
  // `force` skips the `navigator.onLine` short-circuit — used by the manual
  // "Sync now" button, since `navigator.onLine`/the `online` event are known
  // to be unreliable on mobile (especially a backgrounded tab), so there
  // needs to be a way to just try regardless of what the browser claims.
  const flushQueue = useCallback(
    async (options?: { force?: boolean }) => {
      if (!options?.force && typeof navigator !== "undefined" && !navigator.onLine) return;
      setIsSyncing(true);
      try {
        const queued = await listPendingPhotos(token);
        let allSynced = true;
        for (const pending of queued) {
          updateLocalPhoto(pending.id, { status: "uploading" });
          const result = await tryUploadPhoto(pending);
          if (result === "offline") {
            allSynced = false;
            break; // connectivity dropped again mid-sync — stop, the rest stay queued for next time
          }
        }
        if (allSynced) {
          const queuedAnswers = await getPendingSubmit(token);
          if (queuedAnswers) await trySubmit(queuedAnswers);
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [token, tryUploadPhoto, trySubmit, updateLocalPhoto],
  );

  // Hydrate from anything already queued on this device (e.g. the rep closed
  // the tab while offline and reopened the link later), then try to sync
  // straight away in case signal is already back.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [queued, queuedAnswers] = await Promise.all([listPendingPhotos(token), getPendingSubmit(token)]);
      if (cancelled) return;
      if (queued.length > 0) {
        setLocalPhotos((current) => {
          const existingIds = new Set(current.map((p) => p.id));
          const additions: LocalPhoto[] = queued
            .filter((q: PendingPhoto) => !existingIds.has(q.id))
            .map((q: PendingPhoto) => ({ id: q.id, itemKey: q.itemKey, file: q.file, previewUrl: URL.createObjectURL(q.file), status: "queued" as const }));
          return [...current, ...additions];
        });
      }
      if (queuedAnswers) setSubmitQueued(true);
      if (queued.length > 0 || queuedAnswers) void flushQueue();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per token on mount to hydrate + attempt an initial sync
  }, [token]);

  useEffect(() => {
    function handleOnline() {
      void flushQueue();
    }
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flushQueue]);

  async function handlePhotoFile(itemKey: PhotoChecklistItemKey, rawFile: File) {
    setItemErrors((current) => ({ ...current, [itemKey]: null }));
    // Downscaled before it ever reaches an upload attempt or the offline queue —
    // see compress-image.ts's doc comment for why (upload size + IndexedDB footprint).
    const file = await compressPhoto(rawFile);
    const id = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(file);
    setLocalPhotos((current) => [...current, { id, itemKey, file, previewUrl, status: "uploading" }]);
    await tryUploadPhoto({ id, itemKey, file });
  }

  function handleRetryLocalPhoto(id: string) {
    const local = localPhotos.find((p) => p.id === id);
    if (!local) return;
    updateLocalPhoto(id, { status: "uploading", error: undefined });
    void tryUploadPhoto({ id: local.id, itemKey: local.itemKey, file: local.file });
  }

  async function handleRemoveLocalPhoto(id: string) {
    await removePendingPhoto(id);
    removeLocalPhoto(id);
  }

  async function handleRemoveConfirmedPhoto(photo: BoilerSurveyPhoto) {
    setRemovingIds((current) => ({ ...current, [photo.id]: true }));
    try {
      await removeSurveyPhoto(token, photo.id);
      setPhotos((current) => current.filter((p) => p.id !== photo.id));
    } catch {
      setItemErrors((current) => ({ ...current, [photo.itemKey]: "Couldn't remove while offline — try again once you're back online." }));
    }
    setRemovingIds((current) => {
      const next = { ...current };
      delete next[photo.id];
      return next;
    });
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      await trySubmit(answers);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="bg-slate-900 px-5 py-5 text-white">
        <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Boiler Installation Survey</p>
        <h1 className="mt-1 text-lg font-semibold">{survey.job.customerName}</h1>
        <p className="mt-0.5 text-sm text-slate-300">{survey.job.addressLines.join(", ")}</p>
        <p className="mt-2 text-xs text-slate-400">
          Ref {survey.job.reference} · Rep {survey.job.repName}
          {survey.job.phone ? ` · ${survey.job.phone}` : ""}
        </p>
      </div>

      {status === "submitted" && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-brand-green-mid/30 bg-brand-green-mid/10 px-4 py-3 text-sm text-brand-green-mid">
          <Check className="h-4 w-4 shrink-0" />
          This survey has been submitted. You can still make changes and resubmit.
        </div>
      )}

      {!isOnline && (
        <div className="mx-4 mt-4 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p>You&apos;re offline. Keep going — answers and photos are saved on this device and will upload automatically once you&apos;re back online.</p>
          {hasQueuedItems && (
            <button type="button" onClick={() => void flushQueue({ force: true })} className="mt-2 font-medium underline underline-offset-2">
              Already have signal? Try syncing now
            </button>
          )}
        </div>
      )}

      {isOnline && isSyncing && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          Syncing saved photos and answers…
        </div>
      )}

      {isOnline && !isSyncing && hasQueuedItems && (
        <div className="mx-4 mt-4 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p>Waiting to finish syncing saved photos/answers — this device will keep retrying automatically.</p>
          <button type="button" onClick={() => void flushQueue({ force: true })} className="mt-2 font-medium underline underline-offset-2">
            Sync now
          </button>
        </div>
      )}

      {draftRestored && status !== "submitted" && (
        <div className="mx-4 mt-4 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Unsaved answers from your last session on this device were restored.
        </div>
      )}

      <div className="flex flex-col gap-4 px-4 py-4">
        {BOILER_SURVEY_SECTIONS.map((section) => (
          <div key={section.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-slate-900">{section.title}</h2>
            </div>
            <div className="flex flex-col gap-3 p-4">
              {section.fields.map((field) => (
                <Field
                  key={field.key}
                  field={field}
                  value={answers[field.key] as string | number | null}
                  onChange={(value) => set(field.key, value as never)}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-900">Photo Checklist</h2>
            <p className="text-xs text-slate-500">Take at least one photo for each item — add as many extra angles/close-ups as you need.</p>
          </div>
          <div className="flex flex-col gap-2 p-4">
            {PHOTO_CHECKLIST_ITEMS.map((item) => (
              <PhotoItemGroup
                key={item.key}
                label={item.label}
                confirmedPhotos={photos.filter((p) => p.itemKey === item.key)}
                localPhotos={localPhotos.filter((p) => p.itemKey === item.key)}
                removingIds={removingIds}
                error={itemErrors[item.key] ?? null}
                onAddFile={(file) => void handlePhotoFile(item.key, file)}
                onRemoveConfirmed={(photo) => void handleRemoveConfirmedPhoto(photo)}
                onRemoveLocal={(id) => void handleRemoveLocalPhoto(id)}
                onRetryLocal={handleRetryLocalPhoto}
              />
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-900">Surveyor Sign-off</h2>
          </div>
          <div className="flex flex-col gap-3 p-4">
            <FormField label="Surveyor name" htmlFor="surveyorName" required>
              <input id="surveyorName" className={inputClassName} value={answers.surveyorName} onChange={(e) => set("surveyorName", e.target.value)} />
            </FormField>
            <FormField label="Survey date" htmlFor="surveyDate">
              <input id="surveyDate" type="date" className={inputClassName} value={answers.surveyDate} onChange={(e) => set("surveyDate", e.target.value)} />
            </FormField>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white px-4 py-3">
        {error && <p className="mb-2 text-center text-sm text-red-600">{error}</p>}
        {submitQueued && !error && status !== "submitted" && (
          <p className="mb-2 text-center text-sm text-amber-700">Saved on this device — will submit automatically once you&apos;re back online.</p>
        )}
        <Button
          variant="success"
          className={cn("w-full justify-center py-3 text-sm")}
          onClick={handleSubmit}
          disabled={isPending || !answers.surveyorName.trim()}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === "submitted" ? (
            "Save changes"
          ) : submitQueued ? (
            "Retry submit"
          ) : (
            "Submit survey"
          )}
        </Button>
      </div>
    </div>
  );
}
