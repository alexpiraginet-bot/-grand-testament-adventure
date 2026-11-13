import test from "node:test";
import assert from "node:assert/strict";
import { CAM_SPRING, parseCam, snap3, spring3, stepBoom, stepSpring, stepSpring3, stepSpring3Moving, stepSpringMoving } from "../src/camera.ts";

const close = (a: number, b: number, eps: number, what = "") => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} vs ${b}`);

test("camera flag: anything unknown keeps the shipped glued camera", () => {
  assert.equal(parseCam("mola"), "mola"); assert.equal(parseCam(null), "fixa"); assert.equal(parseCam("MOLA"), "fixa");
});

test("spring: the same place and speed whatever the frame rate", () => {
  for (const dt of [1 / 144, 1 / 60, 1 / 30, 0.25]) {
    const fine = { x: 3, v: -1 }, coarse = { x: 3, v: -1 };
    const n = Math.round(0.5 / dt);
    for (let i = 0; i < n; i++) stepSpring(fine, 0, CAM_SPRING.pivot, dt);
    stepSpring(coarse, 0, CAM_SPRING.pivot, n * dt);
    close(fine.x, coarse.x, 1e-12, `x at dt=${dt}`); close(fine.v, coarse.v, 1e-12, `v at dt=${dt}`);
  }
});

test("spring: settles to 5% in 4.74/omega seconds, never overshoots from rest", () => {
  const s = { x: 1, v: 0 };
  const settle = 4.744 / CAM_SPRING.pivot;
  let t = 0, min = 1;
  while (t < settle) { stepSpring(s, 0, CAM_SPRING.pivot, 0.001); t += 0.001; min = Math.min(min, s.x); }
  close(s.x, 0.05, 0.002, "remaining at the settle time");
  assert.ok(min >= 0, "critically damped: no overshoot");
  assert.ok(settle < 0.36, "the comment promises about a third of a second");
});

test("spring: following a runner, the trail is 2·v/omega (about 0.74 m at 5.2 m/s) at any frame rate", () => {
  const v = 5.2, lag = (2 * v) / CAM_SPRING.pivot;
  const trail = (dt: number) => {
    const s = { x: 0, v: 0 }; let x = 0;
    for (let t = 0; t < 4; t += dt) { const x0 = x; x += v * dt; stepSpringMoving(s, x0, x, CAM_SPRING.pivot, dt); }
    return x - s.x;
  };
  for (const dt of [1 / 144, 1 / 60, 1 / 30, 0.1, 0.25]) close(trail(dt), lag, 1e-6, `trail at dt=${dt}`);
  close(lag, 0.742857, 1e-6, "the comment's 0.74 m");
  // holding the target at the frame's end instead (the old step) trails less at low frame rates: what this replaces
  const held = (dt: number) => { const s = { x: 0, v: 0 }; let x = 0; for (let t = 0; t < 4; t += dt) { x += v * dt; stepSpring(s, x, CAM_SPRING.pivot, dt); } return x - s.x; };
  assert.ok(lag - held(1 / 30) > 0.08, "the held-target step loses about v·dt/2 at 30 fps");
});

test("spring: a moving target is exact too, one long step equals many short ones", () => {
  const a = { x: 2, v: -3 }, b = { x: 2, v: -3 };
  const T = (t: number) => 10 + 4 * t;          // straight-line target
  const n = 50, dt = 0.5 / n;
  for (let i = 0; i < n; i++) stepSpringMoving(a, T(i * dt), T((i + 1) * dt), CAM_SPRING.pivot, dt);
  stepSpringMoving(b, T(0), T(0.5), CAM_SPRING.pivot, 0.5);
  close(a.x, b.x, 1e-9, "x"); close(a.v, b.v, 1e-9, "v");
  // a target that does not move gives the plain spring
  const c = { x: 1, v: 0.5 }, d = { x: 1, v: 0.5 };
  stepSpringMoving(c, 3, 3, 9, 0.2); stepSpring(d, 3, 9, 0.2);
  close(c.x, d.x, 1e-12, "x"); close(c.v, d.v, 1e-12, "v");
  const p = spring3(0, 1, 2); stepSpring3Moving(p, [0, 1, 2], [1, 1, 2], 10, 0);
  assert.deepEqual(p, spring3(0, 1, 2), "no time, no change");
  stepSpring3Moving(p, [0, 1, 2], [1, 1, 2], 10, 0.1);
  assert.ok(p.x.x > 0 && p.y.x === 1 && p.z.x === 2, "each axis follows its own target");
});

test("spring: zero, negative or NaN steps change nothing; snap clears the velocity", () => {
  const s = { x: 2, v: 1 };
  stepSpring(s, 0, 10, 0); stepSpring(s, 0, 10, -1); stepSpring(s, 0, 10, Number.NaN);
  assert.deepEqual(s, { x: 2, v: 1 });
  const p = spring3(1, 2, 3); stepSpring3(p, 9, 9, 9, 10, 0.1); snap3(p, 4, 5, 6);
  assert.deepEqual(p, { x: { x: 4, v: 0 }, y: { x: 5, v: 0 }, z: { x: 6, v: 0 } });
});

test("boom: in at once behind a wall, out with the spring, never past the wall test", () => {
  const b = { x: 4.4, v: 0 };
  assert.equal(stepBoom(b, 1.2, CAM_SPRING.outward, 1 / 60), 1.2, "a wall at 1.2 m: the same frame");
  const after1 = stepBoom(b, 4.4, CAM_SPRING.outward, 1 / 60);
  assert.ok(after1 > 1.2 && after1 < 1.5, `eases out, no pop: ${after1}`);
  let t = 1 / 60;
  while (t < 4.744 / CAM_SPRING.outward) { stepBoom(b, 4.4, CAM_SPRING.outward, 1 / 60); t += 1 / 60; }
  assert.ok(b.x > 4.4 - 0.05 * 3.2 - 0.01, `back out after ~0.34 s: ${b.x}`);
  // a moving wall closing in while easing out: the distance never exceeds what the test allows
  for (let i = 0; i < 120; i++) { const allowed = 4.4 - i * 0.03; assert.ok(stepBoom(b, allowed, CAM_SPRING.outward, 1 / 60) <= allowed); }
  // one huge step (a stalled tab) lands exactly on the allowed distance, not beyond
  const c = { x: 1, v: 50 };
  assert.ok(stepBoom(c, 2, CAM_SPRING.outward, 5) <= 2);
});
