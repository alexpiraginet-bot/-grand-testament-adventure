import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Terrain, decodeHeights } from '../src/terrain.ts';
import { npcs } from '../src/episode.ts';
import { footprintHeightRange, renderedGroundHeight } from '../src/village-house-placement.ts';
import { buildingPoint } from '../src/world-layout.ts';
import { findCastNetWaterPlacement } from '../src/cast-net-water-placement.ts';

const json = (p: string) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const meta = json('public/world/cafarnaum.json');
const net = { min: [-.92200599, -.271240212, -1.75], max: [.92200599, -.00458578, 1.75] };
const pose = { x: 0, z: 0, rot: 0 };
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function terrain(fn: (x: number, z: number) => number) {
  const n = 33, size = 48, step = size / (n - 1);
  return new Terrain({ ...meta, n, size, step }, Int16Array.from({ length: n * n }, (_, i) =>
    Math.round(fn(i % n * step - size / 2, Math.floor(i / n) * step - size / 2) * 100)));
}

test('already safe water keeps its pivot exactly and accounts for the deepest strand', () => {
  const t = terrain(() => -.5), before = structuredClone({ net, pose, heights: [...t.h] });
  const out = findCastNetWaterPlacement(t, net, pose, { rootY: .07 })!;
  assert.ok(out); near(out.x, 0); near(out.z, 0); near(out.y, .07); near(out.distance, 0);
  near(out.requiredMaxGroundHeight, -.216240212);
  assert.deepEqual(out.ranges.map(x => x.segments), [192, 256]);
  assert.deepEqual({ net, pose, heights: [...t.h] }, before);
});

test('shallow water is rejected when it would intersect the hanging weight, despite being below the cloth', () => {
  const t = terrain(() => -.08);
  assert.equal(findCastNetWaterPlacement(t, net, pose, { rootY: .07, maxRadius: 2 }), null);
});

test('radial search selects the first tested valid radius with full footprint clearance', () => {
  const t = terrain(x => x * .2), out = findCastNetWaterPlacement(t, net, pose, { rootY: .07 })!;
  assert.ok(out); assert.ok(out.distance > 1 && out.distance < 3);
  assert.equal(findCastNetWaterPlacement(t, net, pose, { rootY: .07, maxRadius: out.distance - .25 }), null);
  for (const range of out.ranges) assert.ok(range.max <= out.requiredMaxGroundHeight);
});

test('rotated off-centre geometry uses its actual footprint, not the pivot sample', () => {
  const t = terrain(x => x * .08 - .6), bounds = { min: [1, -.25, -2], max: [3, -.05, 0] };
  const p = { x: 0, z: 0, rot: Math.PI / 2, sx: .6, sy: 1, sz: .8 };
  const out = findCastNetWaterPlacement(t, bounds, p, { rootY: .07 })!;
  assert.ok(out);
  for (const segments of [192, 256]) for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
    const at = buildingPoint(out, (1 + i / 4) * p.sx, (-2 + j / 4) * p.sz);
    assert.ok(renderedGroundHeight(t, at.x, at.z, segments) <= out.requiredMaxGroundHeight + 1e-6);
  }
});

test('no candidate returns null without leaving the map or extending the twelve-metre limit', () => {
  assert.equal(findCastNetWaterPlacement(terrain(() => 2), net, pose, { rootY: .07 }), null);
  assert.equal(findCastNetWaterPlacement(terrain(() => -1), net, { ...pose, x: 24 }, { rootY: .07, maxRadius: 0 }), null);
  assert.throws(() => findCastNetWaterPlacement(terrain(() => -1), net, pose, { rootY: .07, maxRadius: 12.25 }), RangeError);
  assert.throws(() => findCastNetWaterPlacement(terrain(() => -1), net, pose, { rootY: .07, clearance: -1 }), RangeError);
});

test('both rendered grids must pass independently, including when their height ordering reverses', () => {
  const heights = decodeHeights(json('public/world/cafarnaum-heights.json'));
  const at = { x: -206.7785026914667, z: 435.95706678644376, rot: 0 };
  const tiny = { min: [-.005, 0, -.005], max: [.005, .01, .005] };
  for (const sign of [1, -1]) {
    const t = new Terrain(meta, Int16Array.from(heights, v => v * sign));
    const threshold = .02 * sign;
    const pass = [192, 256].map(segments =>
      footprintHeightRange(t, { ...at, w: .01, d: .01 }, segments, 'rendered').max <= threshold);
    assert.deepEqual(pass, sign === 1 ? [true, false] : [false, true]);
    assert.equal(findCastNetWaterPlacement(t, tiny, at,
      { rootY: threshold, waterY: threshold, clearance: 0, maxRadius: 0 }), null);
  }
});

test('real current net position is over dry terrain and has no fully submerged placement inside twelve metres', () => {
  const t = new Terrain(meta, decodeHeights(json('public/world/cafarnaum-heights.json'))), specs = npcs(meta, {});
  const s = specs[0], a = s.facing;
  const at = { x: s.pos.x + Math.sin(a) * 3.2 + (specs[1].pos.x - s.pos.x) / 2,
    z: s.pos.z - Math.cos(a) * 3.2 + (specs[1].pos.z - s.pos.z) / 2, rot: 0 };
  assert.ok(renderedGroundHeight(t, at.x, at.z, 256) > .02);
  assert.equal(findCastNetWaterPlacement(t, net, at, { rootY: .07 }), null);
});
