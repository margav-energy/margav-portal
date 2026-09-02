"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { REP_COLOR_PALETTE_HEX } from "@/lib/rep-colors";
import { setTeammateCalendarColorAction } from "@/app/settings/users/actions";

/**
 * Lets an admin pin a teammate's calendar colour (Settings → Team Members)
 * instead of the automatic name-hash colour every rep gets by default —
 * see `repColorFor` in src/lib/rep-colors.ts. "Auto" clears the override.
 */
export function RepColorPicker({
  teammateId,
  currentColor,
}: {
  teammateId: string;
  currentColor?: string;
}) {
  const [color, setColor] = useState(currentColor ?? null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handlePick(nextColor: string | null) {
    setError(null);
    const previous = color;
    setColor(nextColor);
    startTransition(async () => {
      const result = await setTeammateCalendarColorAction(teammateId, nextColor);
      if (result.error) {
        setColor(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => handlePick(null)}
          disabled={isPending}
          title="Use the automatic colour"
          aria-label="Use the automatic colour"
          aria-pressed={color === null}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full border-2 text-[9px] font-semibold text-slate-400 disabled:cursor-not-allowed",
            color === null ? "border-slate-400" : "border-slate-200 hover:border-slate-300",
          )}
        >
          A
        </button>
        {REP_COLOR_PALETTE_HEX.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => handlePick(hex)}
            disabled={isPending}
            title={hex}
            aria-label={`Set calendar colour to ${hex}`}
            aria-pressed={color === hex}
            style={{ backgroundColor: hex }}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border-2 disabled:cursor-not-allowed",
              color === hex ? "border-slate-500" : "border-transparent",
            )}
          >
            {color === hex && <Check className="h-3.5 w-3.5 text-white" />}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
