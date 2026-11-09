"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { startSolarJobSurveyAction } from "@/app/jobs/actions";
import { SolarSurveyAnswers } from "@/components/quotes/solar/SolarSurveyAnswers";
import type { SolarSurveyDetail } from "@/types/solar-survey";

/**
 * The installer's side of a solar job's pre-installation survey: start (or
 * carry on with) the on-site form at `/survey/[token]`, and once it's been
 * submitted read back what was recorded. Nothing on this card is priced —
 * the survey holds access, roof and site details plus photos only.
 */
export function InstallerSolarSurveyCard({
  quoteId,
  survey,
}: {
  quoteId: string;
  survey: SolarSurveyDetail | undefined;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const submitted = survey?.status === "submitted";

  function handleOpenSurvey() {
    setError(null);
    startTransition(async () => {
      const result = await startSolarJobSurveyAction(quoteId);
      if (result.error || !result.accessToken) {
        setError(result.error ?? "Could not open the survey. Please try again.");
        return;
      }
      // Same tab (not window.open) so a phone's popup blocker can't swallow it after the async call.
      router.push(`/survey/${result.accessToken}`);
    });
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-3 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <ClipboardList className="h-4 w-4 text-slate-400" />
            Survey
          </h3>
          <Pill
            label={submitted ? "Submitted" : survey ? "In progress" : "Not started"}
            className={submitted ? "bg-brand-green-mid/10 text-brand-green-mid" : "bg-amber-100 text-amber-700"}
          />
        </div>

        <p className="text-sm text-slate-500">
          {submitted
            ? `${survey.answers.completedBy ? `${survey.answers.completedBy} · ` : ""}Submitted ${survey.submittedAt ? formatDateTime(survey.submittedAt) : ""}`
            : "Do the on-site survey first. Once it's submitted you can accept or decline this job."}
        </p>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <Button
          variant={submitted ? "secondary" : "primary"}
          disabled={isPending}
          onClick={handleOpenSurvey}
          className="w-full justify-center"
        >
          {isPending ? "Opening…" : submitted ? "Open survey again" : survey ? "Continue survey" : "Start survey"}
        </Button>
      </div>

      {survey && (
        <>
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            className="flex w-full items-center justify-between border-t border-slate-100 px-5 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {isOpen ? "Hide answers" : "View answers"}
            <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
          </button>
          {isOpen && (
            <div className="border-t border-slate-100 px-5 py-4">
              <SolarSurveyAnswers answers={survey.answers} files={survey.files} />
            </div>
          )}
        </>
      )}
    </Card>
  );
}
