"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { updateTeammateAction } from "@/app/settings/users/actions";
import type { TeammateProfile } from "@/data/profiles-service";

/** Opened from the pencil icon on Settings → Team Members — edits name,
 *  login email, and phone for an existing teammate. Role has its own
 *  dropdown right in the row (see UserRoleManager) and stays there. */
export function EditTeammateModal({ teammate, onClose }: { teammate: TeammateProfile; onClose: () => void }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(teammate.fullName);
  const [email, setEmail] = useState(teammate.email);
  const [phone, setPhone] = useState(teammate.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateTeammateAction(teammate.id, fullName.trim(), email.trim(), phone.trim());
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal title={`Edit ${teammate.fullName}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
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
          <Button variant="secondary" onClick={onClose} disabled={isPending} type="button">
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
