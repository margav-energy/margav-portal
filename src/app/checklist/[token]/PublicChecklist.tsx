"use client";

import { useEffect, useMemo, useState } from "react";
import { HardHat, MapPin, Zap } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { InstallerChecklistCard, type ChecklistApi } from "@/components/jobs/InstallerChecklistCard";
import {
  createLinkChecklistUploadUrl,
  registerLinkChecklistPhoto,
  removeLinkChecklistPhoto,
  setLinkChecklistItemNotApplicable,
  submitLinkChecklistStage,
} from "@/app/checklist/[token]/actions";
import type { ChecklistEditorRole } from "@/lib/solar-install-checklist";
import type { SolarInstallChecklist } from "@/data/solar-install-checklist-service";

const ROLE_STORAGE_KEY = "install-checklist-role";

/**
 * The share-link version of the install photo checklist. There's no login, so
 * the person says whether they're the installer or the electrician - that only
 * decides which items they can edit (an electrician: the electrical ones). The
 * same `InstallerChecklistCard` does the rest, with its actions bound to the
 * link's token (see ./actions.ts).
 */
export function PublicChecklist({
  token,
  customerName,
  address,
  initial,
}: {
  token: string;
  customerName: string;
  address: string;
  initial: SolarInstallChecklist;
}) {
  const [role, setRole] = useState<ChecklistEditorRole | null>(null);

  // Remember the choice on this device so a reload doesn't ask again. Read after mount so server and client render the same first paint.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`${ROLE_STORAGE_KEY}:${token}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of a saved preference, must run after hydration.
      if (saved === "installer" || saved === "electrician") setRole(saved);
    } catch {
      // Storage blocked - they just pick again.
    }
  }, [token]);

  function choose(next: ChecklistEditorRole | null) {
    setRole(next);
    try {
      if (next) window.localStorage.setItem(`${ROLE_STORAGE_KEY}:${token}`, next);
      else window.localStorage.removeItem(`${ROLE_STORAGE_KEY}:${token}`);
    } catch {
      // Not remembering is fine.
    }
  }

  const api = useMemo<ChecklistApi | undefined>(() => {
    if (!role) return undefined;
    return {
      createUploadUrl: (itemKey, fileId, fileName, contentType) => createLinkChecklistUploadUrl(token, role, itemKey, fileId, fileName, contentType),
      register: (itemKey, fileId, path, fileName, contentType, sizeBytes) =>
        registerLinkChecklistPhoto(token, role, itemKey, fileId, path, fileName, contentType, sizeBytes),
      remove: (photoId) => removeLinkChecklistPhoto(token, role, photoId),
      setNa: (itemKey, notApplicable) => setLinkChecklistItemNotApplicable(token, role, itemKey, notApplicable),
      submit: (stage) => submitLinkChecklistStage(token, role, stage),
    };
  }, [token, role]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Margav · Install photo checklist</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{customerName}</h1>
          {address && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin className="h-4 w-4 shrink-0" />
              {address}
            </p>
          )}
        </div>

        {!role || !api ? (
          <Card className="flex flex-col gap-4 p-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Who&rsquo;s adding photos?</h2>
              <p className="mt-1 text-xs text-slate-500">
                The installer can add photos to every item. The electrician adds the electrical ones, and the rest show as read-only.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => choose("installer")}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left hover:bg-slate-50"
              >
                <HardHat className="h-6 w-6 text-brand-blue" />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">I&rsquo;m the installer</span>
                  <span className="block text-xs text-slate-500">All checklist items</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => choose("electrician")}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-left hover:bg-slate-50"
              >
                <Zap className="h-6 w-6 text-brand-blue" />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">I&rsquo;m the electrician</span>
                  <span className="block text-xs text-slate-500">Electrical items only</span>
                </span>
              </button>
            </div>
          </Card>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              Adding photos as the <span className="font-medium text-slate-700">{role}</span>.{" "}
              <button type="button" onClick={() => choose(null)} className="font-medium text-brand-blue hover:underline">
                Switch
              </button>
            </p>
            <InstallerChecklistCard key={role} quoteId="" initial={initial} role={role} api={api} />
          </>
        )}
      </div>
    </div>
  );
}
