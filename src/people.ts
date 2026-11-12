// People made of simple shapes, standing in for the Tripo meshes until they arrive (see TRIPO.md). No faces are
// modelled: the player is seen from behind, as in the reels, and everyone else is a first-century adult.
import * as THREE from "three/webgpu";

export type Palette = {
  tunic: number; belt: number; hair: number; skin: number; sandal: number;
  mantle?: number;       // a mantle over the left shoulder (the player: terracotta)
  beard?: boolean;
  hairLong?: boolean;    // shoulder-length hair
  height?: number;       // metres
  short?: boolean;       // a short work tunic (to the knee)
};

export const PALETTES: Record<string, Palette> = {
  // the player, as the reels' character sheet: dark wavy shoulder-length hair, off-white wool tunic with a rope belt,
  // terracotta mantle over the left shoulder, leather sandals
  heroi: { tunic: 0xe8e0cc, belt: 0xa98a5a, hair: 0x2a1c13, skin: 0xb3835f, sandal: 0x6b4a2e, mantle: 0xb0533a, hairLong: true, beard: true, height: 1.76 },
  simao: { tunic: 0x5c4331, belt: 0x3d2c20, hair: 0x2b2018, skin: 0xa77654, sandal: 0x5a3e27, beard: true, height: 1.78, short: true },
  andre: { tunic: 0x857256, belt: 0x4a3a28, hair: 0x33241a, skin: 0xb07e5b, sandal: 0x5a3e27, beard: true, height: 1.74, short: true },
  tiago: { tunic: 0x56604a, belt: 0x3a3226, hair: 0x231a14, skin: 0xa97a58, sandal: 0x5a3e27, beard: true, height: 1.77, short: true },
  joao: { tunic: 0x8f5d3e, belt: 0x4b3424, hair: 0x2e2118, skin: 0xb5845f, sandal: 0x5a3e27, beard: true, height: 1.73, short: true },
  zebedeu: { tunic: 0x6b6253, belt: 0x403628, hair: 0x9c968c, skin: 0xa0735a, sandal: 0x5a3e27, beard: true, height: 1.70 },
  empregado: { tunic: 0xa08e6c, belt: 0x5c4a33, hair: 0x2a2018, skin: 0xa37350, sandal: 0x5a3e27, beard: false, height: 1.72, short: true },
};

const mats = new Map<number, THREE.MeshStandardMaterial>();
function mat(color: number, rough = 0.9): THREE.MeshStandardMaterial {
  const key = color * 10 + Math.round(rough * 9);
  let m = mats.get(key);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 }); mats.set(key, m); }
  return m;
}

function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

export type Person = {
  root: THREE.Group;        // placed on the ground; rotation.y = facing
  body: THREE.Group;        // scaled to height, bobs when walking
  legL: THREE.Object3D; legR: THREE.Object3D; armL: THREE.Object3D; armR: THREE.Object3D;   // pivots: groups or bones
  phase: number;
  pose: "stand" | "net" | "sit";
  armRestL?: number;        // rotation (about z) that brings an A-pose arm down along the body (rigged meshes)
  armRestR?: number;
};

