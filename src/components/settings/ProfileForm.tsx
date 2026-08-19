"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { updateProfileAction, type ProfileFormState } from "@/app/settings/actions";

const initialState: ProfileFormState = {};

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Email" htmlFor="email">
        <input
          id="email"
          type="email"
          value={email}
          disabled
          className={`${inputClassName} cursor-not-allowed opacity-60`}
        />
      </FormField>
      <FormField label="Full name" htmlFor="fullName" required>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          defaultValue={fullName}
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
          Profile updated.
        </div>
      )}

      <div className="sm:ml-[196px]">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
