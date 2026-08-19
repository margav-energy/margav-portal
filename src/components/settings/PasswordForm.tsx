"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { updatePasswordAction, type PasswordFormState } from "@/app/settings/actions";

const initialState: PasswordFormState = {};

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="New password" htmlFor="password" required>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClassName}
        />
      </FormField>
      <FormField label="Confirm password" htmlFor="confirmPassword" required>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputClassName}
        />
      </FormField>

      {state?.error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:ml-[196px]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="flex items-center gap-2 rounded-lg bg-brand-green-mid/10 px-3 py-2 text-sm text-brand-green-mid sm:ml-[196px]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Password updated.
        </div>
      )}

      <div className="sm:ml-[196px]">
        <Button type="submit" disabled={pending}>
          {pending ? "Updating…" : "Update password"}
        </Button>
      </div>
    </form>
  );
}
