import { Button } from "@/components/ui/Button";

export interface HeaderActionButton {
  label: string;
  variant: "primary" | "danger";
  /** When present, the button navigates here instead of being a static no-op. */
  href?: string;
}

/**
 * 3x3 action button grid (Presenter, Send Quote, Archive, ...) shown at the
 * top of the right sidebar, above Payment method / Key details. Only one
 * label is genuinely product-specific ("STAX Portal" vs "Warranty
 * Registration") — the calling orchestrator supplies the full list.
 */
export function ActionButtonGrid({ buttons }: { buttons: HeaderActionButton[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {buttons.map((action) => (
        <Button
          key={action.label}
          variant={action.variant}
          href={action.href}
          className="justify-center px-1.5 py-2 text-center text-xs"
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
