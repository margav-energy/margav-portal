import type { LucideIcon } from "lucide-react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared layout building blocks for the Presenter slide deck
 * (`src/components/quotes/presenter/`). Each slide composes one or more of
 * these with the deck's actual copy — see `StaticSlides.tsx` and
 * `PersonalizedSlides.tsx`. Kept deliberately plain (Tailwind + existing
 * brand tokens) rather than pulling in a slide/animation library.
 */

export function SlideHeading({
  title,
  subtitle,
  invert = false,
}: {
  title: string;
  subtitle?: string;
  invert?: boolean;
}) {
  return (
    <div className="mb-8">
      <h2 className={cn("text-3xl font-bold sm:text-4xl", invert ? "text-white" : "text-slate-900")}>{title}</h2>
      {subtitle && (
        <p className={cn("mt-2 text-lg", invert ? "text-white/80" : "text-slate-500")}>{subtitle}</p>
      )}
    </div>
  );
}

export function ComparisonTable({
  leftLabel,
  rightLabel,
  rows,
}: {
  leftLabel: string;
  rightLabel: string;
  rows: { label: string; left: string; right: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="grid grid-cols-[1fr_1.4fr_1.4fr]">
        <div />
        <div className="bg-slate-100 px-5 py-3 text-center font-semibold text-slate-600">{leftLabel}</div>
        <div className="bg-brand-green-mid px-5 py-3 text-center font-semibold text-white">{rightLabel}</div>
      </div>
      {rows.map((row, index) => (
        <div
          key={row.label}
          className={cn(
            "grid grid-cols-[1fr_1.4fr_1.4fr] items-center gap-2 px-5 py-4",
            index % 2 === 1 && "bg-slate-50",
          )}
        >
          <p className="font-semibold text-slate-900">{row.label}</p>
          <div className="flex items-center gap-2 text-slate-500">
            <X className="h-4 w-4 shrink-0 rounded-full bg-brand-blue p-0.5 text-white" />
            {row.left}
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Check className="h-4 w-4 shrink-0 rounded-full bg-brand-green-mid p-0.5 text-white" />
            {row.right}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatGrid({ stats }: { stats: { value: string; label: string; icon: LucideIcon }[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-xl bg-slate-100 p-6 text-center">
          <stat.icon className="mx-auto h-8 w-8 rounded-full bg-brand-blue p-1.5 text-white" />
          <p className="mt-3 text-2xl font-bold text-slate-900">{stat.value}</p>
          <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

export function IconList({
  items,
}: {
  items: { icon: LucideIcon; title: string; description: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.title} className="flex items-start gap-4 rounded-xl bg-slate-100 p-5">
          <item.icon className="h-8 w-8 shrink-0 rounded-full bg-brand-green-mid p-1.5 text-white" />
          <div>
            <p className="font-semibold text-slate-900">{item.title}</p>
            <p className="mt-1 text-slate-600">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Timeline({
  entries,
}: {
  entries: { marker: string; title: string; description: string }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {entries.map((entry) => (
        <div key={entry.marker} className="flex items-stretch gap-4">
          <div className="flex w-28 shrink-0 items-center justify-center rounded-xl bg-brand-blue text-lg font-bold text-white">
            {entry.marker}
          </div>
          <div className="flex-1 rounded-xl bg-slate-100 p-5">
            <p className="font-semibold text-slate-900">{entry.title}</p>
            <p className="mt-1 text-slate-600">{entry.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function InfoCardGrid({
  cards,
}: {
  cards: { icon: LucideIcon; title: string; description: string }[];
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", cards.length >= 4 && "lg:grid-cols-4")}>
      {cards.map((card) => (
        <div key={card.title} className="rounded-xl bg-slate-100 p-6 text-center">
          <card.icon className="mx-auto h-10 w-10 rounded-full bg-brand-blue p-2 text-white" />
          <p className="mt-4 font-semibold text-slate-900">{card.title}</p>
          <p className="mt-2 text-sm text-slate-600">{card.description}</p>
        </div>
      ))}
    </div>
  );
}

export function BigStatCircle({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex h-56 w-56 flex-col items-center justify-center rounded-full border-4 border-brand-blue text-center">
      <p className="text-6xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-slate-500">{label}</p>
    </div>
  );
}

export function IncludedList({
  items,
  tone = "dark",
}: {
  items: string[];
  tone?: "dark" | "light";
}) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item} className="flex items-center gap-3">
          <Check
            className={cn(
              "h-5 w-5 shrink-0 rounded-md p-1",
              tone === "dark" ? "bg-white/20 text-white" : "bg-brand-green-mid text-white",
            )}
          />
          <p className={tone === "dark" ? "text-white" : "text-slate-700"}>{item}</p>
        </div>
      ))}
    </div>
  );
}
