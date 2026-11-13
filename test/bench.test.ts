import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CompressedTexture, DataTexture, RGBA_BPTC_Format, RGBAFormat, UnsignedByteType, Vector2, type Texture } from "three";
import CanvasTarget from "three/src/renderers/common/CanvasTarget.js";
import Info from "three/src/renderers/common/Info.js";
import { BenchRun, benchShots, frameStats, memorySummary, mipLevels, percentile, renderTargetBytes, textureBytes,
  type FrameExtra, type MemoryItem, type Shot, type TexelFormat } from "../src/bench.ts";
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

test("GPU and CPU time per shot leave the warm-up out and are null when no sample arrived", () => {
  const shot = (name: string): Shot => ({ name, eye: [0, 2, 0], target: [0, 1, -10] });
  const run = new BenchRun([shot("a"), shot("b"), shot("c")], 2, 3);
  // a: both timers, one GPU sample lost (NaN) | b: CPU only, the GPU timer answers null | c: the old 3-argument calls
  const frames: [number, FrameExtra?][] = [
    [100, { gpuMs: 80, cpuMs: 70 }], [90, { gpuMs: 60, cpuMs: 50 }],
    [10, { gpuMs: 4, cpuMs: 2 }], [11, { gpuMs: NaN, cpuMs: 3 }], [12, { gpuMs: 6, cpuMs: 4 }],
    [300, { gpuMs: null, cpuMs: 200 }], [5, { cpuMs: 1 }],
    [20, { gpuMs: null, cpuMs: 7 }], [21, { cpuMs: 8 }], [22, { gpuMs: null, cpuMs: 9 }],
    [40], [41], [42], [43], [44],
  ];
  for (const [ms, extra] of frames) if (extra) run.record(ms, 1, 1, extra); else run.record(ms, 1, 1);
  assert.equal(run.done, true);
  run.record(1, 1, 1, { gpuMs: 999, cpuMs: 999 });                       // after the end: ignored
  let r = run.results();
  assert.equal(r.gpuUnavailable, null, "no reason given");
  const [a, b, c] = r.shots;
  assert.deepEqual(a.gpu, frameStats([4, 6]), "warm-up 80, 60 and the lost sample are out");
  assert.deepEqual(a.cpu, frameStats([2, 3, 4]));
  assert.equal(b.gpu, null); assert.deepEqual(b.cpu, frameStats([7, 8, 9]));
  assert.equal(c.gpu, null); assert.equal(c.cpu, null);
  assert.deepEqual(r.allGpu, frameStats([4, 6]));
  assert.deepEqual(r.allCpu, frameStats([2, 3, 4, 7, 8, 9]));
  assert.deepEqual(r.all, frameStats([10, 11, 12, 20, 21, 22, 42, 43, 44]), "frame time unchanged by the extra timings");
  run.gpuUnavailable = "no timestamp-query";
  r = JSON.parse(JSON.stringify(run.results()));
  assert.equal(r.gpuUnavailable, "no timestamp-query", "the reason reaches bench.json");
  assert.equal(r.shots[2].gpu, null, "a null survives JSON, so a missing timer is never a missing key");

  const plain = new BenchRun([shot("a")], 1, 2);
  for (const ms of [50, 10, 12]) plain.record(ms, 1, 1);
  const p = plain.results();
  assert.equal(p.allGpu, null); assert.equal(p.allCpu, null); assert.deepEqual(p.all, frameStats([10, 12]));
});

