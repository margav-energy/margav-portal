"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { setTeammateActiveAction } from "@/app/settings/users/actions";

/** Opened from the deactivate/reactivate icon on Settings → Team Members.
 *  Deactivating cuts off sign-in but keeps the profile row (and everything
 *  historical it's referenced from) intact — see
 *  supabase/migrations/0021_teammate_active_status.sql. */
export function SetTeammateActiveModal({
  teammateId,
  teammateName,
  active,
  onClose,
}: {
  teammateId: string;
  teammateName: string;
  /** Current status — true means this modal is offering to deactivate. */
  active: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await setTeammateActiveAction(teammateId, !active);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal title={active ? "Deactivate teammate?" : "Reactivate teammate?"} onClose={onClose}>
      <div className="flex flex-col gap-4 p-5">
        <p className="text-sm text-slate-600">
          {active ? (
            <>
              <span className="font-medium text-slate-900">{teammateName}</span> won&rsquo;t be able to sign in
              anymore. Their history — quotes, jobs, activity — stays exactly as it is, and you can reactivate them
              any time.
            </>
          ) : (
            <>
              <span className="font-medium text-slate-900">{teammateName}</span> will be able to sign in again with
              their existing email and password.
            </>
          )}
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant={active ? "danger" : "success"} onClick={handleConfirm} disabled={isPending}>
            {isPending ? "Saving…" : active ? "Deactivate" : "Reactivate"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
