"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { STATIC_SLIDES_BEFORE, THANK_YOU_SLIDE } from "@/components/quotes/presenter/slides/StaticSlides";
import {
  MonthlyCostSlide,
  QuotationSlide,
  SystemSummarySlide,
  defaultTermMonthsFor,
} from "@/components/quotes/presenter/slides/PersonalizedSlides";
import type { PresenterSlide } from "@/components/quotes/presenter/types";
import { cn } from "@/lib/utils";
import type { BoilerQuoteDetail } from "@/types/boiler-quote";

export function BoilerPresenter({ detail }: { detail: BoilerQuoteDetail }) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [installDate, setInstallDate] = useState("");
  const [examplePrice, setExamplePrice] = useState(detail.keyDetails.price);
  const [termMonths, setTermMonths] = useState(defaultTermMonthsFor(detail.selectedPaymentMethod));
  const [monthlyPayment, setMonthlyPayment] = useState(
    Math.round(detail.keyDetails.price / defaultTermMonthsFor(detail.selectedPaymentMethod)),
  );

  const quoteHref = `/quotes/${detail.quoteId}`;

  function handleChangeExamplePrice(value: number) {
    setExamplePrice(value);
    if (termMonths > 0) setMonthlyPayment(Math.round(value / termMonths));
  }

  function handleChangeTermMonths(value: number) {
    const safeTerm = Math.max(1, value);
    setTermMonths(safeTerm);
    setMonthlyPayment(Math.round(examplePrice / safeTerm));
  }

  const slides: PresenterSlide[] = [
    ...STATIC_SLIDES_BEFORE,
    {
      id: "system-summary",
      node: <SystemSummarySlide detail={detail} installDate={installDate} onChangeInstallDate={setInstallDate} />,
    },
    { id: "quotation", node: <QuotationSlide detail={detail} /> },
    {
      id: "monthly-cost",
      node: (
        <MonthlyCostSlide
          examplePrice={examplePrice}
          termMonths={termMonths}
          monthlyPayment={monthlyPayment}
          onChangeExamplePrice={handleChangeExamplePrice}
          onChangeTermMonths={handleChangeTermMonths}
          onChangeMonthlyPayment={setMonthlyPayment}
        />
      ),
    },
    THANK_YOU_SLIDE,
  ];

  const total = slides.length;
  const currentSlide = slides[currentIndex];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setCurrentIndex((index) => Math.min(total - 1, index + 1));
      if (event.key === "ArrowLeft") setCurrentIndex((index) => Math.max(0, index - 1));
      if (event.key === "Escape") router.push(quoteHref);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [total, router, quoteHref]);

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

      <div className={cn("flex-1 overflow-y-auto", !currentSlide.fullBleed && "p-10")}>
        <div className={currentSlide.fullBleed ? "h-full" : "mx-auto w-full max-w-5xl"}>{currentSlide.node}</div>
      </div>

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
          {slides.map((slide, index) => (
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
