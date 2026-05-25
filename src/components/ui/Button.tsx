import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

const base =
  "inline-flex items-center justify-center gap-2 select-none rounded-btn font-bold font-heading transition-all disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-95";

const variants = {
  primary:
    "bg-primary-500 hover:bg-primary-600 text-white",
  secondary:
    "bg-gray-200 hover:bg-gray-300 text-gray-800",
  success:
    "border-2 border-emerald-200 bg-emerald-100 hover:bg-emerald-200 text-emerald-900",
  danger:
    "bg-red-600 hover:bg-red-700 text-white",
  ghost: "text-gray-600 hover:bg-gray-100",
  cta:
    "bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold shadow-lg shadow-primary-500/20 transition-all active:scale-95",
  outline:
    "border border-gray-300 bg-white hover:bg-gray-50 text-gray-800",
} as const;

export type ButtonVariant = keyof typeof variants;

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
  icon: "h-10 w-10 p-0",
} as const;

export type ButtonSize = keyof typeof sizes;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
};

function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  type = "button",
  children,
  ...props
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(base, sizes[size], variants[variant], className)}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
