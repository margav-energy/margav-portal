"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Mail, History as HistoryIcon, Lock, Unlock, ChevronDown, Info, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { Modal } from "@/components/ui/Modal";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { LeadStatusPill } from "@/components/quotes/detail/LeadStatusPill";
import { cn } from "@/lib/utils";
import {
  deleteQuoteAction,
  logCommunicationsOpened,
  sendCommunicationEmail,
  setQuoteLocked,
  toggleQuoteFavourite,
  assignQuoteRepresentative,
} from "@/components/quotes/actions";
import type { RepProfile } from "@/data/profiles-service";
import type { QuotePipelineStatus } from "@/types/quote";

function initialsFor(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function DropdownButton({
  label,
  icon,
  options,
  optionDescriptions,
  onSelect,
}: {
  label: string;
  icon: React.ReactNode;
  options: string[];
  optionDescriptions?: Record<string, string>;
  onSelect: (option: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {icon}
        {label}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onSelect(option);
                setIsOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="font-medium">{option}</span>
              {optionDescriptions?.[option] && (
                <span className="block text-xs text-slate-400">{optionDescriptions[option]}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CommunicationsModal({
  quoteId,
  customerName,
  customerEmail,
  onClose,
}: {
  quoteId: string;
  customerName: string;
  customerEmail: string;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSend(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await sendCommunicationEmail(quoteId, customerName, customerEmail, subject, message);
      if (!result.ok) {
        setError(result.error ?? "Could not send the email. Please try again.");
        return;
      }
      setIsSent(true);
    });
  }

  return (
    <Modal title="Communications" onClose={onClose}>
      <form onSubmit={handleSend} className="flex flex-col gap-4 px-5 py-5">
        {isSent && (
          <div className="flex items-center gap-2 rounded-lg border border-brand-green-mid/20 bg-brand-green-mid/10 px-4 py-3 text-sm font-medium text-brand-green-mid">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Email sent to {customerEmail}.
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <FormField label="To" htmlFor="comms-to">
          <input id="comms-to" className={inputClassName} value={customerEmail} disabled />
        </FormField>
        <FormField label="Subject" htmlFor="comms-subject" required>
          <input
            id="comms-subject"
            className={inputClassName}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={isSent}
          />
        </FormField>
        <FormField label="Message" htmlFor="comms-message" required>
          <textarea
            id="comms-message"
            rows={6}
            className={cn(inputClassName, "resize-y")}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={isSent}
          />
        </FormField>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            {isSent ? "Close" : "Cancel"}
          </Button>
          {!isSent && (
            <Button type="submit" variant="success" disabled={isPending || !subject.trim() || !message.trim()}>
              {isPending ? "Sending…" : "Send"}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function DeleteQuoteModal({
  quoteId,
  customerName,
  reference,
  onClose,
}: {
  quoteId: string;
  customerName: string;
  reference: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteQuoteAction(quoteId, customerName);
      if (!result.ok) {
        setError(result.error ?? "Could not delete the quote. Please try again.");
        return;
      }
      router.push("/quotes");
    });
  }

  return (
    <Modal title={`Delete ${reference}?`} onClose={onClose}>
      <div className="flex flex-col gap-4 p-5">
        <p className="text-sm text-slate-600">
          This permanently deletes <span className="font-medium text-slate-900">{customerName}</span>&rsquo;s quote —
          property details, units, line items, notes, history, documents and signature requests all go with it. This
          can&rsquo;t be undone. Any linked appointment is kept, not deleted.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Deleting…" : "Delete quote"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Reference/status/lock/rep header used by every product vertical's quote
 * detail page. The action-button grid lives separately in the right
 * sidebar (see `ActionButtonGrid.tsx`) since it sits alongside Payment
 * method / Key details there, not in this top bar.
 */
export function QuoteHeader({
  quoteId,
  customerName,
  customerEmail,
  reference,
  version,
  statusLabel,
  pipelineStatus,
  isAdmin,
  locked,
  onToggleLocked,
  favorite,
  onToggleFavorite,
  assignedRepName,
  reps,
  onChangeRep,
  onOpenHistory,
  noteCount,
  appointmentCancelled,
}: {
  quoteId: string;
  customerName: string;
  customerEmail: string;
  reference: string;
  version: number;
  statusLabel: string;
  pipelineStatus: QuotePipelineStatus;
  isAdmin: boolean;
  locked: boolean;
  onToggleLocked: (locked: boolean) => void;
  favorite: boolean;
  onToggleFavorite: (favorite: boolean) => void;
  assignedRepName: string;
  reps: RepProfile[];
  onChangeRep: (repId: string, repName: string) => void;
  onOpenHistory: () => void;
  noteCount: number;
  /** Set once the "Cancel App" action button (ActionButtonGrid.tsx) has
   *  been clicked — see its doc comment in build-action-buttons.ts for why
   *  this piggybacks on `install_status` instead of a real appointment
   *  record. Otherwise the click had no visible effect anywhere on this
   *  page, which read as "the button doesn't work". */
  appointmentCancelled?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [isCommsOpen, setIsCommsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  function handleToggleFavorite() {
    const next = !favorite;
    onToggleFavorite(next);
    startTransition(() => {
      void toggleQuoteFavourite(quoteId, next, customerName);
    });
  }

  function handleToggleLocked(nextLocked: boolean) {
    onToggleLocked(nextLocked);
    startTransition(() => {
      void setQuoteLocked(quoteId, nextLocked, customerName);
    });
  }

  function handleChangeRep(repName: string) {
    const rep = reps.find((candidate) => candidate.fullName === repName);
    if (!rep) return;
    onChangeRep(rep.id, rep.fullName);
    startTransition(() => {
      void assignQuoteRepresentative(quoteId, rep.id, customerName);
    });
  }

  function handleOpenCommunications() {
    setIsCommsOpen(true);
    startTransition(() => {
      void logCommunicationsOpened(quoteId, customerName);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-slate-900">{reference}</h1>
          <Pill label={`V${version}`} className="bg-slate-100 text-slate-500" />
          <Pill label={statusLabel} className="bg-brand-green-mid/10 text-brand-green-mid" />
          <LeadStatusPill quoteId={quoteId} customerName={customerName} status={pipelineStatus} isAdmin={isAdmin} />
          {appointmentCancelled && <Pill label="Appointment Cancelled" className="bg-red-50 text-red-600" />}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleFavorite}
            aria-label="Toggle favourite"
            aria-pressed={favorite}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 hover:bg-slate-50"
          >
            <Star className={cn("h-4 w-4", favorite && "fill-amber-400 text-amber-400")} />
          </button>
          <Button variant="secondary" className="gap-1.5" onClick={handleOpenCommunications}>
            <Mail className="h-4 w-4" />
            Communications
          </Button>
          <Button variant="secondary" className="gap-1.5" onClick={onOpenHistory}>
            <HistoryIcon className="h-4 w-4" />
            History
          </Button>
          <DropdownButton
            label={locked ? "Locked" : "Unlocked"}
            icon={
              locked ? (
                <Lock className="h-3.5 w-3.5 text-slate-400" />
              ) : (
                <Unlock className="h-3.5 w-3.5 text-slate-400" />
              )
            }
            options={["Lock", "Unlock"]}
            optionDescriptions={{
              Lock: "Restrict changes that can be made",
              Unlock: "No restrictions on changes that can be made",
            }}
            onSelect={(option) => handleToggleLocked(option === "Lock")}
          />
          {isAdmin ? (
            <DropdownButton
              label={assignedRepName}
              icon={
                <InitialsAvatar
                  name={assignedRepName}
                  initials={initialsFor(assignedRepName)}
                  className="h-5 w-5 text-[10px]"
                />
              }
              options={reps.map((rep) => rep.fullName)}
              onSelect={handleChangeRep}
            />
          ) : (
            // Reps can see who a quote's assigned to but not reassign it —
            // see `assignQuoteRepresentative`'s doc comment in actions.ts.
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">
              <InitialsAvatar
                name={assignedRepName}
                initials={initialsFor(assignedRepName)}
                className="h-5 w-5 text-[10px]"
              />
              {assignedRepName}
            </div>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsDeleteOpen(true)}
              aria-label="Delete quote"
              title="Delete quote"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {noteCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-brand-blue/5 px-4 py-2.5 text-sm text-brand-blue">
          <Info className="h-4 w-4 shrink-0" />
          There {noteCount === 1 ? "is" : "are"} {noteCount} note{noteCount === 1 ? "" : "s"} against this quote.
        </div>
      )}

      {isCommsOpen && (
        <CommunicationsModal
          quoteId={quoteId}
          customerName={customerName}
          customerEmail={customerEmail}
          onClose={() => setIsCommsOpen(false)}
        />
      )}
      {isDeleteOpen && (
        <DeleteQuoteModal
          quoteId={quoteId}
          customerName={customerName}
          reference={reference}
          onClose={() => setIsDeleteOpen(false)}
        />
      )}
    </div>
  );
}
