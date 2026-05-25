import { useCursorKeyframes, type CursorKeyframe } from "./useCursorKeyframes";

/**
 * macOS-style cursor.
 *
 * The TIP (the point that actually clicks) is at SVG coords (3, 3). We render
 * the SVG at `left: x - 3, top: y - 3` so the tip lands EXACTLY at (x, y),
 * which is the same coordinate the click ripple is centered on.
 */
export function Cursor({ keyframes, frame }: { keyframes: CursorKeyframe[]; frame?: number }) {
  const { x, y, clickPulse } = useCursorKeyframes(keyframes, frame);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      {/* Click ripple — centered on (x, y), i.e. the cursor TIP */}
      {clickPulse > 0 && (
        <div
          style={{
            position: "absolute",
            left: x - 20,
            top: y - 20,
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "3px solid rgba(255, 176, 63, 0.85)",
            background: "rgba(255, 176, 63, 0.22)",
            transform: `scale(${0.3 + clickPulse * 1.2})`,
            opacity: Math.max(0, 1 - clickPulse * 1.1),
          }}
        />
      )}

      {/* Cursor SVG — tip at (3, 3) in viewBox; rendered offset so tip = (x, y) */}
      <svg
        width={44}
        height={52}
        viewBox="0 0 44 52"
        style={{
          position: "absolute",
          left: x - 3,
          top: y - 3,
          filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.35))",
        }}
      >
        <path
          d="M3 3 L3 36 L13 28 L19 42 L25 40 L19 26 L31 26 Z"
          fill="#111827"
          stroke="white"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
