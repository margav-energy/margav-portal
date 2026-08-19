import { getPublicBoilerSurvey } from "@/data/boiler-survey-service";
import { SurveyForm } from "@/app/survey/[token]/SurveyForm";

export default async function PublicBoilerSurveyPage({
  params,
}: PageProps<"/survey/[token]">) {
  const { token } = await params;
  const survey = await getPublicBoilerSurvey(token);

  if (!survey) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 p-6 text-center">
        <p className="text-lg font-semibold text-slate-900">This survey link isn&apos;t valid</p>
        <p className="max-w-sm text-sm text-slate-500">
          It may have been copied incorrectly. Ask the office to resend the survey link.
        </p>
      </div>
    );
  }

  return <SurveyForm token={token} survey={survey} />;
}
