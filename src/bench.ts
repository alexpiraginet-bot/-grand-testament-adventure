// Same-scene benchmark: a fixed camera route over the real Capernaum scene and frame-time statistics.
// Any engine or effect change is compared on these shots, on the same machine (docs/GRAFICO-MASTER.md,
// docs/MOTORES-GRAFICOS.md). Pure functions here; main.ts drives the camera with ?bench, tools/bench.mjs reads results.

export type P2 = [number, number];
export type Shot = { name: string; eye: [number, number, number]; target: [number, number, number] };
export type FrameStats = { frames: number; meanMs: number; p50Ms: number; p95Ms: number; p99Ms: number; maxMs: number; fps: number };

/** Nearest-rank percentile of `values` (0 < p <= 100); NaN for an empty list. */
export function percentile(values: readonly number[], p: number): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

/** Frame-time summary in milliseconds; `fps` is frames per second of the mean frame time. */
export function frameStats(frameMs: readonly number[]): FrameStats {
  const frames = frameMs.length;
  const meanMs = frames ? frameMs.reduce((s, x) => s + x, 0) / frames : NaN;
  return { frames, meanMs, p50Ms: percentile(frameMs, 50), p95Ms: percentile(frameMs, 95), p99Ms: percentile(frameMs, 99),
    maxMs: frames ? Math.max(...frameMs) : NaN, fps: frames ? 1000 / meanMs : NaN };
}

/** Statistics of the samples that arrived, or null when none did (no GPU timer on this backend, or never measured). */
const statsOrNull = (ms: readonly number[]): FrameStats | null => (ms.length ? frameStats(ms) : null);
const isSample = (x: number | null | undefined): x is number => typeof x === "number" && Number.isFinite(x);

/**
 * Optional per-frame timings next to the frame interval. gpuMs: GPU time of the frame from the renderer's timestamp
 * queries; null or absent when it did not arrive. three r186 tracks them only with `timestamp-query` on WebGPU
 * (WebGPUBackend.js:298) and resolves them asynchronously (Renderer.js:3018) to the last resolved frame's total, or the
 * previous value when nothing new resolved (WebGPUTimestampQueryPool.js:96-106,229-236), so a sample can lag a frame or
 * two: the warm-up after each cut absorbs that. cpuMs: main-thread time the caller measured for the same frame.
 */
export type FrameExtra = { gpuMs?: number | null; cpuMs?: number };

/** gpu and cpu use FrameStats too; their `fps` is the rate that time alone would allow, not what the player sees. */
export type ShotResult = { name: string; eye: Shot["eye"]; target: Shot["target"]; stats: FrameStats; warmupMaxMs: number;
  calls: number; triangles: number; gpu: FrameStats | null; cpu: FrameStats | null };
export type BenchResults = { shots: ShotResult[]; all: FrameStats; allGpu: FrameStats | null; allCpu: FrameStats | null;
  gpuUnavailable: string | null };

/**
 * Walks the shots in order: each holds `warmup` frames (shader compilation and streaming land here and are reported
 * apart as warmupMaxMs) and then `frames` measured frames. Feed it one frame time per rendered frame.
 */
export class BenchRun {
  private i = 0;
  private n = 0;
  private measured: number[][];
  private gpu: number[][];
  private cpu: number[][];
  private warmMax: number[];
  private info: { calls: number; triangles: number }[];
  readonly shots: readonly Shot[];
  readonly warmup: number;
  readonly frames: number;
  /** Why gpuMs is missing (e.g. "no timestamp-query"), set by the caller and reported, so a null is never silent. */
  gpuUnavailable?: string;

  constructor(shots: readonly Shot[], warmup = 30, frames = 180) {
    this.shots = shots; this.warmup = warmup; this.frames = frames;
    this.measured = shots.map(() => []); this.gpu = shots.map(() => []); this.cpu = shots.map(() => []);
    this.warmMax = shots.map(() => 0); this.info = shots.map(() => ({ calls: 0, triangles: 0 }));
  }

  get done() { return this.i >= this.shots.length; }
  /** The shot the next frame must show, or null when the route is over. */
  get shot(): Shot | null { return this.done ? null : this.shots[this.i]; }

  /**
   * Record the frame just shown (its time in ms, the renderer's counters and, when known, its GPU and CPU time), then
   * advance. GPU and CPU samples are kept only for measured frames, like the frame time; a missing one is skipped.
   */
  record(frameMs: number, calls: number, triangles: number, extra?: FrameExtra) {
    if (this.done) return;
    if (this.n < this.warmup) this.warmMax[this.i] = Math.max(this.warmMax[this.i], frameMs);
    else {
      this.measured[this.i].push(frameMs);
      const gpuMs = extra?.gpuMs, cpuMs = extra?.cpuMs;
      if (isSample(gpuMs)) this.gpu[this.i].push(gpuMs);
      if (isSample(cpuMs)) this.cpu[this.i].push(cpuMs);
    }
    this.info[this.i] = { calls, triangles };
    if (++this.n >= this.warmup + this.frames) { this.i++; this.n = 0; }
  }

