// A provisional rig for a Tripo mesh that came without one (the first heroi.glb, 12/11/2026: no skin, no animations,
// arms in an A pose). It gives the static mesh a skeleton of 11 bones with weights guessed from the geometry, so the
// walk cycle of people.ts can move it. When the rigged export from Tripo arrives, its own skeleton replaces this.
//
// Frame after placement: feet at y = 0, height h, centred on x and z, facing -z (the game's convention), right hand +x.
import * as THREE from "three/webgpu";
import type { Person } from "./people.ts";

export type ModelSpec = {
  altura: number;        // metres, from TRIPO.md
  frente: "+x" | "-x" | "+z" | "-z";   // which way the model faces in its own file (checked in tools/viewer)
};

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** The single mesh of a GLTF scene, with its world transform baked in, oriented and scaled to the game frame. */
export function bakedGeometry(scene: THREE.Object3D, spec: ModelSpec): { geometry: THREE.BufferGeometry; material: THREE.Material } {
  scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  if (meshes.length !== 1) throw new Error(`rig: expected one mesh, found ${meshes.length}`);
  const src = meshes[0];
  // a rigged export keeps its own skeleton: baking it into a static mesh would throw the skin away
  if ((src as THREE.SkinnedMesh).isSkinnedMesh) throw new Error("rig: the file has its own skin; load it with its skeleton, not with bakedGeometry");
  const g = new THREE.BufferGeometry();
  // quantized attributes (KHR_mesh_quantization) go to float before any transform, or they would clamp at +-1
  const fl = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, size: number) => {
    const out = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = a.getComponent(i, k);
    return new THREE.Float32BufferAttribute(out, size);
  };
  const s = src.geometry;
  g.setAttribute("position", fl(s.attributes.position, 3));
  if (s.attributes.normal) g.setAttribute("normal", fl(s.attributes.normal, 3));
  if (s.attributes.uv) g.setAttribute("uv", fl(s.attributes.uv, 2));
  if (s.index) g.setIndex(s.index.clone());
  g.applyMatrix4(src.matrixWorld);
  const turn = { "+x": Math.PI / 2, "-x": -Math.PI / 2, "+z": Math.PI, "-z": 0 }[spec.frente];
  g.rotateY(turn);
  g.computeBoundingBox();
  const b = g.boundingBox!;
  const k = spec.altura / (b.max.y - b.min.y);
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.scale(k, k, k);
  if (g.attributes.normal) g.attributes.normal.needsUpdate = true;
  g.computeBoundingBox(); g.computeBoundingSphere();
  return { geometry: g, material: src.material as THREE.Material };
}

type Joints = { hip: number; knee: number; legX: number; shoulder: THREE.Vector2; hand: THREE.Vector2 };

/** Joint positions from the geometry: hands at the widest points (A pose), shoulders where the torso narrows. */
export function findJoints(g: THREE.BufferGeometry, h: number): Joints {
  const p = g.attributes.position;
  let hand = new THREE.Vector2(0, 0);
  for (let i = 0; i < p.count; i++) { const x = Math.abs(p.getX(i)); if (x > hand.x) hand = new THREE.Vector2(x, p.getY(i)); }
  // torso half width just under the neck: the widest |x| in a band at 79-81% of the height
  let sw = 0;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / h; if (y > 0.79 && y < 0.81) sw = Math.max(sw, Math.abs(p.getX(i))); }
  return { hip: 0.53 * h, knee: 0.28 * h, legX: 0.055 * h, shoulder: new THREE.Vector2(Math.min(sw, 0.13 * h), 0.8 * h), hand };
}

