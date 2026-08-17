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
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}

export function Button({
  children,
  variant = "primary",
  className,
  href,
  onClick,
  type = "button",
  disabled = false,
}: ButtonProps) {
  const classes = cn(
    baseClasses,
    VARIANT_CLASSES[variant],
    disabled && "pointer-events-none opacity-50",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}
