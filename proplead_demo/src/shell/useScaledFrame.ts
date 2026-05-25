import { useCurrentFrame } from "remotion";

/**
 * Real video duration is 210 frames (7s @ 30fps) but all storyboards in
 * compositions/* are written against a logical 600-frame timeline.
 *
 * useScaledFrame returns the current real frame mapped onto that logical
 * timeline, so existing frame constants don't need to be rewritten. The
 * visual result is the same storyboard played back ~2.86× faster.
 */
export const LOGICAL_TOTAL = 600;
export const REAL_TOTAL = 300; // 10 seconds @ 30fps
export const TIME_SCALE = LOGICAL_TOTAL / REAL_TOTAL;

export function useScaledFrame(): number {
  return useCurrentFrame() * TIME_SCALE;
}
