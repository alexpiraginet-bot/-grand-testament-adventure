import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BenchRun, benchShots, frameStats, percentile, type Shot } from "../src/bench.ts";
import { decodeHeights, Terrain, type HeightsFile, type WorldMeta } from "../src/terrain.ts";

test("nearest-rank percentiles and frame statistics", () => {
  assert.ok(Number.isNaN(percentile([], 95)));
  const ms = Array.from({ length: 100 }, (_, i) => i + 1);          // 1..100 ms
  assert.equal(percentile(ms, 50), 50); assert.equal(percentile(ms, 95), 95); assert.equal(percentile(ms, 99), 99);
  assert.equal(percentile(ms, 100), 100); assert.equal(percentile([7], 1), 7);
  assert.equal(percentile([30, 10, 20], 50), 20, "order of the samples does not matter");
  const s = frameStats([10, 10, 10, 40]);
  assert.equal(s.frames, 4); assert.equal(s.meanMs, 17.5); assert.equal(s.p50Ms, 10); assert.equal(s.p95Ms, 40); assert.equal(s.maxMs, 40);
  assert.ok(Math.abs(s.fps - 1000 / 17.5) < 1e-9);
  assert.ok(Number.isNaN(frameStats([]).meanMs));
});

test("bench shots come from the episode's points on the real terrain, above ground and above the lake", () => {
  const meta = JSON.parse(readFileSync(new URL("../public/world/cafarnaum.json", import.meta.url), "utf8")) as WorldMeta;
  const heights = JSON.parse(readFileSync(new URL("../public/world/cafarnaum-heights.json", import.meta.url), "utf8")) as HeightsFile;
  const terrain = new Terrain(meta, decodeHeights(heights));
  const P = meta.points as unknown as Parameters<typeof benchShots>[0];
  const shots = benchShots(P, (x, z) => terrain.heightAt(x, z));
  assert.deepEqual(shots.map((s) => s.name), ["vila", "viela", "margem", "pescadores", "barco", "panorama"]);
  for (const s of shots) {
    assert.ok([...s.eye, ...s.target].every(Number.isFinite), s.name);
    assert.ok(terrain.inside(s.eye[0], s.eye[2], 0), `${s.name} eye inside the measured terrain`);
    assert.ok(s.eye[1] >= Math.max(terrain.heightAt(s.eye[0], s.eye[2]), 0) + 1.5, `${s.name} eye above ground and water`);
    assert.ok(Math.hypot(s.target[0] - s.eye[0], s.target[2] - s.eye[2]) > 5, `${s.name} looks somewhere`);
  }
  assert.deepEqual(benchShots(P, (x, z) => terrain.heightAt(x, z)), shots, "deterministic");
});

test("a bench run keeps warm-up frames apart, measures each shot in turn and stops", () => {
  const shot = (name: string): Shot => ({ name, eye: [0, 2, 0], target: [0, 1, -10] });
  const run = new BenchRun([shot("a"), shot("b")], 2, 3);
  const seen: string[] = [];
  const times = [100, 90, 10, 11, 12, 300, 5, 20, 21, 22, 999];        // a: warm 100,90 | 10,11,12 ; b: warm 300,5 | 20,21,22
  for (const ms of times) { seen.push(run.shot?.name ?? "-"); run.record(ms, seen.length, seen.length * 10); }
  assert.deepEqual(seen, ["a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "-"]);
  assert.equal(run.done, true); assert.equal(run.shot, null);
  const r = run.results();
  assert.deepEqual(r.shots.map((s) => [s.name, s.stats.frames, s.stats.p50Ms, s.warmupMaxMs, s.calls]), [["a", 3, 11, 100, 5], ["b", 3, 21, 300, 10]]);
  assert.equal(r.all.frames, 6); assert.equal(r.all.maxMs, 22, "warm-up and frames after the end are not measured");
});
