// CPU-only placement shared by village visuals, colliders and their tests.
// It reads the measured DEM; it never flattens or writes terrain samples.
import type { Terrain } from './terrain.ts';
import { buildingPoint, type Building, type Obstacle } from './world-layout.ts';

export type PointXZ = { x: number; z: number };
export type HouseBounds = { min: readonly number[]; max: readonly number[] };
export type HouseShape = { bounds: HouseBounds; footprint?: readonly PointXZ[] };
export type PlacedHouse = {
  plan: Building;
  scale: number;
  /** Translation before the uniform scale: XZ centred, lowest vertex at zero. */
  sourceOffset: { x: number; y: number; z: number };
  /** Convex base outline in local, scaled metres. Roof eaves are not a plinth. */
  outline: PointXZ[];
};

const FLOOR_CLEARANCE = .025;
export const FOUNDATION_EMBED = .08;
export const FOUNDATION_TILE_METRES = 1.8;

/** Height of the actual PlaneGeometry triangles, including the low-quality grid. */
export function renderedGroundHeight(t: Terrain, x: number, z: number, segments = t.n - 1): number {
  const step = t.size / segments;
  const gx = Math.min(segments - 1e-8, Math.max(0, (x + t.size / 2) / step));
  const gz = Math.min(segments - 1e-8, Math.max(0, (z + t.size / 2) / step));
  const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
  const x0 = ix * step - t.size / 2, z0 = iz * step - t.size / 2;
  const a = t.heightAt(x0, z0), b = t.heightAt(x0 + step, z0);
  const c = t.heightAt(x0, z0 + step), d = t.heightAt(x0 + step, z0 + step);
  // PlaneGeometry indexes a,c,b and c,d,b (the +X/-Z diagonal).
  return fx + fz <= 1 ? a + fx * (b - a) + fz * (c - a)
    : d + (1 - fz) * (b - d) + (1 - fx) * (c - d);
}

function uniqueSorted(values: number[]): number[] {
  return values.sort((a, b) => a - b).filter((value, i, list) => !i || value - list[i - 1] > 1e-8);
}

/** All breaks in the bilinear DEM and in the rendered piecewise-planar edge. */
function edgeStops(t: Terrain, a: PointXZ, b: PointXZ, segments: number, maxStep = Infinity): number[] {
  const stops = [0, 1], delta = { x: b.x - a.x, z: b.z - a.z };
  const crossings = (start: number, end: number, spacing: number, offset: number) => {
    if (Math.abs(end - start) < 1e-10) return;
    const lo = Math.ceil((Math.min(start, end) + offset) / spacing);
    const hi = Math.floor((Math.max(start, end) + offset) / spacing);
    for (let i = lo; i <= hi; i++) {
      const u = (i * spacing - offset - start) / (end - start);
      if (u > 1e-8 && u < 1 - 1e-8) stops.push(u);
    }
  };
  for (const spacing of new Set([t.step, t.size / segments])) {
    crossings(a.x, b.x, spacing, t.size / 2);
    crossings(a.z, b.z, spacing, t.size / 2);
  }
  // Each rendered cell's diagonal has gx + gz = an integer.
  crossings(a.x + a.z, b.x + b.z, t.size / segments, t.size);
  const divisions = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / maxStep));
  for (let i = 1; i < divisions; i++) stops.push(i / divisions);
  return uniqueSorted(stops);
}

