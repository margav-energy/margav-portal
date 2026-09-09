"use client";

import { useRevealSensitive } from "@/components/dashboard/RevealSensitiveContext";
import { RevealEyeButton } from "@/components/dashboard/RevealEyeButton";

/**
 * Split out from `StatCard` so that component can stay a Server Component
 * (it receives a `LucideIcon` prop — a function — which can't cross a
 * Server → Client boundary). Only this leaf needs the reveal state.
 */
export function MaskedNumber({ value, mask = "**" }: { value: number; mask?: string }) {
  const { isRevealed } = useRevealSensitive();
  return (
    <span className="inline-flex items-center gap-2">
      <span>{isRevealed ? value : mask}</span>
      <RevealEyeButton className="h-5 w-5 [&>svg]:h-5 [&>svg]:w-5" />
    </span>
  );
}
