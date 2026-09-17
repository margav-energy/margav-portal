import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "success" | "danger";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-brand-blue text-white hover:bg-brand-blue/90",
  secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
  success: "bg-brand-green-mid text-white hover:bg-brand-green-mid/90",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const baseClasses =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors";

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
  href?: string;
  /** Pass "_blank" to open an external `href` in a new tab (e.g. an uploaded spec sheet URL). */
  target?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
}

export function Button({
  children,
  variant = "primary",
  className,
  href,
  target,
  onClick,
  type = "button",
  disabled = false,
  title,
}: ButtonProps) {
  const classes = cn(
    baseClasses,
    VARIANT_CLASSES[variant],
    // A plain <button> already blocks clicks via the native `disabled`
    // attribute below, so it only needs `cursor-not-allowed` to show on
    // hover. An <a> (the `href` branch) has no native disabled state, so it
    // still needs `pointer-events-none` to actually block navigation —
    // that also suppresses its own hover/cursor, which is an accepted
    // trade-off for that one case.
    disabled && (href ? "pointer-events-none opacity-50" : "cursor-not-allowed opacity-50"),
    className,
  );

  if (href) {
    return (
      <Link
        href={href}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        className={classes}
        title={title}
      >
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes} title={title}>
      {children}
    </button>
  );
}