/** Exact extrema for these two interpolants over a rotated rectangular footprint. */
export function footprintHeightRange(t: Terrain, b: Pick<Building, 'x' | 'z' | 'w' | 'd' | 'rot'>,
  segments = t.n - 1): { min: number; max: number } {
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
    .map(([sx, sz]) => buildingPoint(b, sx * b.w / 2, sz * b.d / 2));
  let min = Infinity, max = -Infinity;
  const sample = (p: PointXZ) => {
    const measured = t.heightAt(p.x, p.z), rendered = renderedGroundHeight(t, p.x, p.z, segments);
    min = Math.min(min, measured, rendered); max = Math.max(max, measured, rendered);
    return measured;
  };
  // Bilinear patches have no strict interior extremum; grid vertices and edge
  // stationary points suffice. The rendered triangles are affine.
  for (let e = 0; e < 4; e++) {
    const a = corners[e], b = corners[(e + 1) % 4], stops = edgeStops(t, a, b, segments);
    const at = (u: number) => ({ x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u });
    for (let i = 0; i < stops.length - 1; i++) {
      const lo = stops[i], hi = stops[i + 1];
      const h0 = sample(at(lo)), h1 = sample(at(hi)), hm = sample(at((lo + hi) / 2));
      const quadratic = 2 * (h0 + h1 - 2 * hm), linear = h1 - h0 - quadratic;
      if (Math.abs(quadratic) > 1e-10) {
        const u = -linear / (2 * quadratic);
        if (u > 0 && u < 1) sample(at(lo + u * (hi - lo)));
      }
    }
  }
  const minX = Math.min(...corners.map(p => p.x)), maxX = Math.max(...corners.map(p => p.x));
  const minZ = Math.min(...corners.map(p => p.z)), maxZ = Math.max(...corners.map(p => p.z));
  const c = Math.cos(b.rot), s = Math.sin(b.rot);
  for (const spacing of new Set([t.step, t.size / segments])) {
    for (let iz = Math.ceil((minZ + t.size / 2) / spacing); iz <= Math.floor((maxZ + t.size / 2) / spacing); iz++) {
      for (let ix = Math.ceil((minX + t.size / 2) / spacing); ix <= Math.floor((maxX + t.size / 2) / spacing); ix++) {
        const p = { x: ix * spacing - t.size / 2, z: iz * spacing - t.size / 2 };
        const dx = p.x - b.x, dz = p.z - b.z;
        if (Math.abs(dx * c - dz * s) <= b.w / 2 + 1e-8 && Math.abs(dx * s + dz * c) <= b.d / 2 + 1e-8) sample(p);
      }
    }
  }
  return { min, max };
}

/** Monotone convex hull, used only for the existing mesh's lower wall vertices. */
export function convexFootprint(points: readonly PointXZ[]): PointXZ[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.z - b.z)
    .filter((p, i, list) => !i || Math.hypot(p.x - list[i - 1].x, p.z - list[i - 1].z) > 1e-7);
  const cross = (a: PointXZ, b: PointXZ, c: PointXZ) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const half = (list: PointXZ[]) => {
    const out: PointXZ[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 1e-9) out.pop();
      out.push({ ...p });
    }
    return out.slice(0, -1);
  };
  return sorted.length < 3 ? sorted : [...half(sorted), ...half([...sorted].reverse())];
}

/** Keep the original lot and height as upper limits; never distort any axis. */
export function placeVillageHouses(t: Terrain, lots: readonly Building[], shapes: readonly (HouseShape | undefined)[],
  segments = t.n - 1): PlacedHouse[] {
  if (!Number.isInteger(segments) || segments < 1) throw Error('Invalid ground segment count');
  return lots.flatMap(lot => {
    const shape = shapes[lot.variant];
    if (!shape) return [];
    const { min, max } = shape.bounds, size = max.map((v, i) => v - min[i]);
    if (size.length !== 3 || size.some(v => !Number.isFinite(v) || v <= 0)) throw Error('Invalid house bounds');
    const scale = Math.min(lot.w / size[0], lot.h / size[1], lot.d / size[2]);
    if (!Number.isFinite(scale) || scale <= 0) throw Error('Invalid house lot');
    const plan = { ...lot, w: size[0] * scale, h: size[1] * scale, d: size[2] * scale };
    // Keep the +Z facade on the same street edge. The smaller footprint remains
    // entirely inside its original lot, including after rotation.
    Object.assign(plan, buildingPoint(lot, 0, (lot.d - plan.d) / 2));
    const range = footprintHeightRange(t, plan, segments);
    plan.y = range.max + FLOOR_CLEARANCE;
    plan.foundation = plan.y - range.min + FOUNDATION_EMBED;
    const sourceOffset = { x: -(min[0] + max[0]) / 2, y: -min[1], z: -(min[2] + max[2]) / 2 };
    const raw = shape.footprint && shape.footprint.length >= 3 ? shape.footprint
      : [{ x: min[0], z: min[2] }, { x: max[0], z: min[2] }, { x: max[0], z: max[2] }, { x: min[0], z: max[2] }];
    const outline = convexFootprint(raw.map(p => ({
      x: Math.max(-plan.w / 2, Math.min(plan.w / 2, (p.x + sourceOffset.x) * scale)) * .985,
      z: Math.max(-plan.d / 2, Math.min(plan.d / 2, (p.z + sourceOffset.z) * scale)) * .985,
    })));
    if (outline.length < 3) throw Error('Degenerate house footprint');
    return [{ plan, scale, sourceOffset, outline }];
  });
}

