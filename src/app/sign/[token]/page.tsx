import { getPublicRelatedDocument, getPublicSignatureRequest } from "@/data/signature-service";
import { getPublicSurveyDocumentUrl } from "@/data/boiler-survey-service";
import { SignForm } from "@/app/sign/[token]/SignForm";
import type { DocumentSnapshot } from "@/lib/esignature/document";

export default async function PublicSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const request = await getPublicSignatureRequest(token);

  if (!request || request.status === "expired") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 p-6 text-center">
        <p className="text-lg font-semibold text-slate-900">This signing link isn&apos;t valid</p>
        <p className="max-w-sm text-sm text-slate-500">
          It may have expired or been copied incorrectly. Ask Margav Heating to resend the quote.
        </p>
      </div>
    );
  }

  // Only boiler jobs have a survey step at all — the agreement document
  // type is boiler-only by definition, and a "quote" document is boiler
  // when its snapshot says so.
  const isBoilerJob =
    request.documentType === "boiler_installation_agreement" ||
    (request.snapshot as DocumentSnapshot).productTypeLabel === "Boiler";

  const [relatedDocument, surveyDocumentUrl] = await Promise.all([
    getPublicRelatedDocument(request.snapshot.quoteId, request.documentType),
    isBoilerJob ? getPublicSurveyDocumentUrl(request.snapshot.quoteId) : Promise.resolve(undefined),
  ]);

  return (
    <SignForm token={token} request={request} relatedDocument={relatedDocument} surveyDocumentUrl={surveyDocumentUrl} />
  );
}
