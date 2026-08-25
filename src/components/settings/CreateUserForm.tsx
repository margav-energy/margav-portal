"use client";

import { useState, useTransition } from "react";
import { AlertCircle, CheckCircle2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createUserAction, type UserRole } from "@/app/settings/users/actions";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "rep", label: "Rep" },
  { value: "installer", label: "Installer" },
  { value: "admin", label: "Admin" },
];

type Feedback = { kind: "error"; message: string } | { kind: "password"; email: string; password: string } | { kind: "invited"; email: string };

/** Admin-only "add teammate" form on Settings → Team Members — creates the
 *  auth account and profiles row in one step (see `createUserAction`)
 *  instead of the old manual-SQL-insert-only path. */
export function CreateUserForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("rep");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const submittedName = fullName.trim();
    const submittedEmail = email.trim();

    startTransition(async () => {
      const result = await createUserAction(submittedName, submittedEmail, role);
      if (result.error) {
        setFeedback({ kind: "error", message: result.error });
        return;
      }
      if (result.temporaryPassword) {
        setFeedback({ kind: "password", email: submittedEmail, password: result.temporaryPassword });
      } else {
        setFeedback({ kind: "invited", email: submittedEmail });
      }
      setFullName("");
      setEmail("");
      setRole("rep");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.2fr_1.5fr_1fr_auto]">
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

      {feedback?.kind === "error" && (
        <p className="flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {feedback.message}
        </p>
      )}

      {feedback?.kind === "invited" && (
        <p className="flex items-center gap-1.5 text-sm text-brand-green-mid">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {feedback.email} has been added and emailed their login details.
        </p>
      )}

      {feedback?.kind === "password" && (
        <div className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {feedback.email} has been added — couldn&rsquo;t email their login, so share this with them yourself:
          </p>
          <p className="font-mono text-sm">
            Email: {feedback.email}
            <br />
            Temporary password: {feedback.password}
          </p>
        </div>
      )}
    </form>
  );
}
