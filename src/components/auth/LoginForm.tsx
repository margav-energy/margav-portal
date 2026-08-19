"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { signInAction, type SignInState } from "@/lib/auth-actions";
import { Card } from "@/components/ui/Card";
import { inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";

const initialState: SignInState = {};

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <Card className="w-full max-w-sm p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-green-gradient text-lg font-bold text-white">
          M
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Margav Portal</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to your account</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClassName}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClassName}
          />
        </div>

        {state?.error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {state.error}
          </div>
        )}

        <Button type="submit" disabled={pending} className="mt-2 w-full justify-center">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        Access is invite-only — contact an admin if you need an account.
      </p>
    </Card>
  );
}
