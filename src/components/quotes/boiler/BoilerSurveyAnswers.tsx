import { BOILER_SURVEY_SECTIONS } from "@/lib/boiler-survey-fields";
import { PHOTO_CHECKLIST_ITEMS, type BoilerSurveyAnswers as Answers, type BoilerSurveyPhoto } from "@/types/boiler-survey";

function displayValue(value: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

/**
 * Read-only rendering of a survey's Q&A + photos — every field in
 * `BOILER_SURVEY_SECTIONS` plus the photo checklist grid. Shared by
 * `BoilerSurveyCard` (the sidebar card) and `BoilerSurveyLaunchModal` (so
 * re-opening "Survey" on an already-completed one shows the answers
 * instead of just a QR code to fill it in again) so the two never drift.
 */
export function BoilerSurveyAnswers({ answers, photos }: { answers: Answers; photos: BoilerSurveyPhoto[] }) {
  return (
    <div className="flex flex-col gap-5">
      {BOILER_SURVEY_SECTIONS.map((section) => (
        <div key={section.title}>
          <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{section.title}</h4>
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {section.fields.map((field) => (
              <div key={field.key}>
                <dt className="text-xs text-slate-500">{field.label}</dt>
                <dd className="text-sm text-slate-900">{displayValue(answers[field.key] as string | number | null)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}

      <div>
        <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Photos ({photos.length}/{PHOTO_CHECKLIST_ITEMS.length})
        </h4>
        {photos.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">No photos uploaded yet.</p>
        ) : (
          <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {PHOTO_CHECKLIST_ITEMS.map((item) => {
              const photo = photos.find((p) => p.itemKey === item.key);
              if (!photo) return null;
              return (
                <a key={item.key} href={photo.url} target="_blank" rel="noopener noreferrer" title={item.label}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, refreshed on every server read rather than a static asset. */}
                  <img src={photo.url} alt={item.label} className="aspect-square w-full rounded-md object-cover" />
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
