import type { Terrain } from './terrain.ts';
import { footprintHeightRange, type HouseBounds } from './village-house-placement.ts';

export type CastNetWaterPose = { x: number; z: number; rot: number; sx?: number; sy?: number; sz?: number };
export type CastNetWaterOptions = { rootY: number; waterY?: number; maxRadius?: number; clearance?: number };
export const CAST_NET_WATER_SEARCH = Object.freeze({ maxRadius: 12, radialStep: .25, angles: 96, grids: [192, 256] as const });

/** Nearest successful candidate in a finite radial search, not an exact continuous optimum.
 * Both actual terrain meshes must sit below the lowest world-space strand/weight
 * over the entire rotated footprint. No geometry mutation and no dry-land fallback. */
export function findCastNetWaterPlacement(t: Terrain, bounds: HouseBounds, pose: CastNetWaterPose, options: CastNetWaterOptions) {
  const { x, z, rot, sx = 1, sy = 1, sz = 1 } = pose;
  const { rootY, waterY = 0, maxRadius = 12, clearance = .015 } = options;
  if (bounds.min.length !== 3 || bounds.max.length !== 3 ||
    ![x, z, rot, sx, sy, sz, rootY, waterY, maxRadius, clearance, ...bounds.min, ...bounds.max].every(Number.isFinite) ||
    sx <= 0 || sy <= 0 || sz <= 0 || maxRadius < 0 || maxRadius > CAST_NET_WATER_SEARCH.maxRadius || clearance < 0 ||
    bounds.max[0] <= bounds.min[0] || bounds.max[2] <= bounds.min[2] || bounds.max[1] < bounds.min[1]) {
    throw new RangeError('Invalid cast net water search bounds, pose or limits');
  }
  const w = (bounds.max[0] - bounds.min[0]) * sx, d = (bounds.max[2] - bounds.min[2]) * sz;
  const ox = (bounds.min[0] + bounds.max[0]) * sx / 2, oz = (bounds.min[2] + bounds.max[2]) * sz / 2;
  const c = Math.cos(rot), s = Math.sin(rot);
  const requiredMaxGroundHeight = Math.min(waterY, rootY + bounds.min[1] * sy) - clearance;
  const radii = [0];
  for (let r = CAST_NET_WATER_SEARCH.radialStep; r < maxRadius; r += CAST_NET_WATER_SEARCH.radialStep) radii.push(r);
  if (maxRadius > 0) radii.push(maxRadius);
  let testedCandidates = 0;
  for (const radius of radii) {
    const count = radius === 0 ? 1 : CAST_NET_WATER_SEARCH.angles;
    for (let k = 0; k < count; k++) {
      testedCandidates++;
      const angle = k * Math.PI * 2 / count, px = x + radius * Math.cos(angle), pz = z + radius * Math.sin(angle);
      const center = { x: px + ox * c + oz * s, z: pz - ox * s + oz * c };
      const inside = [-1, 1].every(ix => [-1, 1].every(iz =>
        t.inside(center.x + ix * w / 2 * c + iz * d / 2 * s, center.z - ix * w / 2 * s + iz * d / 2 * c)));
      if (!inside) continue;
      const ranges = CAST_NET_WATER_SEARCH.grids.map(segments => ({ segments,
        ...footprintHeightRange(t, { ...center, w, d, rot }, segments, 'rendered') }));
      if (ranges.some(range => range.max > requiredMaxGroundHeight)) continue;
      return { x: px, y: rootY, z: pz, rot, distance: radius, requiredMaxGroundHeight, ranges, testedCandidates };
    }
  }
  return null;
}
