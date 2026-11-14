import type { BufferGeometry } from 'three/webgpu';

/** Settle the disconnected stones of the reviewed basalt cluster, not arbitrary scenery.
 * sceneryMesh() has already made a private geometry and baked its source transform.
 * UV seams duplicate vertices: weld positions only for finding connectivity, while
 * retaining every original vertex/index/normal/UV. Each island moves rigidly in Y. */
export function settleRockIslands(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position'), index = geometry.index;
  if (!position || position.itemSize !== 3 || position.count < 3) throw new Error('Rock geometry needs positions');
  const count = position.count, parent = Array.from({ length: count }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  const join = (a: number, b: number) => { parent[find(b)] = find(a); };
  const weld = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const p = [position.getX(i), position.getY(i), position.getZ(i)];
    if (!p.every(Number.isFinite)) throw new Error('Rock geometry has a non-finite vertex');
    const key = p.map(v => Math.round(v * 1e5)).join(','); // 10 micrometres, below visible geometry precision.
    const other = weld.get(key);
    if (other !== undefined) join(i, other); else weld.set(key, i);
  }
  const triangles = index?.count ?? count;
  if (triangles % 3) throw new Error('Rock geometry needs triangle topology');
  for (let i = 0; i < triangles; i += 3) {
    const ids = [0, 1, 2].map(k => index ? index.getX(i + k) : i + k);
    if (ids.some(v => !Number.isInteger(v) || v < 0 || v >= count)) throw new Error('Rock geometry has an invalid index');
    join(ids[0], ids[1]); join(ids[0], ids[2]);
  }
  const bottoms = new Map<number, number>();
  for (let i = 0; i < count; i++) {
    const key = find(i); bottoms.set(key, Math.min(bottoms.get(key) ?? Infinity, position.getY(i)));
  }
  let maxShift = 0;
  for (let i = 0; i < count; i++) {
    const bottom = bottoms.get(find(i))!;
    position.setY(i, position.getY(i) - bottom); maxShift = Math.max(maxShift, Math.abs(bottom));
  }
  position.needsUpdate = true;
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const evidence = { revision: 'rock-islands-r15', islands: bottoms.size, maxShift };
  geometry.userData.grounding = evidence;
  return evidence;
}
