import type { ReactNode } from "react";

/**
 * Mobile canvas wrapper. Adds breathing-room padding around all 4 edges so
 * page content doesn't crowd the video margins. No frame or card — just
 * empty space matching the page background.
 */
export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 bg-gray-50 p-10">
      <div className="relative h-full w-full overflow-hidden">{children}</div>
    </div>
  );
}
