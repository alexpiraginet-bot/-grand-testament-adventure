import * as THREE from 'three/webgpu';
import type { Terrain } from './terrain.ts';
import { buildingPoint, distanceToSegment, insideObstacle, type Obstacle, type Segment } from './world-layout.ts';
import { footprintHeightRange, renderedGroundHeight } from './village-house-placement.ts';
import type { FacadeHouse } from './village-facade-layout.ts';

export type FacadeWood = { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture };
export type FacadeProps = { net?: THREE.Mesh; rocks?: THREE.Mesh };
type V3 = { x: number; y: number; z: number };
type Prop = { x: number; y: number; z: number; rot: number; scale: number };
export const FACADE_DETAIL_LIMITS = { batches: 3, pathMargin: .45, postRadius: .1, textureTileMetres: .5 } as const;

/** Bevelled, gently tapered timber. Real dimensions drive UV density; no stretched atlas. */
class TimberGeometry {
  positions: number[] = []; uvs: number[] = []; colors: number[] = [];
  pieces = 0;
  add(a: V3, b: V3, width: number, depth: number, color: THREE.Color, phase: number, facadeDepth: THREE.Vector3) {
    const start = new THREE.Vector3(a.x, a.y, a.z), end = new THREE.Vector3(b.x, b.y, b.z);
    const length = start.distanceTo(end); if (length < .001) return;
    const yAxis = end.clone().sub(start).normalize();
    // A direction alone leaves roll unconstrained. Keep the cross section in the
    // house's facade frame: otherwise a 90° house shows the thin edge of every plank.
    const zAxis = facadeDepth.clone().addScaledVector(yAxis, -facadeDepth.dot(yAxis));
    if (zAxis.lengthSq() < 1e-8) zAxis.set(0, 1, 0).addScaledVector(yAxis, -yAxis.y);
    zAxis.normalize();
    const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
    const frame = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    const bevel = Math.min(width, depth) * .12, w = width / 2, d = depth / 2;
    const cross = [[-w + bevel, -d], [w - bevel, -d], [w, -d + bevel], [w, d - bevel],
      [w - bevel, d], [-w + bevel, d], [-w, d - bevel], [-w, -d + bevel]];
    const point = (i: number, j: number) => {
      const [x, z] = cross[i], taper = 1 + .012 * Math.sin(phase + j * 1.8);
      return new THREE.Vector3(x * taper, length * j / 2, z * taper).applyMatrix4(frame).add(start);
    };
    const triangle = (points: THREE.Vector3[], uv: number[][]) => [0, 2, 1].forEach(i => {
      const p = points[i]; this.positions.push(p.x, p.y, p.z); this.uvs.push(uv[i][0], uv[i][1]); this.colors.push(color.r, color.g, color.b);
    });
    let perimeter = 0;
    for (let i = 0; i < 8; i++) {
      const next = (i + 1) % 8, face = Math.hypot(cross[next][0] - cross[i][0], cross[next][1] - cross[i][1]);
      const u = perimeter / .5 + phase * .137, v = (perimeter + face) / .5 + phase * .137;
      for (let j = 0; j < 2; j++) {
        const lo = j * length, hi = (j + 1) * length;
        // Traversal is counterclockwise when viewed from outside.
        triangle([point(i, j), point(next, j), point(i, j + 1)], [[u, lo], [v, lo], [u, hi]]);
        triangle([point(next, j), point(next, j + 1), point(i, j + 1)], [[v, lo], [v, hi], [u, hi]]);
      }
      perimeter += face;
    }
    for (let i = 1; i < 7; i++) {
      triangle([point(0, 0), point(i + 1, 0), point(i, 0)], [[0, 0], [.3, .3], [.3, 0]]);
      triangle([point(0, 2), point(i, 2), point(i + 1, 2)], [[0, 0], [.3, 0], [.3, .3]]);
    }
    this.pieces++;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
  }
}