test("texture bytes count every mip level exactly and whole 4x4 blocks for compressed formats", () => {
  assert.equal(textureBytes({ width: 4, height: 4, format: "rgba8", mipmaps: false }), 4 * 4 * 4);
  assert.equal(textureBytes({ width: 8, height: 8, format: "rgba8", mipmaps: true }), (8 * 8 + 4 * 4 + 2 * 2 + 1 * 1) * 4);
  assert.equal(textureBytes({ width: 4, height: 4, format: "bc7", mipmaps: false }), 16, "one 128-bit block");
  // 8x8 is 2x2 blocks; the 4x4, 2x2 and 1x1 levels take one whole block each
  assert.equal(textureBytes({ width: 8, height: 8, format: "bc7", mipmaps: true }), (4 + 1 + 1 + 1) * 16);
  // non-power-of-two: each level halves and rounds down, blocks round up
  assert.deepEqual(mipLevels(10, 6, true), [[10, 6], [5, 3], [2, 1], [1, 1]]);
  assert.equal(mipLevels(10, 6, true).length, Math.floor(Math.log2(Math.max(10, 6))) + 1, "three's level count (Textures.js:522)");
  assert.deepEqual(mipLevels(10, 6, false), [[10, 6]]);
  assert.equal(textureBytes({ width: 10, height: 6, format: "astc4x4", mipmaps: true }), (3 * 2 + 2 * 1 + 1 * 1 + 1 * 1) * 16);
  assert.equal(textureBytes({ width: 5, height: 5, format: "etc2rgba", mipmaps: false }), 2 * 2 * 16);
  assert.equal(textureBytes({ width: 10, height: 6, format: "rgba8", mipmaps: true }), (10 * 6 + 5 * 3 + 2 * 1 + 1 * 1) * 4);
  assert.equal(textureBytes({ width: 4, height: 4, depth: 6, format: "rgba16f", mipmaps: false }), 4 * 4 * 8 * 6, "layers multiply");
  // channels × bytes per channel
  const perTexel: Record<TexelFormat, number> = { r8: 1 * 1, rg8: 2 * 1, rgb8: 3 * 1, rgba8: 4 * 1, rgba16f: 4 * 2, rgba32f: 4 * 4 };
  for (const [format, bytes] of Object.entries(perTexel) as [TexelFormat, number][])
    assert.equal(textureBytes({ width: 1, height: 1, format, mipmaps: false }), bytes, format);
  for (const format of ["etc1s", "uastc"] as const)
    assert.equal(textureBytes({ width: 8, height: 8, format, mipmaps: true }), textureBytes({ width: 8, height: 8, format: "bc7", mipmaps: true }),
      `${format} is sized as its 16-byte-block transcode target`);
  assert.throws(() => textureBytes({ width: 0, height: 4, format: "rgba8", mipmaps: false }), RangeError);
  assert.throws(() => textureBytes({ width: 2.5, height: 4, format: "rgba8", mipmaps: false }), RangeError);
  assert.throws(() => textureBytes({ width: 4, height: 4, depth: 0, format: "rgba8", mipmaps: false }), RangeError);
  assert.throws(() => textureBytes({ width: 4, height: 4, format: "toString" as "rgba8", mipmaps: false }), RangeError);
});

test("three r186 renderer.info counts a compressed texture as one byte and rounds generated mips; the estimate does not", () => {
  const counted = (t: Texture) => { const info = new Info(); info.createTexture(t); return info.memory.texturesSize; };
  const plain = new DataTexture(new Uint8Array(4 * 4 * 4), 4, 4, RGBAFormat, UnsignedByteType);
  assert.equal(counted(plain), textureBytes({ width: 4, height: 4, format: "rgba8", mipmaps: false }), "same without compression or mips");
  const generated = new DataTexture(new Uint8Array(8 * 8 * 4), 8, 8, RGBAFormat, UnsignedByteType);
  generated.generateMipmaps = true;
  assert.equal(counted(generated), Math.round(8 * 8 * 4 * 1.333), "Info.js:504-506 scales the base level by 1.333");
  assert.equal(textureBytes({ width: 8, height: 8, format: "rgba8", mipmaps: true }), (64 + 16 + 4 + 1) * 4);
  const mips = mipLevels(8, 8, true).map(([width, height]) => ({ data: new Uint8Array(Math.ceil(width / 4) * Math.ceil(height / 4) * 16), width, height }));
  const bc7 = new CompressedTexture(mips, 8, 8, RGBA_BPTC_Format);
  assert.equal(counted(bc7), 1, "Info.js:451-453: one byte for the whole compressed texture");
  assert.equal(textureBytes({ width: 8, height: 8, format: "bc7", mipmaps: true }), mips.reduce((s, m) => s + m.data.byteLength, 0),
    "the estimate is the data the texture hands the GPU");
});

