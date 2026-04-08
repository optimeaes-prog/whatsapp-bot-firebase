import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
};

/** Contenedor común para vistas tipo bandeja (p. ej. conversaciones). */
export function InboxShell({ children, className }: Props) {
  return (
    <div
      className={cn(
        "flex h-[calc(100vh-8rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md md:h-[calc(100vh-4rem)]",
        className
      )}
    >
      {children}
    </div>
  );
}
