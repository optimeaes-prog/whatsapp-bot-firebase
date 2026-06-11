import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type TapKeyframe = {
  /** logical frame where the tap happens (peak ripple) */
  frame: number;
  x: number;
  y: number;
};

/**
 * Mobile-equivalent of the desktop Cursor: shows a finger-tap ripple at the
 * given tap coordinates. Multiple ripples can be queued via `taps`. There's no
 * persistent indicator between taps — the screen looks clean except during the
 * brief tap moment.
 */
export function TouchIndicator({ taps, frame: frameOverride }: { taps: TapKeyframe[]; frame?: number }) {
  const realFrame = useCurrentFrame();
  const frame = frameOverride !== undefined ? frameOverride : realFrame;
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      {taps.map((tap, idx) => {
        const since = frame - tap.frame;
        if (since < -6 || since > 32) return null;

        // Outer ripple — expands and fades
        const ripple = spring({
          frame: Math.max(0, since),
          fps,
          config: { damping: 14, stiffness: 100 },
          durationInFrames: 32,
        });
        const ringScale = interpolate(ripple, [0, 1], [0.4, 1.8]);
        const ringOpacity = interpolate(ripple, [0, 0.4, 1], [0.9, 0.6, 0], {
          easing: Easing.out(Easing.cubic),
        });

        // Inner solid dot — appears, peaks, fades
        const dotProgress = since < 0 ? 0 : since < 12 ? 1 : interpolate(since, [12, 28], [1, 0]);

        return (
          <div key={idx}>
            {/* Outer expanding ring */}
            <div
              style={{
                position: "absolute",
                left: tap.x - 60,
                top: tap.y - 60,
                width: 120,
                height: 120,
                borderRadius: "50%",
                border: "4px solid rgba(255, 176, 63, 0.9)",
                transform: `scale(${ringScale})`,
                opacity: ringOpacity,
              }}
            />
            {/* Inner solid circle */}
            <div
              style={{
                position: "absolute",
                left: tap.x - 36,
                top: tap.y - 36,
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(255, 176, 63, 0.55)",
                boxShadow: "0 4px 16px rgba(255, 176, 63, 0.4)",
                opacity: dotProgress,
                transform: `scale(${0.7 + dotProgress * 0.3})`,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
