"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRevealSensitive } from "@/components/dashboard/RevealSensitiveContext";
import { cn } from "@/lib/utils";

/**
 * Small icon-only reveal toggle, dropped in next to each masked figure
 * (stat cards, quote row prices) rather than one button elsewhere on the
 * page — all instances share the same `RevealSensitiveContext` state, so
 * clicking any one of them reveals/hides every masked figure at once.
 */
export function RevealEyeButton({ className }: { className?: string }) {
  const { isRevealed, toggle } = useRevealSensitive();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isRevealed}
      aria-label={isRevealed ? "Hide figures" : "Show figures"}
      title={isRevealed ? "Hide figures" : "Show figures"}
      className={cn("shrink-0 text-slate-400 hover:text-slate-600", className)}
    >
      {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}