  results(): BenchResults {
    return {
      shots: this.shots.map((s, k) => ({ name: s.name, eye: s.eye, target: s.target, stats: frameStats(this.measured[k]),
        warmupMaxMs: this.warmMax[k], ...this.info[k], gpu: statsOrNull(this.gpu[k]), cpu: statsOrNull(this.cpu[k]) })),
      all: frameStats(this.measured.flat()),
      allGpu: statsOrNull(this.gpu.flat()), allCpu: statsOrNull(this.cpu.flat()),
      gpuUnavailable: this.gpuUnavailable ?? null,
    };
  }
}

// ---- GPU memory estimate, in bytes. three r186 renderer.info.memory.texturesSize undercounts what this game will
// ship: Info.js _getTextureMemorySize returns 1 for any compressed texture, one byte for the whole texture with all its
// mips, "since exact format decompressed isn't readily available" (node_modules/three/src/renderers/common/Info.js:451-453),
// and multiplies a generated mip chain by 1.333 (:504-506). These count every level from the format and size instead.

export type TexelFormat = "rgba8" | "rgb8" | "rg8" | "r8" | "rgba16f" | "rgba32f";
export type BlockFormat = "bc7" | "astc4x4" | "etc2rgba" | "etc1s" | "uastc";
export type TextureFormat = TexelFormat | BlockFormat;
/** depth: layers (array layers, 6 for a cube), the same at every level; a 3D texture's halving depth is not modelled. */
export type TextureDesc = { width: number; height: number; depth?: number; format: TextureFormat; mipmaps: boolean };

/**
 * Bytes per texel. rgb8 is the nominal 3 (as Info.js counts it): WebGPU has no 8-bit RGB format, three r186 rejects it
 * (webgpu/utils/WebGPUTextureUtils.js:1661-1674), and WebGL drivers often pad it to 4, so there it is a lower bound.
 */
export const BYTES_PER_TEXEL: Readonly<Record<TexelFormat, number>> = { rgba8: 4, rgb8: 3, rg8: 2, r8: 1, rgba16f: 8, rgba32f: 16 };

/**
 * Bytes per 4x4 block. BC7, ASTC 4x4 and ETC2 RGBA (EAC) are 128-bit blocks. ETC1S and UASTC are Basis transmission
 * formats: on the GPU they become what KTX2Loader transcodes to (examples/jsm/loaders/KTX2Loader.js:793-874), 16 bytes
 * as ASTC 4x4, BC7 or ETC2 RGBA, but 8 when an opaque one becomes ETC1 or BC1 (KTX2Loader prefers ETC1 for ETC1S where
 * ETC2 exists) and 64 on the RGBA32 fallback. 16 is the estimate for both.
 */
export const BYTES_PER_BLOCK: Readonly<Record<BlockFormat, number>> = { bc7: 16, astc4x4: 16, etc2rgba: 16, etc1s: 16, uastc: 16 };

const positiveInt = (x: number) => Number.isInteger(x) && x >= 1;

/**
 * Width and height of every level, base first, down to 1x1 when `mipmaps`: the full chain three r186 allocates,
 * floor(log2(max(w, h))) + 1 levels (renderers/common/Textures.js:522).
 */
export function mipLevels(width: number, height: number, mipmaps: boolean): [number, number][] {
  if (!positiveInt(width) || !positiveInt(height)) throw new RangeError(`texture size ${width}x${height}`);
  const levels: [number, number][] = [[width, height]];
  while (mipmaps && (width > 1 || height > 1)) {
    width = Math.max(1, Math.floor(width / 2)); height = Math.max(1, Math.floor(height / 2));
    levels.push([width, height]);
  }
  return levels;
}

/**
 * GPU bytes of one texture: texels × bytes per texel, or for block formats ceil(w/4) × ceil(h/4) blocks × bytes per
 * block (a 2x2 or 1x1 level still takes a whole block), summed exactly over each mip level, times the layers.
 */
export function textureBytes(t: TextureDesc): number {
  const layers = t.depth ?? 1;
  if (!positiveInt(layers)) throw new RangeError(`texture depth ${layers}`);
  const texel = Object.hasOwn(BYTES_PER_TEXEL, t.format) ? BYTES_PER_TEXEL[t.format as TexelFormat] : undefined;
  const block = Object.hasOwn(BYTES_PER_BLOCK, t.format) ? BYTES_PER_BLOCK[t.format as BlockFormat] : undefined;
  if (texel === undefined && block === undefined) throw new RangeError(`unknown texture format ${t.format}`);
  let bytes = 0;
  for (const [w, h] of mipLevels(t.width, t.height, t.mipmaps))
    bytes += texel !== undefined ? w * h * texel : Math.ceil(w / 4) * Math.ceil(h / 4) * block!;
  return bytes * layers;
}

