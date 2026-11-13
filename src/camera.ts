// The follow camera's springs (?cam=mola), pure so they can be tested at any frame rate (test/camera.test.ts).
// Without the flag the camera stays glued to the hero, as shipped. With it:
//   - the point the camera looks at (his head) trails him a little, critically damped, so starts and stops have weight;
//   - when a wall comes between camera and hero the camera jumps in at once (never a frame inside the wall), and when
//     the wall is gone it eases back out in about a third of a second instead of popping.
// A critically damped spring has a closed-form step, so one step of 0.5 s lands exactly where two of 0.25 s do. The head
// moves during a frame, so the camera steps toward a target moving in a straight line from where it was to where it is
// (stepSpringMoving), which is also exact: at a steady run the trail is 2·v/omega on a 30 fps phone and on a 144 Hz
// monitor alike. Defaults change only with Alex's OK (PLANO-AAA R7/R8).

export type CamMode = "fixa" | "mola";
export const parseCam = (value: string | null | undefined): CamMode => (value === "mola" ? "mola" : "fixa");

/** Stiffness (1/s). Settling to 5% takes about 4.74/omega seconds. */
export const CAM_SPRING = {
  pivot: 14,            // head trail: ~0.34 s to settle; at a 5.2 m/s run it trails by 2·v/omega ≈ 0.74 m
  pivotReduced: 40,     // prefers-reduced-motion: almost glued
  outward: 14,          // easing back out after an obstruction: ~0.34 s
} as const;

export type Spring1 = { x: number; v: number };

/** One exact step of a critically damped spring toward `target`, held constant over dt. Mutates and returns s. */
export function stepSpring(s: Spring1, target: number, omega: number, dt: number): Spring1 {
  if (!(dt > 0)) return s;
  const d = s.x - target;
  const e = Math.exp(-omega * dt);
  const tmp = (s.v + omega * d) * dt;
  s.v = (s.v - omega * tmp) * e;
  s.x = target + (d + tmp) * e;
  return s;
}

/** One exact step toward a target that moves at constant speed from t0 to t1 during dt. With u = (t1 - t0)/dt and
 * e = x - target, z = e + 2u/omega obeys the same spring toward 0, so the closed form above applies to z. Mutates s. */
export function stepSpringMoving(s: Spring1, t0: number, t1: number, omega: number, dt: number): Spring1 {
  if (!(dt > 0)) return s;
  const u = (t1 - t0) / dt, k = (2 * u) / omega;
  const z = { x: s.x - t0 + k, v: s.v - u };
  stepSpring(z, 0, omega, dt);
  s.x = t1 + z.x - k;
  s.v = z.v + u;
  return s;
}

export type Spring3 = { x: Spring1; y: Spring1; z: Spring1 };
export const spring3 = (x: number, y: number, z: number): Spring3 => ({ x: { x, v: 0 }, y: { x: y, v: 0 }, z: { x: z, v: 0 } });

export function stepSpring3(s: Spring3, tx: number, ty: number, tz: number, omega: number, dt: number): Spring3 {
  stepSpring(s.x, tx, omega, dt); stepSpring(s.y, ty, omega, dt); stepSpring(s.z, tz, omega, dt);
  return s;
}

export function stepSpring3Moving(s: Spring3, from: readonly [number, number, number], to: readonly [number, number, number],
  omega: number, dt: number): Spring3 {
  stepSpringMoving(s.x, from[0], to[0], omega, dt); stepSpringMoving(s.y, from[1], to[1], omega, dt);
  stepSpringMoving(s.z, from[2], to[2], omega, dt);
  return s;
}

/** Snaps the spring onto `x` with no velocity (teleport, cut, first frame). */
export function snap3(s: Spring3, x: number, y: number, z: number): Spring3 {
  s.x.x = x; s.y.x = y; s.z.x = z; s.x.v = s.y.v = s.z.v = 0;
  return s;
}

/** Camera distance from the pivot: `allowed` is how far it may be this frame (the wall test); shorter than the current
 * distance means in at once, longer means ease out with the spring. Returns the distance to use. */
export function stepBoom(s: Spring1, allowed: number, omega: number, dt: number): number {
  if (allowed <= s.x) { s.x = allowed; s.v = 0; return s.x; }
  stepSpring(s, allowed, omega, dt);
  if (s.x > allowed) { s.x = allowed; s.v = 0; }   // never past the wall test, even with velocity left over
  return s.x;
}
