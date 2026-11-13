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

export type ShotResult = { name: string; eye: Shot["eye"]; target: Shot["target"]; stats: FrameStats; warmupMaxMs: number;
  calls: number; triangles: number };

/**
 * Walks the shots in order: each holds `warmup` frames (shader compilation and streaming land here and are reported
 * apart as warmupMaxMs) and then `frames` measured frames. Feed it one frame time per rendered frame.
 */
export class BenchRun {
  private i = 0;
  private n = 0;
  private measured: number[][];
  private warmMax: number[];
  private info: { calls: number; triangles: number }[];
  readonly shots: readonly Shot[];
  readonly warmup: number;
  readonly frames: number;

  constructor(shots: readonly Shot[], warmup = 30, frames = 180) {
    this.shots = shots; this.warmup = warmup; this.frames = frames;
    this.measured = shots.map(() => []); this.warmMax = shots.map(() => 0); this.info = shots.map(() => ({ calls: 0, triangles: 0 }));
  }

  get done() { return this.i >= this.shots.length; }
  /** The shot the next frame must show, or null when the route is over. */
  get shot(): Shot | null { return this.done ? null : this.shots[this.i]; }

  /** Record the frame just shown (its time in ms and the renderer's counters), then advance. */
  record(frameMs: number, calls: number, triangles: number) {
    if (this.done) return;
    if (this.n < this.warmup) this.warmMax[this.i] = Math.max(this.warmMax[this.i], frameMs);
    else this.measured[this.i].push(frameMs);
    this.info[this.i] = { calls, triangles };
    if (++this.n >= this.warmup + this.frames) { this.i++; this.n = 0; }
  }

  results(): { shots: ShotResult[]; all: FrameStats } {
    return {
      shots: this.shots.map((s, k) => ({ name: s.name, eye: s.eye, target: s.target, stats: frameStats(this.measured[k]),
        warmupMaxMs: this.warmMax[k], ...this.info[k] })),
      all: frameStats(this.measured.flat()),
    };
  }
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
