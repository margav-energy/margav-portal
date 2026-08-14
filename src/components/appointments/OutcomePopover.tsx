"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

const OUTCOME_OPTIONS = ["Sat - Sold", "Sat - No Sale", "No Show", "Rescheduled"];

export function OutcomePopover({ onSelect }: { onSelect: (outcome: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <Button variant="primary" className="px-3 py-1.5 text-xs" onClick={() => setIsOpen((open) => !open)}>
        Outcome
      </Button>
      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {OUTCOME_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onSelect(option);
                setIsOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
