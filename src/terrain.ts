// The ground of the world: heights from public/world/<id>.bin (made by tools/build_world.py from real elevation data).
// x grows to the east, z to the south, y up; y = 0 is the surface of the lake.

export type WorldMeta = {
  id: string;
  size: number;
  n: number;
  step: number;
  lake_level_m: number;
  relief_range_m: [number, number];
  center: { lugar: string; nome: string; lon: number; lat: number };
  shoreline: [number, number][];
  points: Record<"start" | "beach" | "simao" | "barco" | "barco_margem", [number, number]>;
  level_design: { empregados: number; [k: string]: unknown };
  places: { id: string; nome: string; tipo: string; x: number; z: number }[];
  sources: Record<string, string | number>;
};

export class Terrain {
  readonly meta: WorldMeta;
  readonly h: Float32Array;     // metres, row-major, row 0 = north
  readonly n: number;
  readonly size: number;
  readonly step: number;

  constructor(meta: WorldMeta, cm: Int16Array) {
    if (cm.length !== meta.n * meta.n) throw new Error(`terrain: ${cm.length} heights, expected ${meta.n * meta.n}`);
    this.meta = meta;
    this.n = meta.n;
    this.size = meta.size;
    this.step = meta.step;
    this.h = new Float32Array(cm.length);
    for (let i = 0; i < cm.length; i++) this.h[i] = cm[i] / 100;
  }

  /** Height of the ground at (x, z), bilinear between grid points; clamped at the edge. */
  heightAt(x: number, z: number): number {
    const n = this.n;
    const gx = Math.min(n - 1.0001, Math.max(0, (x + this.size / 2) / this.step));
    const gz = Math.min(n - 1.0001, Math.max(0, (z + this.size / 2) / this.step));
    const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
    const a = this.h[j * n + i], b = this.h[j * n + i + 1], c = this.h[(j + 1) * n + i], d = this.h[(j + 1) * n + i + 1];
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
  }

  /** Slope (rise over run) at (x, z). */
  slopeAt(x: number, z: number): number {
    const e = this.step * 0.5;
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return Math.hypot(dx, dz) / (2 * e);
  }

  inside(x: number, z: number, margin = 0): boolean {
    const r = this.size / 2 - margin;
    return Math.abs(x) <= r && Math.abs(z) <= r;
  }
}