/** Skins the geometry to an 11-bone skeleton and returns it as a Person (legs, arms and body for animate()). */
export function rigPerson(geometry: THREE.BufferGeometry, material: THREE.Material, h: number): Person & { joints: Joints } {
  const J = findJoints(geometry, h);
  const bone = (name: string, x: number, y: number, z: number, parent?: THREE.Bone) => {
    const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z);
    if (parent) { parent.add(b); b.position.sub(parent.getWorldPosition(new THREE.Vector3())); }
    b.updateMatrixWorld(true);
    return b;
  };
  const root = bone("root", 0, 0, 0);
  const hips = bone("hips", 0, J.hip, 0, root);
  const spine = bone("spine", 0, J.hip + 0.08 * h, 0, hips);
  const mid = (a: THREE.Vector2, b: THREE.Vector2) => a.clone().add(b).multiplyScalar(0.5);
  const elbow = mid(J.shoulder, J.hand);
  const upL = bone("upperArmL", -J.shoulder.x, J.shoulder.y, 0, spine), foreL = bone("forearmL", -elbow.x, elbow.y, 0, upL);
  const upR = bone("upperArmR", J.shoulder.x, J.shoulder.y, 0, spine), foreR = bone("forearmR", elbow.x, elbow.y, 0, upR);
  const thL = bone("thighL", -J.legX, J.hip, 0, hips), shL = bone("shinL", -J.legX, J.knee, 0, thL);
  const thR = bone("thighR", J.legX, J.hip, 0, hips), shR = bone("shinR", J.legX, J.knee, 0, thR);
  const bones = [root, hips, spine, upL, foreL, upR, foreR, thL, shL, thR, shR];
  const ix = (b: THREE.Bone) => bones.indexOf(b);

  const p = geometry.attributes.position, n = p.count;
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const S = new THREE.Vector2(), T = new THREE.Vector2(), V = new THREE.Vector2();
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), side = x < 0 ? -1 : 1;
    const w = new Map<number, number>();
    const add = (b: THREE.Bone, v: number) => { if (v > 1e-3) w.set(ix(b), (w.get(ix(b)) ?? 0) + v); };
    // arm: distance to the shoulder-hand segment, on the vertex's side
    S.set(side * J.shoulder.x, J.shoulder.y); T.set(side * J.hand.x, J.hand.y); V.set(x, y);
    const d = T.clone().sub(S), t = Math.max(0, Math.min(1, V.clone().sub(S).dot(d) / d.lengthSq()));
    const dist = V.distanceTo(S.clone().add(d.multiplyScalar(t)));
    const arm = smooth(0.0, 0.1, t) * (1 - smooth(0.06 * h, 0.1 * h, dist)) * smooth(J.shoulder.x * 0.75, J.shoulder.x * 1.05, Math.abs(x));
    const fore = smooth(0.42, 0.58, t);
    add(side < 0 ? upL : upR, arm * (1 - fore));
    add(side < 0 ? foreL : foreR, arm * fore);
    const rest = 1 - arm;
    // legs under the tunic: left/right by x, blending at the middle so the cloth between them stretches
    const leg = 1 - smooth(J.hip - 0.06 * h, J.hip + 0.04 * h, y);
    const r = smooth(-0.05 * h, 0.05 * h, x);
    const shin = 1 - smooth(J.knee - 0.04 * h, J.knee + 0.04 * h, y);
    add(thL, rest * leg * (1 - r) * (1 - shin)); add(shL, rest * leg * (1 - r) * shin);
    add(thR, rest * leg * r * (1 - shin)); add(shR, rest * leg * r * shin);
    add(spine, rest * (1 - leg));
    const top = [...w.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((a, [, v]) => a + v, 0) || 1;
    top.forEach(([b, v], k) => { si[i * 4 + k] = b; sw[i * 4 + k] = v / sum; });
    if (!top.length) { si[i * 4] = ix(spine); sw[i * 4] = 1; }
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));

  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = false;      // the skin moves outside the bind-pose bounds
  mesh.add(root);
  mesh.bind(new THREE.Skeleton(bones));

  const body = new THREE.Group(); body.add(mesh);
  const rootGroup = new THREE.Group(); rootGroup.add(body);
  // the A pose: how far each arm must turn (about z) to hang along the body
  const lower = Math.atan2(J.hand.x - J.shoulder.x, J.shoulder.y - J.hand.y) * 0.85;
  return { root: rootGroup, body, legL: thL, legR: thR, armL: upL, armR: upR, phase: 0, pose: "stand", armRestL: lower, armRestR: -lower, joints: J };
}