/** Only source-backed props and fully textured architecture; missing wood means no synthetic dressing. */
export function villageDetailsR13(t: Terrain, houses: readonly FacadeHouse[], routes: readonly Segment[],
  buildingBoxes: readonly Obstacle[], wood: FacadeWood | undefined, props: FacadeProps = {}, groundSegments = t.n - 1) {
  const group = new THREE.Group(); group.name = 'facade-detail-r13';
  const boxes: Obstacle[] = [], timber = new TimberGeometry(), nets: Prop[] = [], rocks: Prop[] = [];
  const counts = { doors: 0, porches: 0, timberPieces: 0, nets: 0, rocks: 0, batches: 0 };
  if (!wood) { props.net?.geometry.dispose(); props.rocks?.geometry.dispose(); return { group, boxes, counts }; }
  const foot = (x: number, z: number) => renderedGroundHeight(t, x, z, groundSegments);
  const safe = (x: number, z: number, radius: number, own: number) => t.heightAt(x, z) > .06 &&
    routes.every(s => distanceToSegment(x, z, s) >= s.r + radius + FACADE_DETAIL_LIMITS.pathMargin) &&
    buildingBoxes.every((b, i) => i === own || !insideObstacle(x, z, b, radius + .1)) &&
    boxes.every(b => !insideObstacle(x, z, b, radius + .08));
  const timberColor = new THREE.Color();
  for (let index = 0; index < houses.length; index++) {
    const house = houses[index]; if (!house.sample || house.plan.variant === 1 && !house.correctedFront) continue;
    const p = house.plan, scale = house.scale, variant = p.variant;
    // Landmarks measured on the source meshes, after B's +X entrance turns towards +Z.
    const doorX = (variant === 2 ? 1.03 : 0) * scale;
    const doorWidth = Math.max(.82, (variant === 1 ? .80 : .94) * scale);
    const doorHeight = Math.min(p.h - .32, Math.max(1.80, (variant === 1 ? 1.67 : 1.62) * scale));
    // Source bounds include deep eaves. CPU ray probes at the jamb, not bbox.max.z,
    // locate the wall so a door cannot float 0.7m in front of house A.
    const front = p.d / 2, doorZ = [1.70, 3.69, 1.59][variant] * scale, bottom = p.y + .08 * scale;
    const at = (x: number, y: number, z: number): V3 => ({ ...buildingPoint(p, x, z), y });
    const facadeDepth = new THREE.Vector3(Math.sin(p.rot), 0, Math.cos(p.rot));
    let piece = 0;
    const beam = (a: V3, b: V3, w: number, d: number, brightness = 1) => {
      timberColor.setRGB(brightness, brightness * .97, brightness * .92);
      timber.add(a, b, w, d, timberColor, house.lotIndex * 4.17 + piece++, facadeDepth);
    };
    // Closed infill matches the existing blocked interior. No visible opening into an invisible wall.
    // Continuous backing closes the tiny bevel/seam gaps without another material/draw call.
    beam(at(doorX, bottom, doorZ - .025), at(doorX, bottom + doorHeight, doorZ - .025), doorWidth + .04, .018, .65);
    const planks = 5, plankW = doorWidth / planks;
    for (let n = 0; n < planks; n++) {
      const x = doorX - doorWidth / 2 + (n + .5) * plankW;
      beam(at(x, bottom, doorZ), at(x, bottom + doorHeight, doorZ), plankW - .004, .065, .68 + (n % 3) * .035);
    }
    for (const side of [-1, 1]) beam(at(doorX + side * (doorWidth / 2 + .065), bottom - .03, doorZ + .01),
      at(doorX + side * (doorWidth / 2 + .065), bottom + doorHeight + .13, doorZ + .01), .13, .15, .78);
    beam(at(doorX - doorWidth / 2 - .16, bottom + doorHeight + .095, doorZ + .01),
      at(doorX + doorWidth / 2 + .16, bottom + doorHeight + .095, doorZ + .01), .16, .17, .79);
    // Low, visibly grounded wooden sill. It stays inside the already-blocked house footprint.
    beam(at(doorX - doorWidth / 2 - .13, bottom, doorZ + .06),
      at(doorX + doorWidth / 2 + .13, bottom, doorZ + .06), .15, .22, .76);
    for (const height of [.36, 1.12]) beam(at(doorX - doorWidth * .42, bottom + height * scale, doorZ + .065),
      at(doorX + doorWidth * .42, bottom + height * scale, doorZ + .065), .065, .045, .62);
    counts.doors++;

    const porchWidth = Math.min(p.w * .69, Math.max(2.05, doorWidth + 1.2));
    const porchX = Math.max(-p.w / 2 + porchWidth / 2 + .12, Math.min(p.w / 2 - porchWidth / 2 - .12, doorX));
    const frontPoint = buildingPoint(p, porchX, front);
    const room = Math.min(...routes.map(s => distanceToSegment(frontPoint.x, frontPoint.z, s) - s.r));
    const depth = Math.min(.95, room - .69), top = Math.max(bottom + doorHeight + .3, p.y + 2.1);
    const posts = [-1, 1].map(side => buildingPoint(p, porchX + side * porchWidth / 2, front + depth));
    if (depth < .45 || top > p.y + p.h - .12 || !posts.every(q => safe(q.x, q.z, .10, index))) continue;
    for (const q of posts) {
      const y = foot(q.x, q.z);
      beam({ ...q, y: y - .04 }, { ...q, y: top }, .115, .115, .85);
      boxes.push({ ...q, hx: .075, hz: .075, rot: p.rot, bottom: y - .04, top: top + .08 });
    }
    beam(at(porchX - porchWidth / 2 - .08, top, front + depth), at(porchX + porchWidth / 2 + .08, top, front + depth), .12, .14, .82);
    beam(at(porchX - porchWidth / 2 - .08, top + .14, doorZ - .10), at(porchX + porchWidth / 2 + .08, top + .14, doorZ - .10), .12, .14, .78);
    const strips = Math.ceil(porchWidth / .15);
    for (let i = 0; i <= strips; i++) {
      const x = porchX - porchWidth / 2 + i * porchWidth / strips;
      beam(at(x, top + .21, doorZ - .19), at(x, top + .07, front + depth + .12), .105, .045, .95 + (i % 3) * .035);
    }
    counts.porches++;

    // Existing Tripo fishing net; a few deliberate work corners rather than a global clutter scatter.
    if (props.net && house.lotIndex % 3 !== 1) {
      const side = doorX > 0 ? -1 : 1, q = buildingPoint(p, side * p.w * .30, front + .62), s = .65;
      if (safe(q.x, q.z, .55, index)) {
        const y = foot(q.x, q.z); nets.push({ ...q, y: y - .025, rot: p.rot + .16, scale: s });
        boxes.push({ ...q, hx: .75 * s, hz: .5 * s, rot: p.rot + .16, bottom: y - .025, top: y + .3 * s });
      }
    }
    if (props.rocks) {
      const q = buildingPoint(p, (house.lotIndex % 2 ? -1 : 1) * (p.w / 2 + .34), front - .35), s = .21;
      if (safe(q.x, q.z, .39, index)) {
        const range = footprintHeightRange(t, { ...q, w: 3 * s, d: 2 * s, rot: p.rot }, groundSegments);
        if (range.max - range.min < .13) {
          rocks.push({ ...q, y: range.min - .035, rot: p.rot, scale: s });
          boxes.push({ ...q, hx: 1.5 * s, hz: s, rot: p.rot, bottom: range.min - .035, top: range.min + 1.2 * s });
        }
      }
    }
  }
  if (timber.pieces) {
    const material = new THREE.MeshStandardMaterial({ ...wood, color: 0xffffff, vertexColors: true,
      roughness: 1, metalness: 0, normalScale: new THREE.Vector2(.55, .55) });
    const mesh = new THREE.Mesh(timber.build(), material); mesh.name = 'textured-handhewn-doors-and-porches';
    mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); counts.batches++;
  }
  const batch = (model: THREE.Mesh | undefined, list: Prop[], name: string) => {
    if (!model || !list.length) { model?.geometry.dispose(); return; }
    const mesh = new THREE.InstancedMesh(model.geometry, model.material, list.length), o = new THREE.Object3D();
    list.forEach((p, i) => { o.position.set(p.x, p.y, p.z); o.rotation.set(0, p.rot, 0); o.scale.setScalar(p.scale); o.updateMatrix(); mesh.setMatrixAt(i, o.matrix); });
    mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); group.add(mesh); counts.batches++;
  };
  batch(props.net, nets, 'existing-fishing-nets-r13'); batch(props.rocks, rocks, 'existing-foundation-rocks-r13');
  counts.timberPieces = timber.pieces; counts.nets = nets.length; counts.rocks = rocks.length;
  return { group, boxes, counts };
}
