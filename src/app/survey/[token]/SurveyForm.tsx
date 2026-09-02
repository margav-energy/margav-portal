"use client";

import { useState, useTransition } from "react";
import { Camera, Check, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { cn } from "@/lib/utils";
import { removeSurveyPhoto, submitBoilerSurvey, uploadSurveyPhoto } from "@/app/survey/[token]/actions";
import { BOILER_SURVEY_SECTIONS, bathroomLocationOptions, type BoilerSurveyFieldConfig } from "@/lib/boiler-survey-fields";
import { PHOTO_CHECKLIST_ITEMS, type BoilerSurveyAnswers, type BoilerSurveyPhoto, type PhotoChecklistItemKey } from "@/types/boiler-survey";
import type { PublicBoilerSurvey } from "@/data/boiler-survey-service";
import { clearDraft, loadDraft, useAutosaveDraft } from "@/hooks/useAutosaveDraft";

function Field({
  field,
  value,
  bathrooms,
  onChange,
}: {
  field: BoilerSurveyFieldConfig;
  value: string | number | null;
  /** Only read for `type: "bathroom-select"` — see `bathroomLocationOptions`. */
  bathrooms: number | null;
  onChange: (value: string | number | null) => void;
}) {
  const id = field.key;

  if (field.type === "select" || field.type === "bathroom-select") {
    const options = field.type === "select" ? field.options : bathroomLocationOptions(bathrooms);
    return (
      <FormField label={field.label} htmlFor={id}>
        <select id={id} className={inputClassName} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {/* Preserves a pre-existing free-text value entered before this became a dropdown, so it isn't silently wiped. */}
          {value && !options.includes(value as string) && <option value={value as string}>{value as string}</option>}
          {options.map((option) => (
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

function PhotoItem({
  token,
  itemKey,
  label,
  photo,
  onChange,
}: {
  token: string;
  itemKey: PhotoChecklistItemKey;
  label: string;
  photo: BoilerSurveyPhoto | undefined;
  onChange: (photo: BoilerSurveyPhoto | undefined) => void;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setIsBusy(true);
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadSurveyPhoto(token, itemKey, formData);
    setIsBusy(false);
    if (!result.ok || !result.url) {
      setError(result.error ?? "Upload failed.");
      return;
    }
    onChange({ itemKey, url: result.url, uploadedAt: new Date().toISOString() });
  }

  async function handleRemove() {
    setIsBusy(true);
    await removeSurveyPhoto(token, itemKey);
    setIsBusy(false);
    onChange(undefined);
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not a static asset next/image can optimize.
        <img src={photo.url} alt={label} className="h-14 w-14 shrink-0 rounded-md object-cover" />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-300">
          <Camera className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-700">{label}</p>
        {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        ) : photo ? (
          <>
            <Check className="h-4 w-4 text-brand-green-mid" />
            <button type="button" onClick={handleRemove} aria-label={`Remove photo for ${label}`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        ) : (
          <label className="cursor-pointer rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200">
            Add photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

export function SurveyForm({ token, survey }: { token: string; survey: PublicBoilerSurvey }) {
  // Autosaved locally so a crashed/restarted device or a closed tab doesn't wipe out
  // everything typed since the last submit — this form is often filled in over a long
  // on-site session. Keyed by token so different survey links never collide.
  const draftKey = `survey-draft-${token}`;
  const [answers, setAnswers] = useState<BoilerSurveyAnswers>(() => loadDraft<BoilerSurveyAnswers>(draftKey) ?? survey.answers);
  const [draftRestored] = useState(() => loadDraft<BoilerSurveyAnswers>(draftKey) !== null);
  const [photos, setPhotos] = useState<BoilerSurveyPhoto[]>(survey.photos);
  const [status, setStatus] = useState(survey.status);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useAutosaveDraft(draftKey, answers);

  function set<K extends keyof BoilerSurveyAnswers>(key: K, value: BoilerSurveyAnswers[K]) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function handlePhotoChange(itemKey: PhotoChecklistItemKey, photo: BoilerSurveyPhoto | undefined) {
    setPhotos((current) => {
      const withoutItem = current.filter((p) => p.itemKey !== itemKey);
      return photo ? [...withoutItem, photo] : withoutItem;
    });
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await submitBoilerSurvey(token, answers);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong — please try again.");
        return;
      }
      clearDraft(draftKey);
      setStatus("submitted");
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
                  bathrooms={answers.bathrooms}
                  onChange={(value) => set(field.key, value as never)}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <h2 className="text-sm font-semibold text-slate-900">Photo Checklist</h2>
            <p className="text-xs text-slate-500">Take a photo for each item — attach all photos to the job file.</p>
          </div>
          <div className="flex flex-col gap-2 p-4">
            {PHOTO_CHECKLIST_ITEMS.map((item) => (
              <PhotoItem
                key={item.key}
                token={token}
                itemKey={item.key}
                label={item.label}
                photo={photos.find((p) => p.itemKey === item.key)}
                onChange={(photo) => handlePhotoChange(item.key, photo)}
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
        <Button
          variant="success"
          className={cn("w-full justify-center py-3 text-sm")}
          onClick={handleSubmit}
          disabled={isPending || !answers.surveyorName.trim()}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : status === "submitted" ? "Save changes" : "Submit survey"}
        </Button>
      </div>
    </div>
  );
}
