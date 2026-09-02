"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createUserAction, type UserRole } from "@/app/settings/users/actions";
import { clearDraft, loadDraft, useAutosaveDraft } from "@/hooks/useAutosaveDraft";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "rep", label: "Rep" },
  { value: "installer", label: "Installer" },
  { value: "admin", label: "Admin" },
];

const MIN_PASSWORD_LENGTH = 8;
const DRAFT_KEY = "create-user-draft";

/** Never includes `password` — localStorage is unencrypted and persists past the session. */
type CreateUserDraft = { fullName: string; email: string; role: UserRole };

type Feedback = { kind: "error"; message: string } | { kind: "success"; email: string; emailSent: boolean };

/** Admin-only "add teammate" form on Settings → Team Members — creates the
 *  auth account and profiles row in one step (see `createUserAction`)
 *  instead of the old manual-SQL-insert-only path. The admin sets the
 *  password themselves rather than one being generated for them. */
export function CreateUserForm() {
  const [fullName, setFullName] = useState(() => loadDraft<CreateUserDraft>(DRAFT_KEY)?.fullName ?? "");
  const [email, setEmail] = useState(() => loadDraft<CreateUserDraft>(DRAFT_KEY)?.email ?? "");
  // Password is never restored from a draft — re-entering it is required.
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(() => loadDraft<CreateUserDraft>(DRAFT_KEY)?.role ?? "rep");
  const [draftRestored, setDraftRestored] = useState(() => loadDraft<CreateUserDraft>(DRAFT_KEY) !== null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isPending, startTransition] = useTransition();

  // Password is intentionally never persisted — see `CreateUserDraft`.
  useAutosaveDraft(DRAFT_KEY, { fullName, email, role });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const submittedName = fullName.trim();
    const submittedEmail = email.trim();
    const submittedPassword = password;

    startTransition(async () => {
      const result = await createUserAction(submittedName, submittedEmail, submittedPassword, role);
      if (result.error) {
        setFeedback({ kind: "error", message: result.error });
        return;
      }
      setFeedback({ kind: "success", email: submittedEmail, emailSent: result.emailSent ?? false });
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("rep");
      setDraftRestored(false);
      clearDraft(DRAFT_KEY);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {draftRestored && (
        <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Unsaved details from your last session were restored. Re-enter the password.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Full name"
          required
          disabled={isPending}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          required
          disabled={isPending}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.5fr_1fr_auto]">
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          disabled={isPending}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole)}
          disabled={isPending}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Button type="submit" disabled={isPending} className="flex items-center justify-center gap-1.5 whitespace-nowrap">
          <UserPlus className="h-4 w-4" />
          {isPending ? "Adding…" : "Add teammate"}
        </Button>
      </div>
      <p className="text-xs text-slate-400">
        At least {MIN_PASSWORD_LENGTH} characters. They can change it from Settings once they&rsquo;re in.
      </p>

      {feedback?.kind === "error" && (
        <p className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {feedback.message}
        </p>
      )}

      {feedback?.kind === "success" && feedback.emailSent && (
        <p className="flex items-center gap-1.5 text-sm text-brand-green-mid">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {feedback.email} has been added and emailed their login details.
        </p>
      )}

      {feedback?.kind === "success" && !feedback.emailSent && (
        <p className="flex items-center gap-1.5 text-sm text-brand-green-mid">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {feedback.email} has been added — share the email and password you set with them yourself.
        </p>
      )}
    </form>
  );
}
