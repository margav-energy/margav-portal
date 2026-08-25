"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

export interface HeaderActionButton {
  label: string;
  variant: "primary" | "danger";
  /** When present, the button navigates here instead of being a static no-op. */
  href?: string;
  /** Pass "_blank" to open `href` in a new tab (e.g. "View Quote"). */
  target?: string;
  /** When present (and `href`/`popoverOptions` are absent), the button calls this instead of being a no-op. */
  onClick?: () => void;
  disabled?: boolean;
  /**
   * When present, the cell renders a small dropdown of these options instead
   * of a plain button (used for "Pitch Outcome" — matches the
   * `OutcomePopover` pattern used elsewhere in the app).
   */
  popoverOptions?: string[];
  onSelectOption?: (option: string) => void;
}

function PopoverButton({ action }: { action: HeaderActionButton }) {
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
      <Button
        variant={action.variant}
        className="h-14 w-full items-center justify-center px-1.5 py-2 text-center text-xs leading-tight"
        onClick={() => setIsOpen((open) => !open)}
      >
        {action.label}
      </Button>
      {isOpen && (
        <div className="absolute left-0 z-10 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {action.popoverOptions?.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                action.onSelectOption?.(option);
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

/**
 * 3x3 action button grid (Presenter, Send Quote, Archive, ...) shown at the
 * top of the right sidebar, above Payment method / Key details.
 */
export function ActionButtonGrid({ buttons }: { buttons: HeaderActionButton[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {buttons.map((action) =>
        action.popoverOptions ? (
          <PopoverButton key={action.label} action={action} />
        ) : (
          <Button
            key={action.label}
            variant={action.variant}
            href={action.href}
            target={action.target}
            onClick={action.onClick}
            disabled={action.disabled}
            className="h-14 items-center justify-center px-1.5 py-2 text-center text-xs leading-tight"
          >
            {action.label}
          </Button>
        ),
      )}
    </div>
  );
}
