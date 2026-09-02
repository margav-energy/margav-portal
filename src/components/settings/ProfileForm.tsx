"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { updateProfileAction, type ProfileFormState } from "@/app/settings/actions";
import { clearDraft, loadDraft, useAutosaveDraft } from "@/hooks/useAutosaveDraft";

const initialState: ProfileFormState = {};
const DRAFT_KEY = "profile-draft";

type ProfileDraft = { fullName: string; phone: string };

export function ProfileForm({ fullName: initialFullName, email, phone: initialPhone }: { fullName: string; email: string; phone: string }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);
  const [fullName, setFullName] = useState(() => loadDraft<ProfileDraft>(DRAFT_KEY)?.fullName ?? initialFullName);
  const [phone, setPhone] = useState(() => loadDraft<ProfileDraft>(DRAFT_KEY)?.phone ?? initialPhone);
  const [draftRestored] = useState(() => loadDraft<ProfileDraft>(DRAFT_KEY) !== null);

  useAutosaveDraft(DRAFT_KEY, { fullName, phone });

  useEffect(() => {
    if (state?.success) clearDraft(DRAFT_KEY);
  }, [state?.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {draftRestored && !state?.success && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:ml-[196px]">
          Unsaved changes from your last session were restored.
        </div>
      )}
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
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          className={inputClassName}
        />
      </FormField>
      <FormField label="Phone" htmlFor="phone">
        <input
          id="phone"
          name="phone"
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="e.g. 07565 443579"
          className={inputClassName}
        />
        <p className="mt-1 text-xs text-slate-400">Shown to customers under &ldquo;Get In Touch&rdquo; on your quotes.</p>
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
