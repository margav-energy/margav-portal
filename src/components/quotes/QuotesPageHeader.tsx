"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuotesPageHeader() {
  const [favorite, setFavorite] = useState(false);

  return (
    <div className="flex items-center justify-between">
      <h2 className="text-2xl font-semibold tracking-wide text-slate-900 uppercase">Quotes</h2>
      <button
        type="button"
        onClick={() => setFavorite((current) => !current)}
        aria-label="Toggle favourite"
        aria-pressed={favorite}
        className="text-slate-300 hover:text-slate-400"
      >
        <Star className={cn("h-5 w-5", favorite && "fill-amber-400 text-amber-400")} />
      </button>
    </div>
  );
}
