"use client";

import { useRef, useState } from "react";
import { Dancing_Script } from "next/font/google";

/**
 * Shared "draw or type" signature capture — used both by the public
 * `/sign/[token]` customer form and the portal's "My signature" settings
 * card (reps save one signature, stamped onto every quote they send — see
 * `src/data/signature-service.ts`). Always emits a PNG data URL, however
 * the signature was produced, so callers don't care which mode was used.
 */
const signatureFont = Dancing_Script({ subsets: ["latin"], weight: "700" });

const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 160;

async function renderTypedSignature(text: string): Promise<string> {
  const fontFamily = signatureFont.style.fontFamily;
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await document.fonts.load(`48px ${fontFamily}`);
      await document.fonts.ready;
    } catch {
      // Font Loading API isn't universally supported — fall through and
      // draw anyway; worst case the fallback font in the stack is used.
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  ctx.font = `48px ${fontFamily}`;
  ctx.fillStyle = "#0f172a";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, 16, CANVAS_HEIGHT / 2, CANVAS_WIDTH - 32);

  return canvas.toDataURL("image/png");
}

function DrawPad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = getPoint(event);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function finishStroke() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    setHasDrawn(true);
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  }

  function handleClear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerLeave={finishStroke}
        className="w-full touch-none rounded-lg border border-slate-300 bg-white"
        style={{ height: CANVAS_HEIGHT }}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Draw your signature above using your mouse, finger, or stylus.</p>
        {hasDrawn && (
          <button type="button" onClick={handleClear} className="text-xs font-medium text-brand-blue hover:underline">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function TypePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const [text, setText] = useState("");

  async function handleChange(value: string) {
    setText(value);
    if (!value.trim()) {
      onChange(null);
      return;
    }
    try {
      const dataUrl = await renderTypedSignature(value.trim());
      onChange(dataUrl);
    } catch (error) {
      console.error("renderTypedSignature failed", error);
      onChange(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={text}
        onChange={(event) => void handleChange(event.target.value)}
        placeholder="Type your name"
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-blue"
      />
      <div
        className="flex h-40 w-full items-center rounded-lg border border-slate-300 bg-white px-4"
        style={{ height: CANVAS_HEIGHT }}
      >
        <span className={signatureFont.className} style={{ fontSize: 40, color: "#0f172a" }}>
          {text || <span className="text-base text-slate-300">Your signature preview</span>}
        </span>
      </div>
      <p className="text-xs text-slate-400">Your typed name is rendered in a signature-style font.</p>
    </div>
  );
}

export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const [mode, setMode] = useState<"draw" | "type">("draw");

  function handleModeChange(next: "draw" | "type") {
    setMode(next);
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex w-fit rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm">
        {(["draw", "type"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleModeChange(option)}
            className={
              mode === option
                ? "rounded-md bg-white px-3 py-1 font-medium text-slate-900 shadow-sm"
                : "rounded-md px-3 py-1 text-slate-500"
            }
          >
            {option === "draw" ? "Draw" : "Type"}
          </button>
        ))}
      </div>
      {mode === "draw" ? <DrawPad onChange={onChange} /> : <TypePad onChange={onChange} />}
    </div>
  );
}
