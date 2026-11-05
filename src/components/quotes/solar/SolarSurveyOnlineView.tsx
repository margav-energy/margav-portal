import { SolarVideoLink } from "@/components/quotes/solar/SolarVideoLink";
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
  SolarSurveyAnswers,
  SolarSurveyFile,
  SolarSurveyJobContext,
} from "@/types/solar-survey";

/**
 * The read-only "View online" page for a solar survey, laid out like the
 * exported form document: a dark title band, a customer/address strip, then
 * one card of label / value rows with bold section headings. Uploads sit in
 * the value column — photos with their filename underneath, videos and other
 * files as links. Rendered by `src/app/quotes/[id]/survey/page.tsx`.
 */

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-slate-200/70 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] sm:gap-6">
      <dt className="text-sm text-slate-700">{label}</dt>
      <dd className="min-w-0 text-sm whitespace-pre-line text-slate-900">
        {children}
      </dd>
    </div>
  );
}

function NotProvided() {
  return <span className="text-slate-400 italic">Not provided</span>;
}

function TextRow({ label, value }: { label: string; value: string }) {
  return <Row label={label}>{value.trim() ? value : <NotProvided />}</Row>;
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-slate-200/70 pt-6 pb-4 text-sm font-semibold text-slate-900">
      {children}
    </h2>
  );
}

function QuestionRows<Q extends SolarSurveyQuestion>({
  questions,
  valueFor,
}: {
  questions: Q[];
  valueFor: (question: Q) => string;
}) {
  return (
    <>
      {questions.map((question) => (
        <div key={question.label}>
          {question.helpImage && (
            <div className="flex justify-center border-b border-slate-200/70 py-6">
              {/* eslint-disable-next-line @next/next/no-img-element -- static illustration from /public. */}
              <img
                src={question.helpImage.src}
                alt={question.helpImage.alt}
                className="max-h-40 w-auto max-w-full"
              />
            </div>
          )}
          <TextRow label={question.label} value={valueFor(question)} />
        </div>
      ))}
    </>
  );
}

function FileRows({
  items,
  files,
}: {
  items: SolarSurveyFileItem[];
  files: SolarSurveyFile[];
}) {
  return (
    <>
      {items.map((item) => {
        const itemFiles = files.filter((file) => file.itemKey === item.key);
        return (
          <Row key={item.key} label={item.label}>
            {itemFiles.length === 0 ? (
              <NotProvided />
            ) : (
              <div className="flex flex-wrap gap-x-3 gap-y-5">
                {itemFiles.map((file) =>
                  file.contentType.startsWith("image/") ? (
                    <figure key={file.id} className="w-full max-w-md">
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, refreshed on every server read. */}
                        <img
                          src={file.url}
                          alt={file.fileName}
                          className="w-full"
                        />
                      </a>
                      <figcaption className="mt-1 text-xs text-slate-500">
                        {file.fileName}
                      </figcaption>
                    </figure>
                  ) : file.contentType.startsWith("video/") ? (
                    <SolarVideoLink
                      key={file.id}
                      url={file.url}
                      fileName={file.fileName}
                    />
                  ) : (
                    <a
                      key={file.id}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-fit items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-brand-blue hover:bg-slate-200"
                    >
                      <span aria-hidden>📄</span>
                      {file.fileName}
                    </a>
                  ),
                )}
              </div>
            )}
          </Row>
        );
      })}
    </>
  );
}

export function SolarSurveyOnlineView({
  job,
  answers,
  files,
  submittedAtLabel,
}: {
  job: SolarSurveyJobContext;
  answers: SolarSurveyAnswers;
  files: SolarSurveyFile[];
  submittedAtLabel: string;
}) {
  const roofCount = Math.min(Math.max(Number(answers.roofCount) || 0, 0), 3);
  const addressParts = [...job.addressLines.flatMap((line) => line.split(",")), job.address.postcode]
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
      <header className="border-b-4 border-brand-blue bg-slate-800 px-8 pt-8 pb-7 text-white">
        <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
          Form · {job.reference}
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          Pre-Installation Survey<span className="text-red-500">.</span>
        </h1>
        <p className="mt-2 text-xs text-slate-400">{submittedAtLabel}</p>
      </header>

      <div className="grid grid-cols-1 border-b border-slate-200 bg-white sm:grid-cols-2">
        <div className="px-6 py-4 sm:border-r sm:border-slate-200">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Customer
          </p>
          <p className="mt-1 text-sm text-slate-900">
            {job.customerName || "—"}
          </p>
        </div>
        <div className="px-6 py-4">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Address
          </p>
          <p className="mt-1 text-sm text-slate-900">
            {addressParts.length > 0
              ? addressParts.map((part, index) => (
                  <span key={index} className="block">
                    {part}
                  </span>
                ))
              : "—"}
          </p>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        <dl className="rounded-2xl border border-slate-200 bg-white px-4 pb-4 sm:px-8">
          <div className="border-b border-slate-200/70 pt-4" />
          <TextRow label="Reference Number" value={job.reference} />
          <TextRow label="Rep Name" value={job.repName} />
          <TextRow label="First name" value={job.firstName} />
          <TextRow label="Last name" value={job.lastName} />
          <TextRow label="Address line 1" value={job.address.line1} />
          <TextRow label="Address line 2" value={job.address.line2} />
          <TextRow label="Address line 3" value={job.address.line3} />
          <TextRow label="City" value={job.address.city} />
          <TextRow label="County" value={job.address.county} />
          <TextRow label="Postcode" value={job.address.postcode} />

          <Heading>Property Details</Heading>
          <QuestionRows
            questions={SOLAR_PROPERTY_QUESTIONS}
            valueFor={({ key }) => {
              if (
                key === "energySupplier" &&
                answers.energySupplier === "Other" &&
                answers.energySupplierOther.trim()
              ) {
                return `Other — ${answers.energySupplierOther.trim()}`;
              }
              const value = answers[key];
              return typeof value === "string" ? value : "";
            }}
          />

          {ROOF_LETTERS.slice(0, roofCount).map((letter, index) => (
            <div key={letter}>
              <Heading>Roof {letter}</Heading>
              <QuestionRows
                questions={SOLAR_ROOF_QUESTIONS}
                valueFor={({ key }) => answers.roofs[index][key] ?? ""}
              />
              <FileRows items={[ROOF_PHOTO_ITEMS[index]]} files={files} />
            </div>
          ))}

          <Heading>Key Locations</Heading>
          <QuestionRows
            questions={SOLAR_LOCATION_QUESTIONS}
            valueFor={({ key }) => {
              const value = answers[key];
              return typeof value === "string" ? value : "";
            }}
          />

          <Heading>Notes</Heading>
          <QuestionRows
            questions={SOLAR_NOTES_QUESTIONS}
            valueFor={({ key }) => {
              const value = answers[key];
              return typeof value === "string" ? value : "";
            }}
          />
          <TextRow label="Completed by" value={answers.completedBy} />

          <Heading>Photo Survey</Heading>
          <FileRows items={GENERAL_PHOTO_ITEMS} files={files} />

          <Heading>Video Survey</Heading>
          <FileRows items={VIDEO_ITEMS} files={files} />

          <Heading>Additional Images &amp; Videos</Heading>
          <FileRows items={ADDITIONAL_MEDIA_ITEMS} files={files} />
        </dl>
      </div>
    </div>
  );
}
