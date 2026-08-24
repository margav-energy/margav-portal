"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { updateUserRoleAction, type UserRole } from "@/app/settings/users/actions";
import type { RepProfile } from "@/data/profiles-service";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "rep", label: "Rep" },
  { value: "installer", label: "Installer" },
];

export function UserRoleManager({
  profiles,
  currentUserId,
}: {
  profiles: RepProfile[];
  currentUserId: string;
}) {
  const [roles, setRoles] = useState<Record<string, UserRole>>(() =>
    Object.fromEntries(profiles.map((profile) => [profile.id, profile.role])),
  );
  const [rowState, setRowState] = useState<Record<string, { error?: string; saved?: boolean }>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    <div className="divide-y divide-slate-100">
      {profiles.map((profile) => {
        const isSelf = profile.id === currentUserId;
        const busy = isPending && pendingId === profile.id;
        const state = rowState[profile.id];

        return (
          <div key={profile.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
            <InitialsAvatar name={profile.fullName} initials={profile.initials} className="h-9 w-9 text-xs" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">
                {profile.fullName}
                {isSelf && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}
              </p>
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
          </div>
        );
      })}
    </div>
  );
}