test("render target bytes follow three's floored drawing buffer, the pixel ratio and the samples", () => {
  const canvas = new CanvasTarget({ width: 1, height: 1, style: {} } as unknown as HTMLCanvasElement);
  // 390x844 and 1280x800 are the checked viewports; main.ts:62 caps the pixel ratio at 2 (1.5 on low); bench.mjs uses 1
  for (const [w, h, dpr] of [[390, 844, 2], [390, 844, 1.5], [1280, 800, 1], [391, 845, 1.5]]) {
    canvas.setPixelRatio(dpr); canvas.setSize(w, h, false);
    const buf = canvas.getDrawingBufferSize(new Vector2());
    assert.equal(renderTargetBytes(w, h, dpr, 4, 1), buf.x * buf.y * 4, `${w}x${h} at ${dpr}`);
  }
  assert.equal(renderTargetBytes(390, 844, 2, 4, 1), 780 * 1688 * 4);
  assert.equal(renderTargetBytes(391, 845, 1.5, 4, 1), 586 * 1267 * 4, "586.5 and 1267.5 round down");
  // one rgba16f colour attachment (PassNode.js:246, HalfFloatType) of the fx=alto scene pass, 4 samples (postfx.ts:36):
  // the 4-sample texture it renders into plus the 1-sample one it is read from
  const msaa = renderTargetBytes(1280, 800, 1, 8, 4) + renderTargetBytes(1280, 800, 1, 8, 1);
  assert.equal(msaa, 1280 * 800 * 8 * (4 + 1));
  assert.equal(renderTargetBytes(4, 4, 1, 8), 4 * 4 * 8, "samples default to 1");
  const bad: [number, number, number, number, number][] = [[0, 4, 1, 4, 1], [4, 4, 0, 4, 1], [4, 4, 1, 4, 0], [4, 4, 1, 4, 1.5], [4, 4, NaN, 4, 1]];
  for (const args of bad) assert.throws(() => renderTargetBytes(...args), RangeError, args.join(","));
});

test("memory summary groups bytes by format and by origin, largest first", () => {
  const list: MemoryItem[] = [
    { origin: "tripo-r1/hero", width: 8, height: 8, format: "bc7", mipmaps: true },
    { origin: "tripo-r1/hero", width: 4, height: 4, format: "rgba8", mipmaps: false },
    { origin: "terrain", width: 8, height: 8, format: "rgba8", mipmaps: true },
    { origin: "render target", format: "rgba16f", bytes: renderTargetBytes(4, 4, 1, 8, 1) },
  ];
  const bc7Mips = (4 + 1 + 1 + 1) * 16, rgba4 = 4 * 4 * 4, rgba8Mips = (64 + 16 + 4 + 1) * 4, target = 4 * 4 * 8;
  const s = memorySummary(list);
  assert.equal(s.count, 4);
  assert.equal(s.totalBytes, bc7Mips + rgba4 + rgba8Mips + target);
  assert.deepEqual(s.byFormat, { rgba8: { count: 2, bytes: rgba4 + rgba8Mips }, rgba16f: { count: 1, bytes: target }, bc7: { count: 1, bytes: bc7Mips } });
  assert.deepEqual(Object.keys(s.byFormat), ["rgba8", "rgba16f", "bc7"], "largest first");
  assert.deepEqual(s.byOrigin, { terrain: { count: 1, bytes: rgba8Mips }, "tripo-r1/hero": { count: 2, bytes: bc7Mips + rgba4 },
    "render target": { count: 1, bytes: target } });
  assert.deepEqual(Object.keys(s.byOrigin), ["terrain", "tripo-r1/hero", "render target"]);
  assert.deepEqual(memorySummary([]), { count: 0, totalBytes: 0, byFormat: {}, byOrigin: {} });
  assert.throws(() => memorySummary([{ origin: "x", format: "rgba8", bytes: NaN }]), RangeError);
});

test("zero and negative GPU/CPU times are not samples (three reports 0 before anything resolves)", () => {
  const run = new BenchRun([{ name: "a", eye: [0, 2, 0], target: [0, 1, -10] }], 0, 3);
  run.record(16, 1, 1, { gpuMs: 0, cpuMs: -1 });
  run.record(16, 1, 1, { gpuMs: 4, cpuMs: 2 });
  run.record(16, 1, 1, { gpuMs: -3, cpuMs: 0 });
  const r = run.results();
  assert.equal(r.shots[0].gpu!.frames, 1); assert.equal(r.shots[0].gpu!.p50Ms, 4);
  assert.equal(r.shots[0].cpu!.frames, 1); assert.equal(r.shots[0].cpu!.p50Ms, 2);
});