/**
 * GPU bytes of one render attachment sized from CSS pixels: floor(width × dpr) × floor(height × dpr), as three sizes
 * the drawing buffer (renderers/common/CanvasTarget.js:115), × bytesPerPixel × samples. A multisampled colour target is
 * two textures in three r186, the one it samples plus a `samples` copy it renders into (WebGPUTextureUtils.js:432-463):
 * count it twice, once with samples and once with 1. A multisampled depth texture is one (WebGPUUtils.js:138-140).
 * WebGPU allows 1 or 4 samples (WebGPUUtils.js:232-236): pass the effective count.
 */
export function renderTargetBytes(width: number, height: number, dpr: number, bytesPerPixel: number, samples = 1): number {
  if (!(width > 0 && height > 0 && dpr > 0 && bytesPerPixel > 0) || ![width, height, dpr, bytesPerPixel].every(Number.isFinite) ||
    !positiveInt(samples)) throw new RangeError(`render target ${width}x${height} dpr ${dpr} ${bytesPerPixel} B ${samples} samples`);
  return Math.floor(width * dpr) * Math.floor(height * dpr) * bytesPerPixel * samples;
}

/** A texture to size with textureBytes, or anything already sized (a render target, a buffer) with its own bytes. */
export type MemoryItem = { origin: string } & (TextureDesc | { format: string; bytes: number });
export type MemoryGroup = { count: number; bytes: number };
export type MemorySummary = { count: number; totalBytes: number; byFormat: Record<string, MemoryGroup>; byOrigin: Record<string, MemoryGroup> };

/**
 * Totals in bytes by format and by origin label (e.g. "tripo-r1/hero", "terrain", "render target"), groups listed
 * largest first. Pass each GPU allocation once: a texture shared by several materials is one texture.
 */
export function memorySummary(list: readonly MemoryItem[]): MemorySummary {
  const byFormat = new Map<string, MemoryGroup>(), byOrigin = new Map<string, MemoryGroup>();
  const add = (m: Map<string, MemoryGroup>, key: string, bytes: number) => {
    const g = m.get(key) ?? { count: 0, bytes: 0 }; g.count++; g.bytes += bytes; m.set(key, g);
  };
  let totalBytes = 0;
  for (const item of list) {
    const bytes = "bytes" in item ? item.bytes : textureBytes(item);
    if (!(Number.isFinite(bytes) && bytes >= 0)) throw new RangeError(`${item.origin} ${item.format}: ${bytes} bytes`);
    totalBytes += bytes; add(byFormat, item.format, bytes); add(byOrigin, item.origin, bytes);
  }
  const largestFirst = (m: Map<string, MemoryGroup>) =>
    Object.fromEntries([...m].sort((a, b) => b[1].bytes - a[1].bytes || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
  return { count: list.length, totalBytes, byFormat: largestFirst(byFormat), byOrigin: largestFirst(byOrigin) };
}

type Points = { start: P2; beach: P2; simao: P2; barco_margem: P2; barco: P2 };

/**
 * Six shots along the episode: in the village, down the lane, at the shore, by the fishermen, at the boat and a high
 * view over the houses. Built only from the episode's own points and the terrain, so every engine can rebuild them.
 * Eye height follows the ground (never under the lake surface, y = 0).
 */
export function benchShots(P: Points, heightAt: (x: number, z: number) => number): Shot[] {
  const lerp = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const ground = (p: P2) => Math.max(heightAt(p[0], p[1]), 0);
  const look = (name: string, from: P2, to: P2, eyeUp: number, aimUp = 1.4): Shot => ({
    name, eye: [from[0], ground(from) + eyeUp, from[1]], target: [to[0], ground(to) + aimUp, to[1]] });
  return [
    look("vila", lerp(P.start, P.beach, 0.04), lerp(P.start, P.beach, 0.2), 1.7),
    look("viela", lerp(P.start, P.beach, 0.45), lerp(P.start, P.beach, 0.6), 1.7),
    look("margem", lerp(P.start, P.beach, 0.92), lerp(P.beach, P.simao, 0.5), 1.8, 0.5),
    look("pescadores", lerp(P.beach, P.simao, 0.93), P.simao, 1.7, 1.2),
    look("barco", lerp(P.simao, P.barco_margem, 0.9), P.barco, 1.8, 0.8),
    look("panorama", lerp(P.beach, P.start, 0.35), lerp(P.start, P.beach, 0.15), 38, 0),
  ];
}
