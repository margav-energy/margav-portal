"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { sendQuote } from "@/components/quotes/actions";

/**
 * Confirms + triggers sending a quote to Dropbox Sign for e-signature —
 * opened from the "Send Quote" action button on both `BoilerQuoteDetail`
 * and `SolarQuoteDetail`. Product-agnostic (unlike `BoilerSurveyLaunchModal`,
 * which is boiler-only), so it lives in `detail/` rather than `boiler/`.
 */
export function SendForSignatureModal({
  quoteId,
  customerName,
  customerEmail,
  onClose,
}: {
  quoteId: string;
  customerName: string;
  customerEmail: string;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<"confirm" | "sending" | "sent" | "error">("confirm");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasEmail = customerEmail.trim().length > 0;

  async function handleSend() {
    setStatus("sending");
    const result = await sendQuote(quoteId);
    if (result.ok) {
      setStatus("sent");
    } else {
      setErrorMessage(result.error);
      setStatus("error");
    }
  }

  return (
    <Modal title="Send for Signature" onClose={onClose}>
      <div className="flex flex-col items-center gap-4 px-6 py-6 text-center">
        {!hasEmail ? (
          <p className="text-sm text-red-600">
            {customerName} has no email address on file. Add one on the Customer card before sending for signature.
          </p>
        ) : status === "sent" ? (
          <p className="text-sm text-brand-green-mid">
            Sent to {customerName} ({customerEmail}) for signature via Dropbox Sign.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Send this quote to <span className="font-semibold text-slate-900">{customerName}</span> (
              {customerEmail}) for e-signature via Dropbox Sign?
            </p>
            {status === "error" && errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          </>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
        <Button variant="secondary" onClick={onClose}>
          {status === "sent" ? "Close" : "Cancel"}
        </Button>
        {hasEmail && status !== "sent" && (
          <Button variant="primary" onClick={handleSend} disabled={status === "sending"}>
            {status === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
          </Button>
        )}
      </div>
    </Modal>
  );
}
