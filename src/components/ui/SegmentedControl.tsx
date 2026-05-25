import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export type SegmentedColorScheme = "amber" | "primary" | "emerald";

type Option<T extends string> = {
  value: T;
  label: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  selectedClassName?: string;
  unselectedClassName?: string;
};

type SingleProps<T extends string> = {
  mode?: "single";
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<Option<T>>;
  colorScheme?: SegmentedColorScheme;
  className?: string;
  ariaLabel: string;
};

type MultiProps<T extends string> = {
  mode: "multiple";
  values: ReadonlySet<T>;
  onToggle: (value: T) => void;
  options: ReadonlyArray<Option<T>>;
  colorScheme?: SegmentedColorScheme;
  className?: string;
  ariaLabel: string;
};

type Props<T extends string> = SingleProps<T> | MultiProps<T>;

const scheme = {
  amber: {
    rootBorder: "border-primary-500",
    selectedBg: "bg-primary-500",
    selectedText: "text-gray-900",
    hoverBg: "hover:bg-gray-50",
    focusRing: "focus-visible:ring-primary-500",
  },
  primary: {
    rootBorder: "border-primary-400",
    selectedBg: "bg-primary-500",
    selectedText: "text-white",
    hoverBg: "hover:bg-primary-50",
    focusRing: "focus-visible:ring-primary-500",
  },
  emerald: {
    rootBorder: "border-emerald-500",
    selectedBg: "bg-emerald-600",
    selectedText: "text-white",
    hoverBg: "hover:bg-emerald-50",
    focusRing: "focus-visible:ring-emerald-500",
  },
} as const;

export function SegmentedControl<T extends string>({
  options,
  colorScheme = "amber",
  className,
  ariaLabel,
  ...rest
}: Props<T>) {
  const s = scheme[colorScheme];
  const isMultiple = (rest as MultiProps<T>).mode === "multiple";
  const values = isMultiple ? (rest as MultiProps<T>).values : null;
  const value = !isMultiple ? (rest as SingleProps<T>).value : null;

  return (
    <div
      className={cn(
        "inline-flex shrink-0 gap-1 rounded-xl border-2 bg-white p-1 shadow-sm",
        s.rootBorder,
        className
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const selected = isMultiple ? values!.has(opt.value) : opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={opt.disabled}
            onClick={() => {
              if (opt.disabled) return;
              if (isMultiple) {
                (rest as MultiProps<T>).onToggle(opt.value);
              } else {
                (rest as SingleProps<T>).onChange(opt.value);
              }
            }}
            className={cn(
              "relative inline-flex min-w-[6rem] items-center justify-center gap-1.5 rounded-btn px-4 py-2 text-sm font-bold font-heading transition-colors duration-200",
              "disabled:opacity-50 disabled:pointer-events-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
              s.focusRing,
              selected
                ? cn(opt.selectedClassName ?? cn(s.selectedBg, s.selectedText), "shadow-sm")
                : cn(opt.unselectedClassName ?? cn("text-gray-600", s.hoverBg))
            )}
            aria-pressed={selected}
          >
            <span>{opt.label}</span>
            {opt.badge ? (
              <span className={cn("text-[10px] font-bold tracking-tight font-heading", selected ? "opacity-90" : "text-emerald-800")}>
                {opt.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

