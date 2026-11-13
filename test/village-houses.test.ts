import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Terrain, decodeHeights } from '../src/terrain.ts';
import { buildingPoint, insideObstacle, missionRoutes, settlementLayout, type Building } from '../src/world-layout.ts';
import { convexFootprint, footprintHeightRange, FOUNDATION_EMBED, FOUNDATION_TILE_METRES, foundationMeshData,
  foundationRing, houseObstacle, placeVillageHouses, renderedGroundHeight, type HouseShape } from '../src/village-house-placement.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url));
const meta = JSON.parse(read('public/world/cafarnaum.json').toString());
const real = new Terrain(meta, decodeHeights(JSON.parse(read('public/world/cafarnaum-heights.json').toString())));
const catalog = JSON.parse(read('src/data/tripo-assets.json').toString());
const shapes: HouseShape[] = ['casa-basalto-a', 'casa-basalto-b', 'casa-basalto-c'].map(id => ({ bounds: catalog.assets[id].bounds }));
const nearly = (a: number, b: number, message = '', epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${message}: ${a} != ${b}`);
const lot = (overrides: Partial<Building> = {}): Building => ({ x: 0, z: 0, y: 10, w: 9, d: 7, h: 3.3,
  foundation: 2, rot: 0, variant: 0, ...overrides });
function synthetic(fn: (x: number, z: number) => number, n = 9, size = 24) {
  const step = size / (n - 1);
  return new Terrain({ ...meta, n, size, step }, Int16Array.from({ length: n * n }, (_, i) =>
    Math.round(fn(i % n * step - size / 2, Math.floor(i / n) * step - size / 2) * 100)));
}

test('all three original GLB aspect ratios survive fitting and the facade stays on the original lot edge', () => {
  const t = synthetic(() => 2);
  for (let variant = 0; variant < 3; variant++) for (const rot of [0, .37, Math.PI / 2, -2.4]) {
    const original = lot({ variant, rot }), copy = structuredClone(original);
    const p = placeVillageHouses(t, [original], shapes)[0], size = shapes[variant].bounds.max.map((v, i) => v - shapes[variant].bounds.min[i]);
    nearly(p.plan.w / size[0], p.scale); nearly(p.plan.h / size[1], p.scale); nearly(p.plan.d / size[2], p.scale);
    assert.ok(p.plan.w <= original.w + 1e-8 && p.plan.d <= original.d + 1e-8 && p.plan.h <= original.h + 1e-8);
    const oldFront = buildingPoint(original, 0, original.d / 2), newFront = buildingPoint(p.plan, 0, p.plan.d / 2);
    nearly(oldFront.x, newFront.x, 'facade X'); nearly(oldFront.z, newFront.z, 'facade Z');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const corner = buildingPoint(p.plan, sx * p.plan.w / 2, sz * p.plan.d / 2);
      assert.ok(insideObstacle(corner.x, corner.z, { ...original, hx: original.w / 2 + 1e-6, hz: original.d / 2 + 1e-6 }));
    }
    assert.deepEqual(original, copy, 'source lot remains immutable');
  }
});

test('off-centre, elevated source meshes are centred and grounded without changing their ratios', () => {
  const source = { bounds: { min: [2, -3, 5], max: [8, 0, 10] } }, t = synthetic(() => 2);
  const p = placeVillageHouses(t, [lot()], [source])[0];
  nearly((source.bounds.min[0] + source.bounds.max[0] + 2 * p.sourceOffset.x) * p.scale, 0);
  nearly(source.bounds.min[1] + p.sourceOffset.y, 0);
  nearly((source.bounds.min[2] + source.bounds.max[2] + 2 * p.sourceOffset.z) * p.scale, 0);
  const box = houseObstacle(p);
  nearly(box.hx, p.plan.w / 2 + .35); nearly(box.hz, p.plan.d / 2 + .35);
  nearly(box.top!, p.plan.y + p.plan.h); nearly(box.bottom!, p.plan.y - p.plan.foundation);
});

test('foundation height catches interior grid peaks and rotated bilinear-edge extrema', () => {
  const peak = synthetic((x, z) => x === 0 && z === 0 ? 5 : 1, 9, 16);
  const rectangle = lot({ w: 10, d: 10, rot: .41 });
  nearly(footprintHeightRange(peak, rectangle).max, 5, 'interior peak');
  const saddle = synthetic((x, z) => 3 + .012 * x * z, 3, 24);
  const b = lot({ w: 8, d: 5, rot: Math.PI / 4 });
  const range = footprintHeightRange(saddle, b, 4);
  let maximum = -Infinity;
  for (let ix = 0; ix <= 100; ix++) for (let iz = 0; iz <= 100; iz++) {
    const p = buildingPoint(b, (ix / 100 - .5) * b.w, (iz / 100 - .5) * b.d);
    const values = [saddle.heightAt(p.x, p.z), renderedGroundHeight(saddle, p.x, p.z, 4)];
    maximum = Math.max(maximum, ...values);
    for (const h of values) assert.ok(h >= range.min - 1e-7 && h <= range.max + 1e-7);
  }
  nearly(range.max, maximum, 'dense-sample maximum', .001);
});

test('renderedGroundHeight follows PlaneGeometry triangles rather than the bilinear saddle', () => {
  const t = synthetic((x, z) => (x === 0 && z === 0) ? 4 : 0, 5, 24);
  nearly(renderedGroundHeight(t, -3, -3), 0);
  nearly(t.heightAt(-3, -3), 1);
  nearly(renderedGroundHeight(t, -1.5, -1.5), 2);
});

test('rotated skirts stay buried along every rendered slope segment on both ground resolutions', () => {
  const t = synthetic((x, z) => 3 + .10 * x - .07 * z + .009 * x * z);
  for (const segments of [6, 8]) for (const rot of [0, .4, 1.3, 2.6]) {
    const p = placeVillageHouses(t, [lot({ rot })], shapes, segments)[0];
    const ring = foundationRing(t, p, segments);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      assert.ok(a.bottom <= a.rendered - FOUNDATION_EMBED + 1e-8);
      for (let j = 0; j <= 20; j++) {
        const u = j / 20, x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u;
        const rendered = renderedGroundHeight(t, x, z, segments), bottom = a.bottom + (b.bottom - a.bottom) * u;
        assert.ok(bottom <= rendered - FOUNDATION_EMBED + 1e-7, 'no exposed gap below the skirt');
        assert.ok(p.plan.y >= rendered && p.plan.y >= t.heightAt(x, z), 'floor stays above both terrain interpolants');
      }
    }
  }
});

test('a convex base uses lower-wall bounds rather than the roof and keeps consistent physical UV scale', () => {
  const t = synthetic((x, z) => 2 + .1 * x + .04 * z);
  const footprint = convexFootprint([{ x: -2, z: -1.5 }, { x: 2, z: -1.5 }, { x: 2, z: 1.5 },
    { x: -2, z: 1.5 }, { x: 0, z: 0 }, { x: 2, z: 1.5 }]);
  assert.equal(footprint.length, 4);
  const p = placeVillageHouses(t, [lot()], [{ ...shapes[0], footprint }])[0];
  assert.ok(Math.max(...p.outline.map(p => p.x)) < p.plan.w / 2);
  const ring = foundationRing(t, p), data = foundationMeshData(t, [p]);
  assert.equal(data.indices.length / 3, ring.length * 3);
  assert.equal(data.positions.length / 3, ring.length * 7);
  assert.ok([...data.positions, ...data.uvs, ...data.colors].every(Number.isFinite));
  for (let i = 1; i < ring.length; i++) {
    nearly((ring[i].u - ring[i - 1].u) * FOUNDATION_TILE_METRES,
      Math.hypot(ring[i].x - ring[i - 1].x, ring[i].z - ring[i - 1].z), 'UV metres');
  }
  // Actual triangles face out/up, so the plinth does not require DoubleSide.
  const at = (i: number) => Array.from(data.positions.slice(i * 3, i * 3 + 3));
  for (let i = 0; i < data.indices.length; i += 9) {
    const [a, b, c] = data.indices.slice(i, i + 3).map(at);
    const e = b.map((v, k) => v - a[k]), f = c.map((v, k) => v - a[k]);
    const nx = e[1] * f[2] - e[2] * f[1], nz = e[0] * f[1] - e[1] * f[0];
    assert.ok(nx * ((a[0] + b[0] + c[0]) / 3 - p.plan.x) + nz * ((a[2] + b[2] + c[2]) / 3 - p.plan.z) > 0);
    const [ca, cb, cc] = data.indices.slice(i + 6, i + 9).map(at);
    const ey = (cb[2] - ca[2]) * (cc[0] - ca[0]) - (cb[0] - ca[0]) * (cc[2] - ca[2]);
    assert.ok(ey > 0, 'cap normal points up');
  }
});

test('real Cafarnaum fits remain inside old lots, all mission lanes clear, and DEM byte-identical', () => {
  const before = createHash('sha256').update(new Uint8Array(real.h.buffer)).digest('hex');
  const routes = missionRoutes(real), cap = real.meta.places.find((p: { id: string }) => p.id === 'Capernaum');
  const lots = settlementLayout(real, routes, cap?.x ?? 0, cap?.z ?? 0);
  const placements = placeVillageHouses(real, lots, shapes), boxes = placements.map(houseObstacle);
  assert.equal(placements.length, lots.length);
  assert.ok(placements.length >= 60);
  for (const route of routes) for (let i = 0; i <= 300; i++) for (const side of [-1, 0, 1]) {
    const dx = route.bx - route.ax, dz = route.bz - route.az, length = Math.hypot(dx, dz);
    const x = route.ax + dx * i / 300 + dz / length * side, z = route.az + dz * i / 300 - dx / length * side;
    for (const box of boxes) assert.equal(insideObstacle(x, z, box, .3), false, 'route and player radius remain clear');
  }
  for (const segments of [192, 256]) {
    for (const p of placeVillageHouses(real, lots, shapes, segments)) {
      for (let ix = 0; ix <= 8; ix++) for (let iz = 0; iz <= 8; iz++) {
        const point = buildingPoint(p.plan, (ix / 8 - .5) * p.plan.w, (iz / 8 - .5) * p.plan.d);
        assert.ok(p.plan.y >= real.heightAt(point.x, point.z) && p.plan.y >= renderedGroundHeight(real, point.x, point.z, segments));
      }
    }
  }
  assert.equal(createHash('sha256').update(new Uint8Array(real.h.buffer)).digest('hex'), before);
});

test('missing/invalid assets never produce an invented placeholder house or collider', () => {
  const t = synthetic(() => 1);
  assert.deepEqual(placeVillageHouses(t, [lot()], []), []);
  assert.throws(() => placeVillageHouses(t, [lot()], [{ bounds: { min: [0, 0, 0], max: [0, 3, 4] } }]));
  assert.throws(() => placeVillageHouses(t, [lot()], shapes, 0));
  const empty = foundationMeshData(t, []);
  assert.equal(empty.indices.length, 0); assert.equal(empty.exposedMax, 0);
});
