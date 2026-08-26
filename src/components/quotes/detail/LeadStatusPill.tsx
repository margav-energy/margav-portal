"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pill } from "@/components/ui/Pill";
import { QUOTE_PIPELINE_STATUS_ORDER, QUOTE_PIPELINE_STATUS_STYLES } from "@/lib/status-colors";
import { updateQuotePipelineStatusAction } from "@/components/quotes/actions";
import type { QuotePipelineStatus } from "@/types/quote";

/**
 * The lead's stage in the header — New Lead → Ready to Pitch → Locked →
 * Complete, color-coded via `QUOTE_PIPELINE_STATUS_STYLES` (same map the
 * quotes list's `QuotePipelineStatusPill` already uses, so the color for
 * a given stage is consistent everywhere it shows up). Admin-only: a rep
 * or installer sees the same colored pill, just without the dropdown —
 * `updateQuotePipelineStatusAction` enforces this server-side too, this
 * just avoids offering a control that would only error.
 */
export function LeadStatusPill({
  quoteId,
  customerName,
  status,
  isAdmin,
}: {
  quoteId: string;
  customerName: string;
  status: QuotePipelineStatus;
  isAdmin: boolean;
}) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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

  const { label, className } = QUOTE_PIPELINE_STATUS_STYLES[currentStatus];

  if (!isAdmin) {
    return <Pill label={label} className={className} />;
  }

  function handleSelect(next: QuotePipelineStatus) {
    setIsOpen(false);
    if (next === currentStatus) return;
    const previous = currentStatus;
    setCurrentStatus(next);
    setError(null);
    startTransition(async () => {
      const result = await updateQuotePipelineStatusAction(quoteId, next, customerName);
      if (result.error) {
        setCurrentStatus(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-opacity hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        {label}
        <ChevronDown className="h-3 w-3" />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-10 mt-2 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
          {QUOTE_PIPELINE_STATUS_ORDER.map((option) => {
            const optionStyle = QUOTE_PIPELINE_STATUS_STYLES[option];
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleSelect(option)}
                className="flex w-full items-center rounded-md px-1.5 py-1.5 text-left hover:bg-slate-50"
              >
                <Pill label={optionStyle.label} className={optionStyle.className} />
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="absolute left-0 top-full z-10 mt-1 w-48 rounded-md bg-red-50 px-2 py-1 text-xs font-normal text-red-600 shadow-sm">
          {error}
        </p>
      )}
    </div>
  );
}
