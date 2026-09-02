"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { updateTeammateAction } from "@/app/settings/users/actions";
import type { TeammateProfile } from "@/data/profiles-service";
import { clearDraft, loadDraft, useAutosaveDraft } from "@/hooks/useAutosaveDraft";

type EditTeammateDraft = { fullName: string; email: string; phone: string };

/** Opened from the pencil icon on Settings → Team Members — edits name,
 *  login email, and phone for an existing teammate. Role has its own
 *  dropdown right in the row (see UserRoleManager) and stays there. */
export function EditTeammateModal({ teammate, onClose }: { teammate: TeammateProfile; onClose: () => void }) {
  const router = useRouter();
  const draftKey = `edit-teammate-draft-${teammate.id}`;
  const [fullName, setFullName] = useState(() => loadDraft<EditTeammateDraft>(draftKey)?.fullName ?? teammate.fullName);
  const [email, setEmail] = useState(() => loadDraft<EditTeammateDraft>(draftKey)?.email ?? teammate.email);
  const [phone, setPhone] = useState(() => loadDraft<EditTeammateDraft>(draftKey)?.phone ?? teammate.phone ?? "");
  const [draftRestored, setDraftRestored] = useState(() => loadDraft<EditTeammateDraft>(draftKey) !== null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useAutosaveDraft(draftKey, { fullName, email, phone });

  function handleClose() {
    setDraftRestored(false);
    clearDraft(draftKey);
    onClose();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateTeammateAction(teammate.id, fullName.trim(), email.trim(), phone.trim());
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraftRestored(false);
      clearDraft(draftKey);
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal title={`Edit ${teammate.fullName}`} onClose={handleClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        {draftRestored && (
          <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Unsaved changes from your last session were restored.
          </p>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Full name</span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            disabled={isPending}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Email address</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={isPending}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <span className="text-xs text-slate-400">This is what they log in with — changing it changes their login too.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={isPending}
            placeholder="Optional"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose} disabled={isPending} type="button">
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
