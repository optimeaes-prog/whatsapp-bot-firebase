import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export type CursorAction = "move" | "click" | "press" | "type";

export type CursorKeyframe = {
  frame: number;
  x: number;
  y: number;
  action?: CursorAction;
};

export type CursorState = {
  x: number;
  y: number;
  clickPulse: number;
  isClicking: boolean;
};

export function useCursorKeyframes(keyframes: CursorKeyframe[], frameOverride?: number): CursorState {
  const realFrame = useCurrentFrame();
  const frame = frameOverride !== undefined ? frameOverride : realFrame;
  const { fps } = useVideoConfig();

  if (keyframes.length === 0) {
    return { x: 0, y: 0, clickPulse: 0, isClicking: false };
  }

  let prev = keyframes[0];
  let next = keyframes[keyframes.length - 1];
  for (let i = 0; i < keyframes.length - 1; i += 1) {
    if (frame >= keyframes[i].frame && frame <= keyframes[i + 1].frame) {
      prev = keyframes[i];
      next = keyframes[i + 1];
      break;
    }
  }
  if (frame >= keyframes[keyframes.length - 1].frame) {
    prev = keyframes[keyframes.length - 1];
    next = prev;
  } else if (frame <= keyframes[0].frame) {
    prev = keyframes[0];
    next = keyframes[0];
  }

  const x =
    prev.frame === next.frame
      ? prev.x
      : interpolate(frame, [prev.frame, next.frame], [prev.x, next.x], {
          // Ease-out-quint: fast initial acceleration, dramatic decel as it approaches
          // the target. Reads as a natural "throw and catch" mouse motion — much less
          // robotic than the symmetric S-curve of inOut(cubic).
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const y =
    prev.frame === next.frame
      ? prev.y
      : interpolate(frame, [prev.frame, next.frame], [prev.y, next.y], {
          // Ease-out-quint: fast initial acceleration, dramatic decel as it approaches
          // the target. Reads as a natural "throw and catch" mouse motion — much less
          // robotic than the symmetric S-curve of inOut(cubic).
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  let clickPulse = 0;
  let isClicking = false;
  for (const kf of keyframes) {
    if (kf.action === "click" || kf.action === "press") {
      const since = frame - kf.frame;
      if (since >= 0 && since <= 18) {
        const pulse = spring({
          frame: since,
          fps,
          config: { damping: 14, stiffness: 140 },
        });
        clickPulse = Math.max(clickPulse, pulse);
        if (since <= 4) isClicking = true;
      }
    }
  }

  return { x, y, clickPulse, isClicking };
}
