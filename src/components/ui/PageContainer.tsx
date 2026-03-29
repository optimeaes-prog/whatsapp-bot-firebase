import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type MaxWidth = "full" | "6xl";

type Props = {
  children: ReactNode;
  maxWidth?: MaxWidth;
  className?: string;
};

export function PageContainer({ children, maxWidth = "full", className }: Props) {
  return (
    <div
      className={cn(
        maxWidth === "6xl" && "mx-auto w-full max-w-6xl space-y-6",
        maxWidth === "full" && "w-full",
        className
      )}
    >
      {children}
    </div>
  );
}
