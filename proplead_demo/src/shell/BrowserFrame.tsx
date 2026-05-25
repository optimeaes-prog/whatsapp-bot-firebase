import type { ReactNode } from "react";
import { Lock, ChevronLeft, ChevronRight, RotateCcw, Star, Download, Puzzle } from "lucide-react";

export function BrowserFrame({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-emerald-50/60">
      {/* Top chrome */}
      <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-gray-200/80 bg-emerald-50/40 px-5">
        {/* Traffic lights */}
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
          <div className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
          <div className="h-3 w-3 rounded-full bg-[#28C840]" />
        </div>

        {/* Nav */}
        <div className="ml-6 flex items-center gap-2 text-gray-500">
          <ChevronLeft size={20} />
          <ChevronRight size={20} className="opacity-40" />
          <RotateCcw size={18} />
        </div>

        {/* URL bar */}
        <div className="mx-4 flex flex-1 items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm text-gray-700 shadow-sm ring-1 ring-gray-200/80">
          <Lock size={14} className="text-gray-500" />
          <span className="truncate">{url}</span>
          <Star size={14} className="ml-auto text-gray-400" />
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-3 text-gray-500">
          <Download size={18} />
          <Puzzle size={18} />
          <div className="ml-1 h-7 w-7 rounded-full bg-primary-100 ring-2 ring-white" />
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 overflow-hidden bg-white">{children}</div>
    </div>
  );
}
