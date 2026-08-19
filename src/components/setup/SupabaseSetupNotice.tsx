import { DatabaseZap } from "lucide-react";

/**
 * Shown instead of the whole app when `.env.local` doesn't have real
 * Supabase values yet — every page needs a database connection now (auth,
 * quotes, appointments, etc. are all Supabase-backed), so there's nothing
 * useful to render until it's configured.
 */
export function SupabaseSetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-green-gradient text-white">
          <DatabaseZap className="h-5 w-5" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">Connect Supabase to continue</h1>
        <p className="mt-2 text-sm text-slate-600">
          Margav Portal is now backed by a real database, so it needs your Supabase project&rsquo;s
          credentials before it can run.
        </p>
        <ol className="mt-5 flex flex-col gap-3 text-sm text-slate-700">
          <li className="flex gap-2">
            <span className="font-semibold text-brand-blue">1.</span>
            Create a project at{" "}
            <span className="font-medium">supabase.com</span> (or open an existing one).
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-brand-blue">2.</span>
            Open the SQL Editor and run <code className="rounded bg-slate-100 px-1.5 py-0.5">supabase/schema.sql</code>{" "}
            from this repo.
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-brand-blue">3.</span>
            Copy <code className="rounded bg-slate-100 px-1.5 py-0.5">.env.local.example</code> to{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">.env.local</code> and paste in your
            Project URL and anon key from Project Settings → API.
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-brand-blue">4.</span>
            Under Authentication → Users, add yourself as a user (there&rsquo;s no public sign-up).
          </li>
          <li className="flex gap-2">
            <span className="font-semibold text-brand-blue">5.</span>
            Restart <code className="rounded bg-slate-100 px-1.5 py-0.5">npm run dev</code>.
          </li>
        </ol>
      </div>
    </div>
  );
}
