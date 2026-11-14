import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { CAST_NET_ROOT_Y, restCastNetOnWater } from '../src/cast-net-placement.ts';

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
function cloth() {
  const g = new THREE.PlaneGeometry(2, 3.5, 4, 4).rotateX(-Math.PI / 2);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, i === 0 ? 0 : .2 + Math.sin(i) * .01);
  return g;
}

test('the cloth meets water despite a single lower weight and the caller root offset', () => {
  const g = cloth(), before = [...g.getAttribute('position').array];
  const indices = [...g.index!.array], uv = [...g.getAttribute('uv').array], normal = [...g.getAttribute('normal').array];
  const out = restCastNetOnWater(g), p = g.getAttribute('position');
  assert.ok(out.sourceMedianY > .19 && out.sourceMedianY < .21);
  assert.ok(out.shiftY < -.26 && out.shiftY > -.28);
  const sorted = Array.from({ length: p.count }, (_, i) => p.getY(i) + CAST_NET_ROOT_Y).sort((a, b) => a - b);
  near(sorted[Math.floor(sorted.length / 2)], 0);
  assert.ok(out.worldP10Y > -.02 && out.worldP90Y < .02);
  assert.ok(out.worldMinY < -.19, 'hanging weight can sink below the cloth surface');
  for (let i = 0; i < p.count; i++) {
    near(p.getX(i), before[i * 3]); near(p.getZ(i), before[i * 3 + 2]);
    near(p.getY(i) - before[i * 3 + 1], out.shiftY);
  }
  assert.deepEqual([...g.index!.array], indices);
  assert.deepEqual([...g.getAttribute('uv').array], uv);
  assert.deepEqual([...g.getAttribute('normal').array], normal);
  g.dispose();
});

test('flat fallback and an explicit raised waterline use the same root contract', () => {
  const g = new THREE.CircleGeometry(1.8, 24).rotateX(-Math.PI / 2);
  const out = restCastNetOnWater(g, .07, 2);
  near(out.worldMinY, 2); near(out.worldMaxY, 2);
  const position = [...g.getAttribute('position').array];
  restCastNetOnWater(g, .07, 2);
  assert.deepEqual([...g.getAttribute('position').array], position, 'repeat operation does not keep lowering the net');
  g.dispose();
});

test('a vertical or thick asset is rejected before deforming it into a false flat net', () => {
  const g = new THREE.PlaneGeometry(2, 3.5), before = [...g.getAttribute('position').array];
  assert.throws(() => restCastNetOnWater(g), /horizontal resting mesh/);
  assert.deepEqual([...g.getAttribute('position').array], before);
  g.dispose();
});

test('adjusting a private copy preserves original asset geometry', () => {
  const g = cloth(), copy = g.clone(), before = [...g.getAttribute('position').array];
  restCastNetOnWater(copy);
  assert.deepEqual([...g.getAttribute('position').array], before);
  assert.throws(() => restCastNetOnWater(g, Infinity), /waterline/);
  assert.deepEqual([...g.getAttribute('position').array], before);
  g.dispose(); copy.dispose();
});
