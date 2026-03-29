import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/utils";

const variants = {
  primary:
    "bg-primary-500 hover:bg-primary-600 text-white font-medium py-2 px-4 rounded-btn transition-colors disabled:opacity-50 disabled:pointer-events-none",
  secondary:
    "bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-btn transition-colors disabled:opacity-50 disabled:pointer-events-none",
  danger:
    "bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-btn transition-colors disabled:opacity-50 disabled:pointer-events-none",
  ghost: "text-gray-600 hover:bg-gray-100 rounded-btn transition-colors py-2 px-3 font-medium disabled:opacity-50",
  cta:
    "bg-primary-600 hover:bg-primary-700 text-white rounded-btn text-sm font-bold shadow-lg shadow-primary-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none py-2.5 px-5",
  outline:
    "border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 font-medium py-2 px-4 rounded-btn transition-colors disabled:opacity-50",
} as const;

export type ButtonVariant = keyof typeof variants;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

export function Button({ variant = "primary", className, type = "button", ...props }: Props) {
  return <button type={type} className={cn(variants[variant], className)} {...props} />;
}
