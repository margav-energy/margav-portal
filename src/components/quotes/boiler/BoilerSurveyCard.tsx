"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { BoilerSurveyAnswers } from "@/components/quotes/boiler/BoilerSurveyAnswers";
import type { BoilerSurveyDetail } from "@/types/boiler-survey";

/** Read-only summary of the on-site survey, shown on the boiler quote detail page. See `BoilerSurveyLaunchModal` for how the survey gets started/viewed via the "Survey" button. */
export function BoilerSurveyCard({
  survey,
  documentUrl,
}: {
  survey: BoilerSurveyDetail | undefined;
  /** Signed URL to the generated survey PDF (see `getSurveyDocumentUrl`) — present once a surveyor has submitted at least once. */
  documentUrl: string | undefined;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!survey) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900">Survey</h3>
        <p className="mt-2 text-sm text-slate-500">
          No pre-installation survey sent yet — click &ldquo;Survey&rdquo; above to generate a link for the on-site engineer.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <button type="button" onClick={() => setIsOpen((open) => !open)} className="flex w-full items-center justify-between px-5 py-4">
        <div className="text-left">
          <h3 className="text-sm font-semibold text-slate-900">Survey</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {survey.answers.surveyorName ? `${survey.answers.surveyorName} · ` : ""}
            {survey.submittedAt ? formatDateTime(survey.submittedAt) : "Not yet submitted"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill
            label={survey.status === "submitted" ? "Submitted" : "Pending"}
            className={survey.status === "submitted" ? "bg-brand-green-mid/10 text-brand-green-mid" : "bg-amber-100 text-amber-700"}
          />
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
        </div>
      </button>

      {survey.status === "submitted" && documentUrl && (
        <div className="border-t border-slate-100 px-5 py-3">
          <a
            href={documentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-sm font-medium text-brand-blue hover:underline"
          >
            Download survey PDF →
          </a>
        </div>
      )}

      {isOpen && (
        <div className="border-t border-slate-100 px-5 py-4">
          <BoilerSurveyAnswers answers={survey.answers} photos={survey.photos} />
        </div>
      )}
    </Card>
  );
}
