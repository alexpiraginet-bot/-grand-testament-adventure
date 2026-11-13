import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { Terrain, decodeHeights } from '../src/terrain.ts';
import { buildingPoint, insideObstacle, missionRoutes, settlementLayout } from '../src/world-layout.ts';
import { houseObstacle, placeVillageHouses, renderedGroundHeight, type HouseShape } from '../src/village-house-placement.ts';
import { facadeHousePlacements, frontFacingHouseB, HOUSE_B_FRONT_YAW } from '../src/village-facade-layout.ts';
import { FACADE_DETAIL_LIMITS, villageDetailsR13 } from '../src/village-detail-r13.ts';

const json = (p: string) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const meta = json('public/world/cafarnaum.json'), real = new Terrain(meta, decodeHeights(json('public/world/cafarnaum-heights.json')));
const catalog = json('src/data/tripo-assets.json');
const shapes: HouseShape[] = ['casa-basalto-a', 'casa-basalto-b', 'casa-basalto-c'].map(id => ({ bounds: catalog.assets[id].bounds }));
const cap = meta.places.find((p: {id: string}) => p.id === 'Capernaum');
const routes = missionRoutes(real), lots = settlementLayout(real, routes, cap.x, cap.z);
const wood = () => ({ map: new THREE.Texture(), normalMap: new THREE.Texture(), roughnessMap: new THREE.Texture() });
const nearly = (a: number, b: number, label: string) => assert.ok(Math.abs(a - b) < 1e-7, `${label}: ${a} versus ${b}`);

test('B source front +X becomes +Z with immutable shape data and unchanged aspect ratios', () => {
  const source = { ...shapes[1], footprint: [{ x: -4, z: -2.5 }, { x: 4, z: -2.5 }, { x: 4, z: 2.5 }] };
  const before = structuredClone(source), turned = frontFacingHouseB(source);
  const front = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), HOUSE_B_FRONT_YAW);
  nearly(front.x, 0, 'front X'); nearly(front.z, 1, 'front Z');
  assert.deepEqual(turned.bounds, { min: [-2.5, 0, -4], max: [2.5, 3, 4] });
  assert.deepEqual(source, before);
});

test('local corrections retain B height and street edge; all unsampled houses exactly preserve placement', () => {
  const original = structuredClone(lots), baseline = placeVillageHouses(real, lots, shapes, 256);
  const actual = facadeHousePlacements(real, lots, shapes, routes, 256);
  assert.equal(actual.length, baseline.length); assert.deepEqual(lots, original);
  assert.ok(actual.some(p => p.correctedFront), 'the real initial route must include a corrected B');
  assert.ok(actual.filter(p => p.sample).length < 30, 'authored sample is bounded');
  actual.forEach((p, i) => {
    if (!p.correctedFront) assert.deepEqual(p.plan, baseline[i].plan);
    else {
      nearly(p.plan.h, baseline[i].plan.h, 'human-scale house height'); nearly(p.scale, baseline[i].scale, 'uniform source scale');
      const before = buildingPoint(baseline[i].plan, 0, baseline[i].plan.d / 2), after = buildingPoint(p.plan, 0, p.plan.d / 2);
      nearly(before.x, after.x, 'front X'); nearly(before.z, after.z, 'front Z');
      nearly(p.plan.w / 5, p.plan.h / 3, 'source width-height proportion'); nearly(p.plan.d / 8, p.plan.h / 3, 'source depth-height proportion');
    }
  });
});

for (const segments of [192, 256]) test(`real terrain ${segments}: details are supported, route/camera clearance stays open, batches bounded`, () => {
  const places = facadeHousePlacements(real, lots, shapes, routes, segments), boxes = places.map(houseObstacle);
  const net = new THREE.Mesh(new THREE.BoxGeometry(1.5, .3, 1).translate(0, .15, 0), new THREE.MeshStandardMaterial());
  const rocks = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 2).translate(0, .6, 0), new THREE.MeshStandardMaterial());
  const maps = wood(), result = villageDetailsR13(real, places, routes, boxes, maps, { net, rocks }, segments);
  assert.ok(result.counts.doors >= 3); assert.ok(result.counts.porches >= 1);
  assert.ok(result.counts.batches <= FACADE_DETAIL_LIMITS.batches);
  for (const s of routes) {
    const length = Math.hypot(s.bx - s.ax, s.bz - s.az), n = Math.ceil(length / .2);
    for (let i = 0; i <= n; i++) {
      const x = s.ax + (s.bx - s.ax) * i / n, z = s.az + (s.bz - s.az) * i / n;
      assert.ok(![...boxes, ...result.boxes].some(b => insideObstacle(x, z, b, s.r)), `blocked route corridor at ${x},${z}`);
    }
  }
  for (const box of result.boxes) {
    assert.ok(Number.isFinite(box.bottom) && Number.isFinite(box.top));
    assert.ok(box.bottom! <= renderedGroundHeight(real, box.x, box.z, segments) + .03, 'no floating prop root above rendered triangles');
  }
  const timbers = result.group.getObjectByName('textured-handhewn-doors-and-porches') as THREE.Mesh;
  const material = timbers.material as THREE.MeshStandardMaterial;
  assert.equal(material.map, maps.map); assert.equal(material.normalMap, maps.normalMap);
  const position = timbers.geometry.getAttribute('position'), normal = timbers.geometry.getAttribute('normal');
  let volume = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i); b.fromBufferAttribute(position, i + 1); c.fromBufferAttribute(position, i + 2);
    volume += a.dot(b.cross(c)) / 6;
    assert.ok(Number.isFinite(normal.getX(i) + normal.getY(i) + normal.getZ(i)));
  }
  assert.ok(volume > .1, 'closed timbers have outward-facing surfaces, not inward normals');
});

test('missing facade maps produce no untextured architecture or invisible new colliders', () => {
  const places = facadeHousePlacements(real, lots, shapes, routes, 256);
  const out = villageDetailsR13(real, places, routes, places.map(houseObstacle), undefined);
  assert.equal(out.group.children.length, 0); assert.equal(out.boxes.length, 0); assert.equal(out.counts.doors, 0);
});

test('closed door infill covers its opening at every house rotation, including board seams', () => {
  for (const rot of [0, Math.PI / 2, -.63, 2.41]) {
    const p = { x: 0, z: 0, y: 6, w: 6, d: 5, h: 3, foundation: .1, variant: 0, rot };
    const house = { plan: p, sample: true, correctedFront: false, lotIndex: 7, scale: 1,
      sourceOffset: { x: 0, y: 0, z: 0 }, outline: [] };
    const result = villageDetailsR13(real, [house], [], [houseObstacle(house)], wood());
    const mesh = result.group.getObjectByName('textured-handhewn-doors-and-porches') as THREE.Mesh;
    mesh.updateMatrixWorld(true);
    const direction = new THREE.Vector3(-Math.sin(rot), 0, -Math.cos(rot));
    let misses = 0;
    for (let row = 0; row < 7; row++) for (let col = 0; col < 61; col++) {
      const localX = -.44 + col * .88 / 60, point = buildingPoint(p, localX, 2.05);
      const ray = new THREE.Raycaster(new THREE.Vector3(point.x, p.y + .16 + row * .25, point.z), direction, 0, .8);
      if (!ray.intersectObject(mesh).length) misses++;
    }
    assert.equal(misses, 0, `door faces viewer continuously when house is rotated ${rot}`);
  }
});
