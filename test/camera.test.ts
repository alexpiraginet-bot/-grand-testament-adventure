import test from "node:test";
import assert from "node:assert/strict";
import { CAM_SPRING, parseCam, snap3, spring3, stepBoom, stepSpring, stepSpring3 } from "../src/camera.ts";

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

test("spring: following a runner, the lag is 2·v/omega (about 0.74 m at 5.2 m/s)", () => {
  const s = spring3(0, 0, 0); const v = 5.2, dt = 1 / 60;
  let x = 0;
  for (let i = 0; i < 600; i++) { x += v * dt; stepSpring3(s, x, 0, 0, CAM_SPRING.pivot, dt); }
  // a target that moves during the step trails a little more than the continuous 2v/omega; v·dt bounds the difference
  close(x - s.x.x, (2 * v) / CAM_SPRING.pivot, v * dt, "lag");
  assert.ok(x - s.x.x < 0.83, "trail stays under 0.83 m");
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