export function houseObstacle({ plan }: PlacedHouse): Obstacle {
  return { x: plan.x, z: plan.z, hx: plan.w / 2 + .35, hz: plan.d / 2 + .35,
    rot: plan.rot, bottom: plan.y - plan.foundation, top: plan.y + plan.h };
}

export type FoundationRingPoint = PointXZ & { bottom: number; measured: number; rendered: number; u: number };
export function foundationRing(t: Terrain, house: PlacedHouse, segments = t.n - 1): FoundationRingPoint[] {
  const world = house.outline.map(p => buildingPoint(house.plan, p.x, p.z));
  const out: FoundationRingPoint[] = [];
  let distance = 0;
  for (let edge = 0; edge < world.length; edge++) {
    const a = world[edge], b = world[(edge + 1) % world.length], length = Math.hypot(b.x - a.x, b.z - a.z);
    for (const u of edgeStops(t, a, b, segments, 1.5).slice(0, -1)) {
      const x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u;
      const measured = t.heightAt(x, z), rendered = renderedGroundHeight(t, x, z, segments);
      out.push({ x, z, bottom: Math.min(measured, rendered) - FOUNDATION_EMBED, measured, rendered,
        u: (distance + length * u) / FOUNDATION_TILE_METRES });
    }
    distance += length;
  }
  return out;
}

/** One merged skirt, not hundreds of individual rocks or a raised smooth box. */
export function foundationMeshData(t: Terrain, houses: readonly PlacedHouse[], segments = t.n - 1) {
  const positions: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = [];
  let exposedMin = Infinity, exposedMax = 0;
  const vertex = (x: number, y: number, z: number, u: number, v: number, light: number) => {
    const i = positions.length / 3; positions.push(x, y, z); uvs.push(u, v); colors.push(light, light, light); return i;
  };
  houses.forEach((house, houseIndex) => {
    const ring = foundationRing(t, house, segments), top = house.plan.y + .012;
    const center = ring.reduce((sum, p) => ({ x: sum.x + p.x / ring.length, z: sum.z + p.z / ring.length }), { x: 0, z: 0 });
    const tone = .94 + (houseIndex % 5) * .015;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      const uEnd = i + 1 < ring.length ? b.u : a.u + Math.hypot(b.x - a.x, b.z - a.z) / FOUNDATION_TILE_METRES;
      const ia = vertex(a.x, top, a.z, a.u, top / FOUNDATION_TILE_METRES, tone);
      const ib = vertex(a.x, a.bottom, a.z, a.u, a.bottom / FOUNDATION_TILE_METRES, tone * .86);
      const ic = vertex(b.x, top, b.z, uEnd, top / FOUNDATION_TILE_METRES, tone);
      const id = vertex(b.x, b.bottom, b.z, uEnd, b.bottom / FOUNDATION_TILE_METRES, tone * .86);
      // CCW XZ outline: these normals face away from the house.
      indices.push(ia, ic, ib, ic, id, ib);
      const ca = vertex(center.x, top, center.z, center.x / FOUNDATION_TILE_METRES, -center.z / FOUNDATION_TILE_METRES, tone);
      const cb = vertex(b.x, top, b.z, b.x / FOUNDATION_TILE_METRES, -b.z / FOUNDATION_TILE_METRES, tone);
      const cc = vertex(a.x, top, a.z, a.x / FOUNDATION_TILE_METRES, -a.z / FOUNDATION_TILE_METRES, tone);
      indices.push(ca, cb, cc);
      exposedMin = Math.min(exposedMin, top - a.rendered);
      exposedMax = Math.max(exposedMax, top - a.rendered);
    }
  });
  return { positions: new Float32Array(positions), uvs: new Float32Array(uvs), colors: new Float32Array(colors),
    indices, exposedMin: houses.length ? exposedMin : 0, exposedMax };
}
