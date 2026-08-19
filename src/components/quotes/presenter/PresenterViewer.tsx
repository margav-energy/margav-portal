"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { MonthlyCostSlide, PricingSlide, SystemSummarySlide } from "@/components/quotes/presenter/slides/PersonalizedSlides";
import type { PresenterDeck } from "@/data/presenter-deck-service";
import { cn } from "@/lib/utils";
import type { BoilerQuoteDetail } from "@/types/boiler-quote";

export function PresenterViewer({ deck, detail }: { deck: PresenterDeck; detail: BoilerQuoteDetail }) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [installDate, setInstallDate] = useState("");

  const total = deck.slides.length;
  const currentSlide = deck.slides[currentIndex];
  const quoteHref = `/quotes/${detail.quoteId}`;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setCurrentIndex((index) => Math.min(total - 1, index + 1));
      if (event.key === "ArrowLeft") setCurrentIndex((index) => Math.max(0, index - 1));
      if (event.key === "Escape") router.push(quoteHref);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [total, router, quoteHref]);

  function renderSlide() {
    switch (currentSlide.slideType) {
      case "quote_system_summary":
        return <SystemSummarySlide detail={detail} installDate={installDate} onChangeInstallDate={setInstallDate} />;
      case "quote_pricing":
        return <PricingSlide detail={detail} />;
      case "quote_monthly_cost":
        return <MonthlyCostSlide detail={detail} />;
      case "image":
      default:
        return currentSlide.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- fixed-size uploaded slide image, not a responsive content image next/image is built for.
          <img src={currentSlide.imageUrl} alt={`Slide ${currentSlide.position}`} className="h-full w-full object-contain" />
        ) : (
          <p className="text-sm text-slate-400">This slide is missing its image.</p>
        );
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-3">
        <span className="text-sm font-medium text-slate-400">
          Slide {currentIndex + 1} / {total}
        </span>
        <Link
          href={quoteHref}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
          Exit
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-y-auto bg-slate-50 p-6">{renderSlide()}</div>

      <div className="flex shrink-0 items-center justify-center gap-6 border-t border-slate-100 px-6 py-4">
        <button
          type="button"
          onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:enabled:bg-slate-100 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>

        <div className="flex gap-1.5">
          {deck.slides.map((slide, index) => (
            <span
              key={slide.id}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                index === currentIndex ? "bg-brand-blue" : "bg-slate-200",
              )}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setCurrentIndex((index) => Math.min(total - 1, index + 1))}
          disabled={currentIndex === total - 1}
          className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:enabled:bg-slate-100 disabled:opacity-30"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
