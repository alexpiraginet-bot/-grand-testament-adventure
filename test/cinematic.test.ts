import test from "node:test";
import assert from "node:assert/strict";
import { ease, twoShot, type CineShot, type ShotWorld, type Subject } from "../src/cinematic.ts";

const flat: ShotWorld = { heightAt: () => 1, solid: () => false };
const HFOV = 2 * Math.atan(Math.tan((52 * Math.PI) / 360) * (1280 / 800));        // 52° vertical at 1280×800

/** Every subject's face lies inside the horizontal field of view of the shot. */
function frames(s: CineShot, subjects: Subject[], hfov: number) {
  const fx = s.look.x - s.eye.x, fz = s.look.z - s.eye.z, fl = Math.hypot(fx, fz);
  return subjects.every((p) => {
    const vx = p.x - s.eye.x, vz = p.z - s.eye.z;
    const cos = (vx * fx + vz * fz) / (Math.hypot(vx, vz) * fl);
    return Math.acos(Math.min(1, cos)) < hfov / 2;
  });
}

test("the two-shot looks across the hero and the called pair, frames all three, above the ground", () => {
  const people: Subject[] = [{ x: 0, z: 0, ground: 1 }, { x: 4, z: 0.5, ground: 1 }, { x: 4.5, z: -1, ground: 1 }];
  const s = twoShot(people, HFOV, flat)!;
  assert.ok(s, "a shot is found on open ground");
  assert.ok(frames(s, people, HFOV), "everyone is in frame");
  assert.ok(s.eye.y >= 1 + 1.5 && s.look.y > 1 + 1, "eye and look above the ground");
  const d = Math.hypot(s.eye.x - s.look.x, s.eye.z - s.look.z);
  assert.ok(d >= 3.2 && d <= 12 * 1.3, `distance ${d}`);
  assert.ok(Math.abs(s.eye.x - s.look.x) < Math.abs(s.eye.z - s.look.z), "camera stands to the side of the hero→pair axis");
});

test("it keeps the camera's side of the axis, and over water it stays above the lake surface", () => {
  const people: Subject[] = [{ x: 0, z: 0, ground: -0.4 }, { x: 5, z: 0, ground: -0.4 }];
  const lake: ShotWorld = { heightAt: () => -3, solid: () => false };
  const north = twoShot(people, HFOV, lake, { x: 2, z: -20 })!, south = twoShot(people, HFOV, lake, { x: 2, z: 20 })!;
  assert.ok(north.eye.z < 0 && south.eye.z > 0, "no flip across the line of action");
  assert.ok(north.eye.y >= 1.6, "not under the water");
});

test("a wall on the preferred side sends the camera elsewhere; enclosed on all sides there is no shot", () => {
  const people: Subject[] = [{ x: 0, z: 0, ground: 0 }, { x: 4, z: 0, ground: 0 }];
  const wallSouth: ShotWorld = { heightAt: () => 0, solid: (_x, _y, z) => z > 1.5 };
  const s = twoShot(people, HFOV, wallSouth, { x: 2, z: 20 })!;
  assert.ok(s && s.eye.z < 1.5, "falls back to the open side");
  const boxed: ShotWorld = { heightAt: () => 0, solid: (x, _y, z) => Math.hypot(x - 2, z) > 2.5 };
  assert.equal(twoShot(people, HFOV, boxed), null);
  assert.equal(twoShot([], HFOV, flat), null);
});

test("easing runs from 0 to 1 smoothly and clamps", () => {
  assert.equal(ease(-1), 0); assert.equal(ease(0), 0); assert.equal(ease(0.5), 0.5); assert.equal(ease(1), 1); assert.equal(ease(2), 1);
  assert.ok(ease(0.1) < 0.1 && ease(0.9) > 0.9);
});
