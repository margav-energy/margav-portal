import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const redirectToParam = resolvedSearchParams.redirectTo;
  const redirectTo = typeof redirectToParam === "string" ? redirectToParam : "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <LoginForm redirectTo={redirectTo} />
    </div>
  );
}
