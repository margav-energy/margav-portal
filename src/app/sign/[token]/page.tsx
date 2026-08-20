import { getPublicSignatureRequest } from "@/data/signature-service";
import { SignForm } from "@/app/sign/[token]/SignForm";

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
          It may have expired or been copied incorrectly. Ask Margav Energy to resend the quote.
        </p>
      </div>
    );
  }

  return <SignForm token={token} request={request} />;
}
