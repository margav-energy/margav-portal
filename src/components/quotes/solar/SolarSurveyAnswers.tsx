import {
  ADDITIONAL_MEDIA_ITEMS,
  GENERAL_PHOTO_ITEMS,
  ROOF_LETTERS,
  ROOF_PHOTO_ITEMS,
  SOLAR_LOCATION_QUESTIONS,
  SOLAR_NOTES_QUESTIONS,
  SOLAR_PROPERTY_QUESTIONS,
  SOLAR_ROOF_QUESTIONS,
  VIDEO_ITEMS,
  type SolarSurveyFileItem,
  type SolarSurveyQuestion,
} from "@/lib/solar-survey-fields";
import type {
  SolarSurveyAnswers as Answers,
  SolarSurveyFile,
} from "@/types/solar-survey";

function displayValue(value: string): string {
  return value.trim() ? value : "—";
}

function QuestionList({
  title,
  rows,
}: {
  title: string;
  rows: { question: SolarSurveyQuestion; value: string }[];
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {title}
      </h4>
      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map(({ question, value }) => (
          <div key={question.label}>
            <dt className="text-xs text-slate-500">{question.label}</dt>
            <dd className="text-sm whitespace-pre-line text-slate-900">
              {displayValue(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FileGrid({
  title,
  items,
  files,
}: {
  title: string;
  items: SolarSurveyFileItem[];
  files: SolarSurveyFile[];
}) {
  const rows = items.map((item) => ({
    item,
    itemFiles: files.filter((f) => f.itemKey === item.key),
  }));
  const total = rows.reduce((sum, row) => sum + row.itemFiles.length, 0);

  return (
    <div>
      <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {title} ({total} file{total === 1 ? "" : "s"})
      </h4>
      <div className="mt-2 flex flex-col gap-3">
        {rows.map(({ item, itemFiles }) => (
          <div key={item.key}>
            <p className="text-xs text-slate-500">{item.label}</p>
            {itemFiles.length === 0 ? (
              <p className="text-sm text-slate-400">—</p>
            ) : (
              <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {itemFiles.map((file) => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={file.fileName}
                    className="block overflow-hidden rounded-md border border-slate-200"
                  >
                    {file.contentType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, refreshed on every server read rather than a static asset.
                      <img
                        src={file.url}
                        alt={file.fileName}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-slate-50 p-1 text-center text-[10px] break-all text-slate-500">
                        {file.contentType.startsWith("video/") ? "▶ " : "📄 "}
                        {file.fileName}
                      </div>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Read-only rendering of a solar survey's Q&A and uploads, shared by `SolarSurveyCard` and `SolarSurveyLaunchModal`. */
export function SolarSurveyAnswers({
  answers,
  files,
}: {
  answers: Answers;
  files: SolarSurveyFile[];
}) {
  const roofCount = Math.min(Math.max(Number(answers.roofCount) || 0, 0), 3);

  return (
    <div className="flex flex-col gap-5">
      <QuestionList
        title="Property details"
        rows={SOLAR_PROPERTY_QUESTIONS.map((question) => ({
          question,
          value:
            question.key === "energySupplier" &&
            answers.energySupplier === "Other" &&
            answers.energySupplierOther.trim()
              ? `Other — ${answers.energySupplierOther.trim()}`
              : answers[question.key],
        }))}
      />

      {ROOF_LETTERS.slice(0, roofCount).map((letter, index) => (
        <div key={letter} className="flex flex-col gap-5">
          <QuestionList
            title={`Roof ${letter}`}
            rows={SOLAR_ROOF_QUESTIONS.map((question) => ({
              question,
              value: answers.roofs[index][question.key],
            }))}
          />
          <FileGrid
            title={`Roof ${letter} photos`}
            items={[ROOF_PHOTO_ITEMS[index]]}
            files={files}
          />
        </div>
      ))}

      <QuestionList
        title="Key locations"
        rows={SOLAR_LOCATION_QUESTIONS.map((question) => ({
          question,
          value: answers[question.key],
        }))}
      />
      <FileGrid
        title="General photo survey"
        items={GENERAL_PHOTO_ITEMS}
        files={files}
      />
      <FileGrid
        title="General video survey"
        items={VIDEO_ITEMS}
        files={files}
      />
      <FileGrid
        title="Additional images & videos"
        items={ADDITIONAL_MEDIA_ITEMS}
        files={files}
      />
      <QuestionList
        title="Notes"
        rows={[
          ...SOLAR_NOTES_QUESTIONS.map((question) => ({
            question,
            value: answers[question.key],
          })),
          {
            question: {
              key: "completedBy",
              label: "Completed by",
              type: "text",
            } as SolarSurveyQuestion,
            value: answers.completedBy,
          },
        ]}
      />
    </div>
  );
}
