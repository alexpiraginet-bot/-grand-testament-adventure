import type { BufferGeometry } from 'three/webgpu';

/** main.ts positions the returned mesh at this Y; the private geometry carries
 * the compensating offset so its cloth surface, not one hanging weight, meets water. */
export const CAST_NET_ROOT_Y = .07;

/** Rest the reviewed horizontal net on mean lake level without flattening its folds.
 * The median is robust to a few hanging weights/strands below the main cloth.
 * This is a static resting pose, not a simulation of throwing or floating a net. */
export function restCastNetOnWater(geometry: BufferGeometry, rootY = CAST_NET_ROOT_Y, waterY = 0) {
  const position = geometry.getAttribute('position');
  if (!position || position.itemSize !== 3 || position.count < 3 || !Number.isFinite(rootY + waterY)) {
    throw new RangeError('Invalid cast net geometry or waterline');
  }
  const heights: number[] = [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    if (![x, y, z].every(Number.isFinite)) throw new RangeError('Cast net has a non-finite vertex');
    heights.push(y); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  heights.sort((a, b) => a - b);
  const spanY = heights[heights.length - 1] - heights[0], shortSide = Math.min(maxX - minX, maxZ - minZ);
  if (shortSide <= 0 || spanY > .5 || spanY > shortSide * .3) {
    throw new RangeError('Cast net is not a reviewed horizontal resting mesh');
  }
  const middle = Math.floor(heights.length / 2);
  const median = heights.length % 2 ? heights[middle] : (heights[middle - 1] + heights[middle]) / 2;
  const shiftY = waterY - rootY - median;
  for (let i = 0; i < position.count; i++) position.setY(i, position.getY(i) + shiftY);
  position.needsUpdate = true;
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const contact = { revision: 'cast-net-resting-r15', rootY, waterY, sourceMedianY: median, shiftY,
    worldMinY: heights[0] + shiftY + rootY,
    worldMaxY: heights[heights.length - 1] + shiftY + rootY,
    worldP10Y: heights[Math.floor((heights.length - 1) * .1)] + shiftY + rootY,
    worldP90Y: heights[Math.floor((heights.length - 1) * .9)] + shiftY + rootY };
  geometry.userData.castNetContact = contact;
  return contact;
}
