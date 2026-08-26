"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Pencil, RotateCcw, UserX } from "lucide-react";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { Pill } from "@/components/ui/Pill";
import { EditTeammateModal } from "@/components/settings/EditTeammateModal";
import { SetTeammateActiveModal } from "@/components/settings/SetTeammateActiveModal";
import { updateUserRoleAction, type UserRole } from "@/app/settings/users/actions";
import type { TeammateProfile } from "@/data/profiles-service";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "rep", label: "Rep" },
  { value: "installer", label: "Installer" },
];

export function UserRoleManager({
  profiles,
  currentUserId,
}: {
  profiles: TeammateProfile[];
  currentUserId: string;
}) {
  const [roles, setRoles] = useState<Record<string, UserRole>>(() =>
    Object.fromEntries(profiles.map((profile) => [profile.id, profile.role])),
  );
  const [rowState, setRowState] = useState<Record<string, { error?: string; saved?: boolean }>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingTeammate, setEditingTeammate] = useState<TeammateProfile | null>(null);
  const [activeToggleTeammate, setActiveToggleTeammate] = useState<TeammateProfile | null>(null);

  function handleChange(profileId: string, role: UserRole) {
    setPendingId(profileId);
    setRowState((prev) => ({ ...prev, [profileId]: {} }));
    startTransition(async () => {
      const result = await updateUserRoleAction(profileId, role);
      if (result.error) {
        setRowState((prev) => ({ ...prev, [profileId]: { error: result.error } }));
      } else {
        setRoles((prev) => ({ ...prev, [profileId]: role }));
        setRowState((prev) => ({ ...prev, [profileId]: { saved: true } }));
      }
      setPendingId(null);
    });
  }

  return (
    <>
      <div className="divide-y divide-slate-100">
        {profiles.map((profile) => {
          const isSelf = profile.id === currentUserId;
          const busy = isPending && pendingId === profile.id;
          const state = rowState[profile.id];

          return (
            <div key={profile.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <InitialsAvatar name={profile.fullName} initials={profile.initials} className="h-9 w-9 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-900">
                  {profile.fullName}
                  {isSelf && <span className="text-xs font-normal text-slate-400">(you)</span>}
                  {!profile.active && (
                    <Pill label="Deactivated" className="bg-slate-100 text-slate-500" />
                  )}
                </p>
                <p className="truncate text-xs text-slate-500">{profile.email}</p>
                {state?.error && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {state.error}
                  </p>
                )}
                {state?.saved && !busy && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-brand-green-mid">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    Saved
                  </p>
                )}
              </div>
              <select
                value={roles[profile.id]}
                disabled={isSelf || busy}
                onChange={(event) => handleChange(profile.id, event.target.value as UserRole)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditingTeammate(profile)}
                  aria-label={`Edit ${profile.fullName}`}
                  className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveToggleTeammate(profile)}
                  disabled={isSelf}
                  aria-label={profile.active ? `Deactivate ${profile.fullName}` : `Reactivate ${profile.fullName}`}
                  className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                >
                  {profile.active ? <UserX className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editingTeammate && <EditTeammateModal teammate={editingTeammate} onClose={() => setEditingTeammate(null)} />}
      {activeToggleTeammate && (
        <SetTeammateActiveModal
          teammateId={activeToggleTeammate.id}
          teammateName={activeToggleTeammate.fullName}
          active={activeToggleTeammate.active}
          onClose={() => setActiveToggleTeammate(null)}
        />
      )}
    </>
  );
}
