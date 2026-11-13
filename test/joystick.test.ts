import test from "node:test";
import assert from "node:assert/strict";
import { JOY_CAPTURE, JOY_RADIUS, JOY_RUN, stickOrigin, stickVector } from "../src/joystick.ts";

const rest = { x: 72, y: 712 };

test("a thumb near the resting stick drives it from its fixed centre; elsewhere the base comes under the thumb", () => {
  assert.deepEqual(stickOrigin(rest, { x: 80, y: 700 }), rest);
  assert.deepEqual(stickOrigin(rest, { x: rest.x + JOY_CAPTURE - 0.5, y: rest.y }), rest);   // half a pixel either side of the rim
  assert.deepEqual(stickOrigin(rest, { x: rest.x + JOY_CAPTURE + 0.5, y: rest.y }), { x: rest.x + JOY_CAPTURE + 0.5, y: rest.y });
  assert.deepEqual(stickOrigin(rest, { x: 70, y: 500 }), { x: 70, y: 500 });
  const o = stickOrigin(rest, rest); o.x = 0;
  assert.equal(rest.x, 72, "the returned origin is a copy, not the resting point itself");
});

test("stick reading: screen up is forward, length clamps to 1, the knob stays on the rim, running only near it", () => {
  assert.deepEqual(stickVector(rest, rest), { x: 0, y: 0, run: false, knob: { x: 0, y: 0 } });
  const half = stickVector(rest, { x: rest.x, y: rest.y - JOY_RADIUS / 2 });
  assert.equal(half.y, 0.5); assert.equal(half.x, 0); assert.equal(half.run, false);
  const right = stickVector(rest, { x: rest.x + JOY_RADIUS / 4, y: rest.y });
  assert.equal(right.x, 0.25); assert.equal(right.y, 0);
  const far = stickVector(rest, { x: rest.x + 300, y: rest.y + 400 });
  assert.ok(Math.abs(Math.hypot(far.x, far.y) - 1) < 1e-12);
  assert.ok(Math.abs(Math.hypot(far.knob.x, far.knob.y) - JOY_RADIUS) < 1e-9);
  assert.ok(far.y < 0, "pulling down walks backwards");
  assert.equal(far.run, true);
  assert.equal(stickVector(rest, { x: rest.x, y: rest.y - JOY_RADIUS * JOY_RUN + 0.5 }).run, false);
  assert.equal(stickVector(rest, { x: rest.x, y: rest.y - JOY_RADIUS * JOY_RUN - 0.5 }).run, true);
});
