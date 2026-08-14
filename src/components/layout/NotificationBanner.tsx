"use client";

import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";

export function NotificationBanner() {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
      <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-green-mid" />
      <p className="flex-1 text-sm text-slate-700">
        Margav Portal has been updated with the new Quotes dashboard.
      </p>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => setIsDismissed(true)}
        className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
