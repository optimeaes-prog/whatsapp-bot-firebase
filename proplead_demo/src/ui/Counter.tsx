import { Easing, interpolate, useCurrentFrame } from "remotion";

const NF = new Intl.NumberFormat("es-ES");

export function Counter({
  from,
  to,
  startFrame,
  durationFrames = 50,
  suffix = "",
  decimals = 0,
  frame: frameOverride,
}: {
  from: number;
  to: number;
  startFrame: number;
  durationFrames?: number;
  suffix?: string;
  decimals?: number;
  /** Optional override — pass the scaled/logical frame so startFrame/duration align. */
  frame?: number;
}) {
  const realFrame = useCurrentFrame();
  const frame = frameOverride !== undefined ? frameOverride : realFrame;
  const value = interpolate(frame, [startFrame, startFrame + durationFrames], [from, to], {
    easing: Easing.out(Easing.cubic),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const display =
    decimals === 0
      ? NF.format(Math.round(value))
      : value.toFixed(decimals).replace(".", ",");

  return (
    <span>
      {display}
      {suffix}
    </span>
  );
}
