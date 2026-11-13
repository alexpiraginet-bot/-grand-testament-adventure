// R13 local artistic dressing. No claim of an excavated reconstruction.
import type { Terrain } from './terrain.ts';
import { buildingPoint, type Building, type Segment } from './world-layout.ts';
import { placeVillageHouses, type HouseShape, type PlacedHouse } from './village-house-placement.ts';

export const FACADE_SAMPLE_METRES = 100;
export const FACADE_SAMPLE_REACH = 4.7;
export const HOUSE_B_FRONT_YAW = -Math.PI / 2;
export type FacadeHouse = PlacedHouse & { sample: boolean; correctedFront: boolean; lotIndex: number };

/** Select the street frontage, not the second row or the rest of the map. */
export function inFacadeSample(lot: Building, routes: readonly Segment[]): boolean {
  const front = buildingPoint(lot, 0, lot.d / 2);
  let travelled = 0, closest = Infinity, at = Infinity;
  for (const s of routes) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;
    const u = ((front.x - s.ax) * dx + (front.z - s.az) * dz) / (length * length);
    const clamped = Math.max(0, Math.min(1, u));
    const distance = Math.hypot(front.x - s.ax - dx * clamped, front.z - s.az - dz * clamped);
    if (distance < closest) { closest = distance; at = travelled + u * length; }
    travelled += length;
  }
  return at >= 0 && at <= FACADE_SAMPLE_METRES && closest <= FACADE_SAMPLE_REACH;
}

/** The source B's real entrance is +X. Rotate its bounds/footprint without mutating source data. */
export function frontFacingHouseB(shape: HouseShape): HouseShape {
  const { min, max } = shape.bounds;
  return { bounds: { min: [-max[2], min[1], min[0]], max: [-min[2], max[1], max[0]] },
    footprint: shape.footprint?.map(p => ({ x: -p.z, z: p.x })) };
}

function overlap(a: Building, b: Building, gap = .7): boolean {
  const basis = (p: Building) => [[Math.cos(p.rot), -Math.sin(p.rot)], [Math.sin(p.rot), Math.cos(p.rot)]];
  const aa = basis(a), bb = basis(b);
  const radius = (axis: number[], axes: number[][], p: Building) =>
    Math.abs(axis[0] * axes[0][0] + axis[1] * axes[0][1]) * p.w / 2 +
    Math.abs(axis[0] * axes[1][0] + axis[1] * axes[1][1]) * p.d / 2;
  return [...aa, ...bb].every(axis => Math.abs((a.x - b.x) * axis[0] + (a.z - b.z) * axis[1]) <
    radius(axis, aa, a) + radius(axis, bb, b) + gap);
}

function intersectsRoute(p: Building, route: Segment): boolean {
  const c = Math.cos(p.rot), s = Math.sin(p.rot);
  const local = (x: number, z: number) => [(x - p.x) * c - (z - p.z) * s, (x - p.x) * s + (z - p.z) * c];
  const a = local(route.ax, route.az), b = local(route.bx, route.bz);
  const half = [p.w / 2 + route.r + .35, p.d / 2 + route.r + .35];
  let lo = 0, hi = 1;
  for (let axis = 0; axis < 2; axis++) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-10) { if (Math.abs(a[axis]) > half[axis]) return false; continue; }
    const t0 = (-half[axis] - a[axis]) / delta, t1 = (half[axis] - a[axis]) / delta;
    lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1));
    if (lo > hi) return false;
  }
  return true;
}

/** Preserve height and street edge when rotating B. Extend backwards only into verified empty ground. */
export function facadeHousePlacements(t: Terrain, lots: readonly Building[], shapes: readonly (HouseShape | undefined)[],
  routes: readonly Segment[], groundSegments: number): FacadeHouse[] {
  const output: FacadeHouse[] = [], b = shapes[1] && frontFacingHouseB(shapes[1]);
  for (let lotIndex = 0; lotIndex < lots.length; lotIndex++) {
    const lot = lots[lotIndex], base = placeVillageHouses(t, [lot], [...shapes], groundSegments)[0];
    if (!base) continue;
    const sample = inFacadeSample(lot, routes);
    let placed = base, correctedFront = false;
    if (sample && lot.variant === 1 && b) {
      const size = b.bounds.max.map((value, axis) => value - b.bounds.min[axis]);
      const depth = size[2] * base.scale, width = size[0] * base.scale;
      const candidateLot = { ...lot, ...buildingPoint(lot, 0, (lot.d - depth) / 2),
        w: width, d: depth, h: base.plan.h, variant: 0 };
      const candidate = placeVillageHouses(t, [candidateLot], [b], groundSegments)[0];
      candidate.plan.variant = 1;
      // Test all original neighbours, plus previous corrections, rather than hoping a rear extension fits.
      const free = !lots.some((other, i) => i !== lotIndex && overlap(candidate.plan, other)) &&
        !output.some(other => overlap(candidate.plan, other.plan)) && !routes.some(route => intersectsRoute(candidate.plan, route));
      const cornersDry = [-1, 1].every(x => [-1, 1].every(z => {
        const p = buildingPoint(candidate.plan, x * width / 2, z * depth / 2);
        return t.heightAt(p.x, p.z) > .05;
      }));
      if (free && cornersDry) { placed = candidate; correctedFront = true; }
    }
    output.push({ ...placed, sample, correctedFront, lotIndex });
  }
  return output;
}
