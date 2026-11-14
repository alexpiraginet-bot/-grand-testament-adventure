// Static terrestrial props only. Boats and the cast net retain their water placement.
import type { Terrain } from './terrain.ts';
import { footprintHeightRange, type HouseBounds } from './village-house-placement.ts';

export type GroundPropPose = { x: number; z: number; rot: number; sx: number; sy: number; sz: number };
export type GroundPropSupport = {
  y: number; bottom: number; top: number; min: number; max: number;
  x: number; z: number; hx: number; hz: number; rot: number;
};

/** Use the rendered triangles and the actual source bounds, including an off-centre pivot.
 * A rigid prop cannot follow a steep/non-planar surface. Omit that placement instead
 * of sinking most of the object or leaving its entire base above the downhill edge.
 * Bounds establish a contact envelope, not exact contact of every irregular vertex. */
export function supportGroundProp(t: Terrain, bounds: HouseBounds, pose: GroundPropPose,
  segments: number): GroundPropSupport | null {
  const { x, z, rot, sx, sy, sz } = pose;
  if (![x, z, rot, sx, sy, sz, segments, ...bounds.min, ...bounds.max].every(Number.isFinite) ||
    sx <= 0 || sy <= 0 || sz <= 0 || !Number.isInteger(segments) || segments < 1 ||
    bounds.min.length !== 3 || bounds.max.length !== 3 || bounds.max.some((v, i) => v <= bounds.min[i])) {
    throw new RangeError('Invalid ground prop bounds, pose or rendered grid');
  }
  const w = (bounds.max[0] - bounds.min[0]) * sx, d = (bounds.max[2] - bounds.min[2]) * sz;
  const height = (bounds.max[1] - bounds.min[1]) * sy;
  const cx = (bounds.min[0] + bounds.max[0]) * sx / 2, cz = (bounds.min[2] + bounds.max[2]) * sz / 2;
  const c = Math.cos(rot), s = Math.sin(rot), center = { x: x + cx * c + cz * s, z: z - cx * s + cz * c };
  // Match Three's positive Y rotation; do not silently clamp props outside the DEM.
  for (const dx of [-w / 2, w / 2]) for (const dz of [-d / 2, d / 2]) {
    if (!t.inside(center.x + dx * c + dz * s, center.z - dx * s + dz * c)) return null;
  }
  const range = footprintHeightRange(t, { ...center, w, d, rot }, segments, 'rendered');
  const embed = Math.min(.015, height * .03), reliefLimit = Math.min(.12, height * .22);
  if (range.max - range.min > reliefLimit) return null;
  const bottom = range.min - embed;
  return { ...center, rot, hx: w / 2, hz: d / 2, ...range,
    y: bottom - bounds.min[1] * sy, bottom, top: bottom + height };
}
