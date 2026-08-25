"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Root error boundary — catches a crash in any page under this segment
 * while `layout.tsx` (and therefore the Sidebar/Topbar, including "Sign
 * out" in the UserMenu) stays mounted and usable. Without this file at all,
 * an uncaught render error had nowhere to be caught and took the whole
 * app shell down with it — no nav, no sign-out, nothing to click.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <AlertTriangle className="h-10 w-10 text-red-500" />
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          This page hit an error. You can try again, or use the menu in the top-right to sign out.
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