/** A person facing -z (north) at rotation 0. */
export function makePerson(p: Palette): Person {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const k = (p.height ?? 1.75) / 1.75;
  body.scale.setScalar(k);

  const skin = mat(p.skin, 0.75), tunic = mat(p.tunic, 0.95), hair = mat(p.hair, 0.8), sandal = mat(p.sandal, 0.8);

  // legs: hip pivots, so they swing
  const mkLeg = (side: number) => {
    const g = new THREE.Group(); g.position.set(0.09 * side, 0.86, 0);
    g.add(mesh(new THREE.CapsuleGeometry(0.06, 0.66, 4, 8), skin, 0, -0.43, 0));
    g.add(mesh(new THREE.BoxGeometry(0.11, 0.04, 0.26), sandal, 0, -0.84, -0.05));
    body.add(g); return g;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);

  // the tunic: a lathe from the hem up to the shoulders
  const hem = p.short ? 0.5 : 0.22;
  const prof = [
    [0.0, hem - 0.01], [0.27, hem], [0.25, hem + 0.2], [0.21, 0.82], [0.18, 1.0], [0.21, 1.2], [0.23, 1.36], [0.17, 1.46], [0.06, 1.5], [0.0, 1.5],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const robe = mesh(new THREE.LatheGeometry(prof, 18), tunic);
  robe.scale.z = 0.72;
  body.add(robe);
  const belt = mesh(new THREE.TorusGeometry(0.185, 0.022, 6, 20), mat(p.belt, 0.9), 0, 1.0, 0);
  belt.rotation.x = Math.PI / 2; belt.scale.y = 0.72;
  body.add(belt);
  if (p.belt && !p.short) {
    const knot = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 5), mat(p.belt, 0.9), 0.08, 0.86, -0.13);
    body.add(knot);
  }

  // arms: shoulder pivots
  const mkArm = (side: number) => {
    const g = new THREE.Group(); g.position.set(0.25 * side, 1.38, 0);
    g.add(mesh(new THREE.CapsuleGeometry(0.058, 0.36, 4, 8), tunic, 0, -0.2, 0));
    g.add(mesh(new THREE.CapsuleGeometry(0.045, 0.22, 4, 8), skin, 0, -0.5, 0));
    body.add(g); return g;
  };
  const armL = mkArm(-1), armR = mkArm(1);

  // head and hair (no face is modelled)
  body.add(mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 8), skin, 0, 1.52, 0));
  const head = mesh(new THREE.SphereGeometry(0.105, 16, 12), skin, 0, 1.63, 0);
  head.scale.set(0.92, 1.08, 1);
  body.add(head);
  const cap = mesh(new THREE.SphereGeometry(0.115, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hair, 0, 1.645, 0.012);
  cap.scale.set(0.98, 1.06, 1.04);
  body.add(cap);
  if (p.hairLong) {
    // wavy, to the shoulders: a few lumps behind the head
    for (let i = 0; i < 5; i++) {
      const a = -0.8 + i * 0.4;
      const l = mesh(new THREE.SphereGeometry(0.06, 10, 8), hair, Math.sin(a) * 0.085, 1.5 + (i % 2) * 0.02, 0.06 + Math.cos(a) * 0.02);
      l.scale.set(1, 1.9, 0.75);
      body.add(l);
    }
  }
  if (p.beard) {
    const b = mesh(new THREE.SphereGeometry(0.08, 10, 8), hair, 0, 1.56, -0.055);
    b.scale.set(1.05, 0.9, 0.7);
    body.add(b);
  }

  // the mantle: across the back from the left shoulder to the right hip, and draped over the left shoulder
  if (p.mantle !== undefined) {
    const m = new THREE.MeshStandardMaterial({ color: p.mantle, roughness: 0.95, side: THREE.DoubleSide });
    // wrapped around the back and the left side (the person faces -z, so the back is +z and the left is -x)
    const wrap = mesh(new THREE.CylinderGeometry(0.235, 0.3, 1.0, 16, 1, true, -1.95, 2.6), m, 0, 1.0, 0.01);
    wrap.scale.z = 0.8; wrap.rotation.z = 0.12;
    body.add(wrap);
    const over = mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m, -0.17, 1.39, 0.02);
    over.scale.set(0.9, 0.55, 1.25); over.rotation.z = 0.35;
    body.add(over);
    const fall = mesh(new THREE.BoxGeometry(0.17, 0.7, 0.03), m, -0.2, 1.06, -0.17);
    fall.rotation.z = 0.06; fall.rotation.x = 0.06;
    body.add(fall);
  }

  return { root, body, legL, legR, armL, armR, phase: 0, pose: "stand" };
}

/** Walk cycle (speed in m/s) or the held pose. */
export function animate(p: Person, speed: number, dt: number, t: number) {
  if (p.pose === "sit") {
    p.body.position.y = -0.42;
    p.legL.rotation.x = p.legR.rotation.x = -1.35;
    p.armL.rotation.x = p.armR.rotation.x = -0.9;
    p.armL.rotation.z = (p.armRestL ?? 0) + 0.25; p.armR.rotation.z = (p.armRestR ?? 0) - 0.25;
    p.armL.rotation.x += Math.sin(t * 2.1) * 0.12;      // hands busy with the nets (Mark 1:19)
    p.armR.rotation.x += Math.sin(t * 2.1 + 1.3) * 0.12;
    return;
  }
  if (p.pose === "net" && speed < 0.05) {
    const s = Math.sin(t * 1.3);
    p.body.position.y = 0;
    p.legL.rotation.x = p.legR.rotation.x = 0;
    p.armL.rotation.x = p.armR.rotation.x = -0.9 - 0.35 * s;
    p.armL.rotation.z = (p.armRestL ?? 0) + 0.15; p.armR.rotation.z = (p.armRestR ?? 0) - 0.15;
    p.body.rotation.x = -0.12 - 0.06 * s;
    return;
  }
  p.body.rotation.x = 0;
  p.armL.rotation.z = (p.armRestL ?? 0) + 0.06; p.armR.rotation.z = (p.armRestR ?? 0) - 0.06;
  const amp = Math.min(1, speed / 2.6);
  p.phase += dt * (2.2 + speed * 1.6);
  const s = Math.sin(p.phase);
  p.legL.rotation.x = 0.55 * amp * s;
  p.legR.rotation.x = -0.55 * amp * s;
  p.armL.rotation.x = -0.45 * amp * s;
  p.armR.rotation.x = 0.45 * amp * s;
  p.body.position.y = Math.abs(Math.cos(p.phase)) * 0.04 * amp;
}
