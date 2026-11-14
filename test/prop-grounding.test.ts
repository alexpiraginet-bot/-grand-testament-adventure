import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Terrain, decodeHeights } from '../src/terrain.ts';
import { supportGroundProp } from '../src/prop-grounding.ts';
import { footprintHeightRange, renderedGroundHeight } from '../src/village-house-placement.ts';
import { buildingPoint } from '../src/world-layout.ts';

const json = (p: string) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const meta = json('public/world/cafarnaum.json');
const catalog = json('src/data/tripo-assets.json');
const real = new Terrain(meta, decodeHeights(json('public/world/cafarnaum-heights.json')));
const box = { min: [-1.5, 0, -1], max: [1.5, 1.2, 1] };
const pose = { x: 0, z: 0, rot: 0, sx: 1, sy: 1, sz: 1 };
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function synthetic(fn: (x: number, z: number) => number, n = 9, size = 24) {
  const step = size / (n - 1);
  return new Terrain({ ...meta, n, size, step }, Int16Array.from({ length: n * n }, (_, i) =>
    Math.round(fn(i % n * step - size / 2, Math.floor(i / n) * step - size / 2) * 100)));
}

test('off-centre elevated pivots use rotated footprint and original base, with no source mutation', () => {
  const t = synthetic(() => 2), bounds = { min: [1, 4, -3], max: [4, 5.2, -1] };
  const p = { ...pose, x: 2, z: -2, rot: Math.PI / 2, sx: .5, sy: .8, sz: .6 };
  const before = structuredClone({ bounds, p, terrain: [...t.h] });
  const contact = supportGroundProp(t, bounds, p, 8)!;
  assert.ok(contact);
  const center = buildingPoint(p, 2.5 * p.sx, -2 * p.sz);
  near(contact.x, center.x); near(contact.z, center.z);
  near(contact.y + bounds.min[1] * p.sy, contact.bottom);
  near(contact.top - contact.bottom, 1.2 * p.sy);
  assert.ok(contact.bottom <= 2 && contact.bottom >= 1.985 - 1e-6);
  assert.deepEqual({ bounds, p, terrain: [...t.h] }, before);
});

test('a bilinear saddle cannot lift props above the actual ground triangles', () => {
  const t = synthetic((x, z) => x === 0 && z === 0 ? 4 : 0, 5, 24);
  const p = { ...pose, x: -4, z: -4, sx: .1, sy: .1, sz: .1 };
  assert.ok(t.heightAt(p.x, p.z) > .4);
  near(renderedGroundHeight(t, p.x, p.z, 4), 0);
  const contact = supportGroundProp(t, box, p, 4)!;
  assert.ok(contact); assert.ok(contact.bottom <= 0 && contact.bottom > -.004);
  const all = footprintHeightRange(t, { x: -4, z: -4, w: .3, d: .2, rot: 0 }, 4);
  const visual = footprintHeightRange(t, { x: -4, z: -4, w: .3, d: .2, rot: 0 }, 4, 'rendered');
  assert.ok(all.max > .4); near(visual.min, 0); near(visual.max, 0);
});

test('mild rotated slope has no base-envelope gap and retains at least 75 percent above its highest ground', () => {
  const t = synthetic((x, z) => 2 + x * .02 + z * .01);
  for (const rot of [0, .63, Math.PI / 2, -2.4]) {
    const p = { ...pose, rot }, contact = supportGroundProp(t, box, p, 8)!;
    assert.ok(contact);
    for (let i = 0; i <= 16; i++) for (let j = 0; j <= 16; j++) {
      const point = buildingPoint(p, -1.5 + 3 * i / 16, -1 + 2 * j / 16);
      assert.ok(contact.bottom <= renderedGroundHeight(t, point.x, point.z, 8) + 1e-6);
    }
    assert.ok(contact.top - contact.max >= 1.2 * .75);
  }
});

test('steep terrain and out-of-map footprint are omitted rather than buried or clamped', () => {
  assert.equal(supportGroundProp(synthetic((x) => x), box, pose, 8), null);
  assert.equal(supportGroundProp(synthetic(() => 2), box, { ...pose, x: 11.8 }, 8), null);
});

test('near and far LODs keep contact despite different mesh origins', () => {
  const t = synthetic(() => 2), p = { ...pose, sx: .5, sy: .425, sz: .5 };
  const nearMesh = supportGroundProp(t, box, p, 8)!;
  const farBounds = { min: [-.5, -.2, -.3], max: [.5, .4, .3] };
  const farMesh = supportGroundProp(t, farBounds, p, 8)!;
  assert.ok(nearMesh && farMesh);
  assert.ok(farMesh.y > nearMesh.y + .07, 'a different base requires its own matrix height');
  near(nearMesh.y + box.min[1] * p.sy, nearMesh.bottom);
  near(farMesh.y + farBounds.min[1] * p.sy, farMesh.bottom);
  assert.ok(nearMesh.bottom <= 2 && farMesh.bottom <= 2);
});

test('real DEM and both rendered grids: source catalog rocks and nets have bounded support wherever accepted', () => {
  const [ax, az] = meta.points.beach;
  const before = [...real.h]; let accepted = 0, rejected = 0, oldHover = 0;
  for (const segments of [192, 256]) for (const id of ['pedras-basalto', 'rede-amontoada']) {
    const bounds = catalog.assets[id].bounds, s = id === 'pedras-basalto' ? .3 : .65;
    for (let dx = -40; dx <= 40; dx += 4) for (let dz = -40; dz <= 40; dz += 4) {
      const p = { ...pose, x: ax + dx, z: az + dz, rot: .63, sx: s, sy: s, sz: s };
      oldHover = Math.max(oldHover, real.heightAt(p.x, p.z) - renderedGroundHeight(real, p.x, p.z, segments));
      const contact = supportGroundProp(real, bounds, p, segments);
      if (!contact) { rejected++; continue; }
      accepted++;
      const height = (bounds.max[1] - bounds.min[1]) * s;
      assert.ok(contact.bottom <= contact.min + 1e-6);
      assert.ok(contact.top - contact.max >= height * .75 - 1e-6);
      near(contact.y + bounds.min[1] * s, contact.bottom);
    }
  }
  assert.ok(accepted > 0 && rejected > 0);
  assert.ok(oldHover > .01, 'real data reproduces the bilinear/rendered mismatch');
  assert.deepEqual([...real.h], before);
});

test('invalid scale, bounds or resolution fail before placement', () => {
  const t = synthetic(() => 2);
  for (const p of [{ ...pose, sy: 0 }, { ...pose, rot: NaN }, { ...pose, sz: -1 }]) {
    assert.throws(() => supportGroundProp(t, box, p, 8), RangeError);
  }
  assert.throws(() => supportGroundProp(t, box, pose, 0), RangeError);
  assert.throws(() => supportGroundProp(t, { min: [0, 0, 0], max: [1, 0, 1] }, pose, 8), RangeError);
});
