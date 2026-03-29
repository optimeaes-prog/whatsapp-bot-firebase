import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  /** `page` = vistas estándar; `panel` = cabecera dentro de inbox / panel estrecho */
  variant?: "page" | "panel";
  className?: string;
};

export function PageHeader({ title, subtitle, icon, actions, variant = "page", className }: Props) {
  const titleClass =
    variant === "page"
      ? "text-2xl sm:text-3xl font-bold text-gray-900"
      : "text-lg sm:text-xl font-bold text-gray-900";

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <div className={cn("flex items-center gap-3", icon ? "" : "")}>
          {icon ? <span className="shrink-0 text-primary-600 [&_svg]:block">{icon}</span> : null}
          <h1 className={titleClass}>{title}</h1>
        </div>
        {subtitle ? <p className="mt-1 text-sm text-gray-500 sm:mt-2">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
