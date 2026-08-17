"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/** Small icon button that copies `value` to the clipboard, with a brief confirmation. */
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — silently ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy to clipboard"
      className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-brand-green-mid" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
