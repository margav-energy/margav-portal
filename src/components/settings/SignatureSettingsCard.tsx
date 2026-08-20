"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SignaturePad } from "@/components/esignature/SignaturePad";
import { saveMySignatureAction, clearMySignatureAction } from "@/app/settings/actions";

/**
 * "My signature" — drawn/typed once here, then stamped automatically onto
 * every quote this rep sends once the customer signs (no per-quote signing
 * step). See `src/data/profile-signature-service.ts` /
 * `src/data/signature-service.ts`.
 */
export function SignatureSettingsCard({ signatureUrl }: { signatureUrl: string | undefined }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [hasSaved, setHasSaved] = useState(Boolean(signatureUrl));

  async function handleSave() {
    if (!dataUrl) return;
    setIsSaving(true);
    setMessage(null);
    const result = await saveMySignatureAction(dataUrl);
    setIsSaving(false);
    if (result.ok) {
      setMessage({ type: "success", text: "Signature saved." });
      setHasSaved(true);
    } else {
      setMessage({ type: "error", text: result.error ?? "Could not save your signature." });
    }
  }

  async function handleRemove() {
    setIsSaving(true);
    setMessage(null);
    const result = await clearMySignatureAction();
    setIsSaving(false);
    if (result.ok) {
      setMessage({ type: "success", text: "Signature removed." });
      setHasSaved(false);
      setDataUrl(null);
    } else {
      setMessage({ type: "error", text: result.error ?? "Could not remove your signature." });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-500">
        Saved here once, this gets stamped onto every quote you send as the assigned rep — no need to sign each one.
      </p>

      {hasSaved && signatureUrl && !dataUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- a private signed URL, not a next/image candidate.
        <img src={signatureUrl} alt="Your saved signature" className="h-20 w-fit rounded-lg border border-slate-200 bg-white px-4" />
      )}

      <SignaturePad onChange={setDataUrl} />

      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            message.type === "success" ? "bg-brand-green-mid/10 text-brand-green-mid" : "bg-red-50 text-red-600"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <div className="flex gap-2">
        <Button type="button" onClick={handleSave} disabled={!dataUrl || isSaving}>
          {isSaving ? "Saving…" : "Save signature"}
        </Button>
        {hasSaved && (
          <Button type="button" variant="secondary" onClick={handleRemove} disabled={isSaving}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
