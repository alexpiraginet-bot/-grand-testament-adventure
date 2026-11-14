import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { settleRockIslands } from '../src/rock-grounding.ts';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function twoStones() {
  const a = new THREE.BoxGeometry(1, 1, 1).toNonIndexed().translate(-2, 2, 0);
  const b = new THREE.BoxGeometry(1.3, .6, .8).toNonIndexed().translate(2, 5, 0);
  const g = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const left = a.getAttribute(name), right = b.getAttribute(name);
    g.setAttribute(name, new THREE.Float32BufferAttribute([...left.array, ...right.array], left.itemSize));
  }
  a.dispose(); b.dispose(); return g;
}

test('disconnected stones fall rigidly to their own base; UV seams do not become separate islands', () => {
  const g = twoStones(), before = Array.from(g.getAttribute('position').array);
  const normal = Array.from(g.getAttribute('normal').array), uv = Array.from(g.getAttribute('uv').array);
  const result = settleRockIslands(g), p = g.getAttribute('position');
  assert.equal(result.islands, 2); near(result.maxShift, 4.7);
  for (let i = 0; i < p.count; i++) {
    near(p.getX(i), before[i * 3]); near(p.getZ(i), before[i * 3 + 2]);
    near(p.getY(i), before[i * 3 + 1] - (i < 36 ? 1.5 : 4.7));
  }
  assert.deepEqual(Array.from(g.getAttribute('normal').array), normal);
  assert.deepEqual(Array.from(g.getAttribute('uv').array), uv);
  near(g.boundingBox!.min.y, 0); near(g.boundingBox!.max.y, 1);
  const settled = Array.from(p.array); settleRockIslands(g);
  assert.deepEqual(Array.from(p.array), settled, 'settling twice does not keep sinking the stones');
  g.dispose();
});

test('indexed geometry retains its topology and dimensions, including a below-origin base', () => {
  const g = new THREE.BoxGeometry(3, 2, 1).translate(.4, -3, .2);
  const indices = [...g.index!.array], before = new THREE.Box3().setFromBufferAttribute(g.getAttribute('position') as THREE.BufferAttribute);
  const result = settleRockIslands(g);
  assert.equal(result.islands, 1); near(result.maxShift, 4);
  assert.deepEqual([...g.index!.array], indices);
  near(g.boundingBox!.min.y, 0);
  const size = g.boundingBox!.getSize(new THREE.Vector3()), original = before.getSize(new THREE.Vector3());
  near(size.x, original.x); near(size.y, original.y); near(size.z, original.z);
  g.dispose();
});

test('private geometry correction does not mutate the source geometry or its bounds', () => {
  const original = twoStones(); original.computeBoundingBox();
  const before = [...original.getAttribute('position').array], bounds = original.boundingBox!.clone();
  const copy = original.clone(); settleRockIslands(copy);
  assert.deepEqual([...original.getAttribute('position').array], before);
  assert.deepEqual(original.boundingBox, bounds);
  original.dispose(); copy.dispose();
});

test('malformed topology is rejected before changing positions', () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 2, 0, 1, 2, 0, 0, 3, 0], 3));
  const before = [...g.getAttribute('position').array];
  g.setIndex([0, 1, 99]);
  assert.throws(() => settleRockIslands(g), /invalid index/);
  assert.deepEqual([...g.getAttribute('position').array], before);
  g.setIndex([0, 1]);
  assert.throws(() => settleRockIslands(g), /triangle topology/);
  assert.deepEqual([...g.getAttribute('position').array], before);
  g.dispose();
});
