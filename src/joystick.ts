// The phone joystick, as plain math so it can be tested without a browser.
// It rests in a fixed, always-visible place. A thumb that lands near it drives it from that fixed centre; a thumb that
// lands elsewhere on the walking side carries the base under the finger for that gesture, so the hero never lurches
// toward a point far from where the thumb went down. Released, the base goes back to its resting place.

export type Pt = { x: number; y: number };
export type Stick = { x: number; y: number; run: boolean; knob: Pt };

export const JOY_RADIUS = 56;                       // px from the centre to the edge the knob can reach (CSS may shrink it)
export const JOY_CAPTURE_RATIO = 1.6;               // a touch within this many radii of the resting centre drives it in place
export const JOY_CAPTURE = JOY_RADIUS * JOY_CAPTURE_RATIO;
export const JOY_RUN = 0.95;                        // fraction of the radius past which the hero runs

/** Where this gesture's stick is centred: the resting centre if the thumb landed near it, otherwise under the thumb. */
export function stickOrigin(rest: Pt, touch: Pt, capture = JOY_CAPTURE): Pt {
  return Math.hypot(touch.x - rest.x, touch.y - rest.y) <= capture ? { ...rest } : { ...touch };
}

/** Stick reading for a thumb at `touch`: x right, y forward (screen up), length at most 1; `knob` is the drawn offset. */
export function stickVector(origin: Pt, touch: Pt, radius = JOY_RADIUS): Stick {
  let dx = touch.x - origin.x, dy = touch.y - origin.y;
  const l = Math.hypot(dx, dy);
  if (l > radius) { dx *= radius / l; dy *= radius / l; }
  return { x: dx / radius || 0, y: -dy / radius || 0, run: l > radius * JOY_RUN, knob: { x: dx, y: dy } };
}
