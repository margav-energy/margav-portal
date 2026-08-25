/**
 * Deterministic color hashed from a name — same input always gets the same
 * color, with no state or lookup table to keep in sync. Originally just
 * `InitialsAvatar`'s accent; shared here so anything else that needs to tie
 * back to "whose is this" (e.g. the installer availability grid's booked-job
 * chips and row accent, src/components/availability/InstallerAvailabilityGrid.tsx)
 * uses the exact same color as that person's avatar instead of inventing a
 * second, unrelated palette.
 *
 * Every class below is a literal string (never built by concatenation) —
 * Tailwind only generates CSS for class names it can find as-written in
 * source, so a runtime-assembled class like `border-l-${color}` would
 * silently produce no styling at all.
 */
interface NameAccent {
  /** "bg-x/10 text-x" — avatar fill and chip background+text. */
  chip: string;
  /** "border-x" — a left-edge accent strip, same hue as `chip`. */
  border: string;
}

const PALETTE: NameAccent[] = [
  { chip: "bg-brand-blue/10 text-brand-blue", border: "border-brand-blue" },
  { chip: "bg-brand-green-mid/10 text-brand-green-mid", border: "border-brand-green-mid" },
  { chip: "bg-purple-100 text-purple-600", border: "border-purple-500" },
  { chip: "bg-rose-100 text-rose-600", border: "border-rose-500" },
  { chip: "bg-amber-100 text-amber-700", border: "border-amber-500" },
  { chip: "bg-slate-200 text-slate-600", border: "border-slate-400" },
];

function indexForName(name: string): number {
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return sum % PALETTE.length;
}

export function accentForName(name: string): string {
  return PALETTE[indexForName(name)].chip;
}

export function borderAccentForName(name: string): string {
  return PALETTE[indexForName(name)].border;
}
