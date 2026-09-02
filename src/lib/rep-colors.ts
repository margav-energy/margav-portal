/**
 * Per-rep calendar colour — an admin can pick one explicitly per teammate
 * (Settings → Team Members, stored as `profiles.calendar_color`); anyone
 * without one gets a colour deterministically hashed from their name, so
 * every rep still has *a* stable colour with zero setup.
 *
 * Everything here works from a hex value rather than Tailwind classes —
 * since a custom pick can be any hex, there's no fixed set of classes to
 * hand out. `blockStyle` fills a whole calendar block with the colour
 * (light tint background, full-colour border and text — the same
 * `bg-x/10 text-x border-x/40` pattern used elsewhere in this app, just
 * computed as inline styles). For a small swatch dot, use `hex` directly as
 * an inline `backgroundColor`.
 */

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface RepColor {
  hex: string;
  blockStyle: { backgroundColor: string; borderColor: string; color: string };
}

export function repColorFromHex(hex: string): RepColor {
  return {
    hex,
    blockStyle: {
      backgroundColor: hexToRgba(hex, 0.14),
      borderColor: hexToRgba(hex, 0.45),
      color: hex,
    },
  };
}

/** The picker offered on Settings → Team Members — also what automatic (unset) colours are hashed into. */
export const REP_COLOR_PALETTE_HEX: string[] = [
  "#8b5cf6",
  "#0ea5e9",
  "#f59e0b",
  "#f43f5e",
  "#10b981",
  "#f97316",
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#d946ef",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Null for "Unallocated"/blank — those intentionally get no rep colour.
 * `calendarColorHex` (a rep's manually-picked colour, if any) wins when
 * given; otherwise falls back to the deterministic name-hash colour.
 */
export function repColorFor(repName: string | null | undefined, calendarColorHex?: string | null): RepColor | null {
  if (!repName || repName === "Unallocated") return null;
  const hex = calendarColorHex || REP_COLOR_PALETTE_HEX[hashString(repName) % REP_COLOR_PALETTE_HEX.length];
  return repColorFromHex(hex);
}
