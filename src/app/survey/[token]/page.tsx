import { getPublicBoilerSurvey } from "@/data/boiler-survey-service";
import { getPublicSolarSurvey } from "@/data/solar-survey-service";
import { SurveyForm } from "@/app/survey/[token]/SurveyForm";
import { SolarSurveyForm } from "@/app/survey/[token]/SolarSurveyForm";

/** One public route for both products — the token belongs to either a boiler or a solar survey. */
export default async function PublicSurveyPage({
  params,
}: PageProps<"/survey/[token]">) {
  const { token } = await params;
  const [boilerSurvey, solarSurvey] = await Promise.all([getPublicBoilerSurvey(token), getPublicSolarSurvey(token)]);

  if (boilerSurvey) return <SurveyForm token={token} survey={boilerSurvey} />;
  if (solarSurvey) return <SolarSurveyForm token={token} survey={solarSurvey} />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 p-6 text-center">
      <p className="text-lg font-semibold text-slate-900">This survey link isn&apos;t valid</p>
      <p className="max-w-sm text-sm text-slate-500">
        It may have been copied incorrectly. Ask the office to resend the survey link.
      </p>
    </div>
  );
}
