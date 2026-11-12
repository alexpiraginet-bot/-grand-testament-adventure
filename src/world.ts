// The 3D world: ground from the real relief, the lake, the far hills, sky, plants, Capernaum's houses, the boat.
// Houses, plants, rocks and the boat are simple shapes in place of the Tripo meshes (TRIPO.md).
import * as THREE from "three/webgpu";
import { Terrain } from "./terrain.ts";

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function noise2(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

/** A tiling grain texture (grey) for the ground's close-up detail. */
function grainTexture(size = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  const r = rng(11);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // periodic value noise: sample the lattice modulo the tile
    let v = 0, amp = 0.5, f = 8;
    for (let o = 0; o < 4; o++) {
      const px = (x / size) * f, py = (y / size) * f;
      const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
      const h = (i: number, j: number) => hash2(((i % f) + f) % f + o * 17, ((j % f) + f) % f);
      const u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
      v += amp * ((h(ix, iy) * (1 - u) + h(ix + 1, iy) * u) * (1 - w) + (h(ix, iy + 1) * (1 - u) + h(ix + 1, iy + 1) * u) * w);
      amp *= 0.5; f *= 2;
    }
    const n = 200 + (v - 0.5) * 90 + (r() - 0.5) * 30;
    const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, n)); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Normal map of small waves, tiling. */
function waveNormals(size = 256): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d")!;
  const img = g.createImageData(size, size);
  const H = (x: number, y: number) => {
    let v = 0;
    for (const [kx, ky, a] of [[3, 1, 1], [1, 4, 0.8], [5, -3, 0.5], [-7, 6, 0.3], [11, 9, 0.2]] as const)
      v += a * Math.sin((2 * Math.PI * (kx * x + ky * y)) / size);
    return v;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = H(x + 1, y) - H(x - 1, y), dy = H(x, y + 1) - H(x, y - 1);
    const nx = -dx * 0.9, ny = -dy * 0.9, nz = 1, l = Math.hypot(nx, ny, nz);
    const i = (y * size + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const SAND = new THREE.Color(0xcdb68c), WET = new THREE.Color(0x8d7b5e), GRASS = new THREE.Color(0x8b8a52),
  DRY = new THREE.Color(0xb3a06c), ROCK = new THREE.Color(0x5a5048), BED = new THREE.Color(0x6f6550);

export function groundMesh(t: Terrain, segments: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(t.size, t.size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = t.heightAt(x, z);
    pos.setY(i, y);
    const s = t.slopeAt(x, z);
    const n = noise2(x * 0.02, z * 0.02), n2 = noise2(x * 0.11 + 7, z * 0.11);
    if (y < -0.05) c.copy(WET).lerp(BED, Math.min(1, -y / 2));
    else if (y < 1.1) c.copy(WET).lerp(SAND, Math.min(1, y / 0.5));
    else {
      c.copy(SAND).lerp(DRY, Math.min(1, (y - 1.1) / 2.5));
      c.lerp(GRASS, Math.min(1, Math.max(0, (y - 3) / 6)) * (0.35 + 0.55 * n));
    }
    c.lerp(ROCK, Math.min(1, Math.max(0, (s - 0.18) / 0.25)) * 0.85 + (n2 > 0.78 ? 0.25 : 0));
    const v = 0.92 + 0.16 * n2;
    col[i * 3] = c.r * v; col[i * 3 + 1] = c.g * v; col[i * 3 + 2] = c.b * v;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const grain = grainTexture();
  // uv repeats every 6 m
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * t.size / 6, uv.getY(i) * t.size / 6);
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: grain, roughness: 0.96, metalness: 0 });
  const mesh = new THREE.Mesh(geo, m);
  mesh.receiveShadow = true;
  return mesh;
}

export function farMesh(far: Int16Array, size: number, n: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size, n - 1, n - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = far[i] / 10;           // PlaneGeometry vertex order = row-major from the north-west corner, like the grid
    pos.setY(i, y);
    c.copy(DRY).lerp(GRASS, Math.min(1, Math.max(0, y / 250)) * 0.7).lerp(ROCK, Math.min(1, Math.max(0, (y - 400) / 800)) * 0.6);
    if (y < 0) c.copy(BED);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
}

export function water(size: number): { mesh: THREE.Mesh; update: (t: number) => void } {
  const nrm = waveNormals();
  nrm.repeat.set(size / 9, size / 9);
  const m = new THREE.MeshStandardMaterial({
    color: 0x3f6d72, roughness: 0.12, metalness: 0.0, normalMap: nrm, normalScale: new THREE.Vector2(0.35, 0.35),
    transparent: true, opacity: 0.86,
  });
  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, m);
  mesh.receiveShadow = true;
  mesh.renderOrder = 2;
  return { mesh, update: (t) => { nrm.offset.set(t * 0.004, t * 0.0027); } };
}

/** Sky dome: a vertical gradient with a warm glow toward the sun. */
export function sky(sunDir: THREE.Vector3): THREE.Mesh {
  const geo = new THREE.SphereGeometry(40000, 32, 16);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const top = new THREE.Color(0x4f86c2), hor = new THREE.Color(0xd9dcd2), glow = new THREE.Color(0xffe2b0), c = new THREE.Color();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const h = Math.max(0, v.y);
    c.copy(hor).lerp(top, Math.pow(h, 0.55));
    const g = Math.pow(Math.max(0, v.dot(sunDir)), 6);
    c.lerp(glow, g * 0.75);
    if (v.y < 0) c.copy(hor);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const mesh = new THREE.Mesh(geo, m);
  mesh.renderOrder = -1;
  return mesh;
}

type Spot = { x: number; z: number; y: number };

function scatter(t: Terrain, count: number, seed: number, ok: (x: number, z: number, y: number, s: number) => boolean, area = t.size * 0.48): Spot[] {
  const r = rng(seed), out: Spot[] = [];
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const x = (r() * 2 - 1) * area, z = (r() * 2 - 1) * area;
    const y = t.heightAt(x, z), s = t.slopeAt(x, z);
    if (ok(x, z, y, s)) out.push({ x, z, y });
  }
  return out;
}

function instanced(geo: THREE.BufferGeometry, m: THREE.Material, spots: Spot[], seed: number, scale: (r: () => number) => [number, number, number], shadow = true) {
  const im = new THREE.InstancedMesh(geo, m, spots.length);
  const r = rng(seed), o = new THREE.Object3D();
  spots.forEach((s, i) => {
    const [sx, sy, sz] = scale(r);
    o.position.set(s.x, s.y, s.z);
    o.rotation.set(0, r() * Math.PI * 2, 0);
    o.scale.set(sx, sy, sz);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  });
  im.castShadow = shadow;
  im.receiveShadow = true;
  return im;
}

function mergeGeos(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // a minimal merge (position, normal, color) for small static props
  let n = 0;
  for (const p of parts) n += (p.index ? p.index.count : p.attributes.position.count);
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let k = 0;
  for (const p0 of parts) {
    const p = p0.index ? p0.toNonIndexed() : p0;
    const P = p.attributes.position, N = p.attributes.normal, C = p.attributes.color;
    for (let i = 0; i < P.count; i++, k++) {
      pos[k * 3] = P.getX(i); pos[k * 3 + 1] = P.getY(i); pos[k * 3 + 2] = P.getZ(i);
      nrm[k * 3] = N.getX(i); nrm[k * 3 + 1] = N.getY(i); nrm[k * 3 + 2] = N.getZ(i);
      col[k * 3] = C.getX(i); col[k * 3 + 1] = C.getY(i); col[k * 3 + 2] = C.getZ(i);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function tinted(g: THREE.BufferGeometry, color: number, ty = 0, sx = 1, sy = 1, sz = 1, tx = 0, tz = 0) {
  g.scale(sx, sy, sz); g.translate(tx, ty, tz);
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return g;
}

export type Avoid = { x: number; z: number; r: number }[];
export type Segment = { ax: number; az: number; bx: number; bz: number; r: number };

function nearSeg(x: number, z: number, s: Segment) {
  const dx = s.bx - s.ax, dz = s.bz - s.az, l2 = dx * dx + dz * dz;
  const u = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / l2));
  return Math.hypot(x - (s.ax + u * dx), z - (s.az + u * dz)) < s.r;
}

export function props(t: Terrain, keepClear: Segment[], q: number) {
  const g = new THREE.Group();
  const clear = (x: number, z: number) => keepClear.every((s) => !nearSeg(x, z, s));
  const vc = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });

  // olive trees: a twisted trunk and three grey-green crowns
  const tree = mergeGeos([
    tinted(new THREE.CylinderGeometry(0.16, 0.3, 2.2, 6), 0x5e4a36, 1.1),
    tinted(new THREE.IcosahedronGeometry(1.5, 1), 0x6f7a4c, 2.9, 1.25, 0.8, 1.15),
    tinted(new THREE.IcosahedronGeometry(1.1, 1), 0x7d8656, 3.3, 1, 0.75, 1, 0.9, 0.4),
    tinted(new THREE.IcosahedronGeometry(1.0, 1), 0x66714a, 3.0, 1, 0.8, 1, -0.8, -0.5),
  ]);
  const trees = [
    ...scatter(t, Math.round(700 * q), 21, (x, z, y, s) => y > 3 && s < 0.32 && clear(x, z) && noise2(x * 0.006, z * 0.006) > 0.42),
    ...scatter(t, Math.round(260 * q), 23, (x, z, y, s) => y > 2 && s < 0.3 && clear(x, z) && Math.hypot(x, z) > 40, 420),   // groves near the town
  ];
  g.add(instanced(tree, vc, trees, 22, (r) => { const k = 0.75 + r() * 0.6; return [k, k * (0.85 + r() * 0.3), k]; }));

  // shrubs and dry grass tufts
  const bush = mergeGeos([tinted(new THREE.IcosahedronGeometry(0.5, 0), 0x7f7b4a, 0.25, 1, 0.6, 1)]);
  const bushes = scatter(t, Math.round(1600 * q), 31, (x, z, y, s) => y > 0.9 && s < 0.5 && clear(x, z), t.size * 0.3);
  g.add(instanced(bush, vc, bushes, 32, (r) => { const k = 0.5 + r() * 1.1; return [k, k * (0.6 + r() * 0.6), k]; }, q > 0.6));

  // basalt rocks (the local stone)
  const rock = mergeGeos([tinted(new THREE.DodecahedronGeometry(0.5, 0), 0x3d3a37, 0.1, 1, 0.6, 1)]);
  const rocks = scatter(t, Math.round(900 * q), 41, (x, z, y) => y > 0.3 && clear(x, z), t.size * 0.3);
  g.add(instanced(rock, vc, rocks, 42, (r) => { const k = 0.25 + r() * r() * 1.6; return [k, k * (0.5 + r() * 0.7), k * (0.7 + r() * 0.5)]; }));

  // reeds at the water's edge
  const reed = mergeGeos([tinted(new THREE.ConeGeometry(0.25, 1.4, 5), 0x8d8c55, 0.7, 1, 1, 1)]);
  const reeds = scatter(t, Math.round(700 * q), 51, (x, z, y) => y > -0.25 && y < 0.35 && clear(x, z) && noise2(x * 0.03, z * 0.03) > 0.55, t.size * 0.35);
  g.add(instanced(reed, vc, reeds, 52, (r) => { const k = 0.6 + r() * 0.8; return [k, k, k]; }, false));
  return g;
}

/** A cluster of basalt houses with flat roofs where the OpenBible point of Capernaum is. */
export function houses(t: Terrain, cx: number, cz: number, keepClear: Segment[]): { group: THREE.Group; boxes: { x: number; z: number; hx: number; hz: number; rot: number }[] } {
  const group = new THREE.Group();
  const wall = new THREE.MeshStandardMaterial({ color: 0x6a645c, roughness: 0.97 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x9c8762, roughness: 1 });
  const r = rng(61), boxes: { x: number; z: number; hx: number; hz: number; rot: number }[] = [];
  for (let tries = 0; boxes.length < 22 && tries < 600; tries++) {
    const a = r() * Math.PI * 2, d = 14 + r() * 110;
    const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d * 0.8;
    const y = t.heightAt(x, z);
    if (y < 1.2 || t.slopeAt(x, z) > 0.2) continue;
    if (keepClear.some((s) => nearSeg(x, z, { ...s, r: s.r + 8 }))) continue;
    const w = 5 + r() * 5, dz = 4 + r() * 4, rot = Math.round(r() * 4) * Math.PI / 2 + (r() - 0.5) * 0.15;
    if (boxes.some((b) => Math.hypot(b.x - x, b.z - z) < (Math.max(b.hx, b.hz) + Math.max(w, dz) / 2 + 2.5))) continue;
    const h = 2.4 + r() * 0.8;
    const house = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h + 1.2, dz), wall);
    body.position.y = (h + 1.2) / 2 - 1.2;
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.25, dz + 0.4), roof);
    top.position.y = h + 0.1;
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.8, 0.1), new THREE.MeshStandardMaterial({ color: 0x1d1a17, roughness: 1 }));
    door.position.set(0, 0.9, dz / 2 + 0.03);
    for (const m of [body, top]) { m.castShadow = true; m.receiveShadow = true; house.add(m); }
    house.add(door);
    house.position.set(x, y, z);
    house.rotation.y = rot;
    group.add(house);
    boxes.push({ x, z, hx: w / 2 + 0.4, hz: dz / 2 + 0.4, rot });
  }
  return { group, boxes };
}

/** A wooden fishing boat, open, about 8 m long, with nets heaped at the stern. Its deck height is returned. */
export function boat(): { group: THREE.Group; deck: number } {
  const group = new THREE.Group();
  const L = 8, B = 2.3, D = 1.0;
  const geo = new THREE.BoxGeometry(L, D, B, 16, 3, 6);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const u = x / (L / 2);
    const taper = 1 - 0.88 * Math.pow(Math.abs(u), 2.2);
    const keel = y < 0 ? 0.55 + 0.45 * (1 - Math.abs(u)) : 1;
    p.setZ(i, z * taper * (y < 0 ? 0.55 : 1));
    p.setY(i, y * keel + 0.18 * u * u);
  }
  geo.computeVertexNormals();
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4c31, roughness: 0.85 });
  const hull = new THREE.Mesh(geo, wood);
  hull.castShadow = true; hull.receiveShadow = true;
  hull.position.y = 0.25;
  group.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(L * 0.86, 0.06, B * 0.78), new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9 }));
  deck.position.y = 0.66;
  deck.receiveShadow = true;
  group.add(deck);
  const net = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), new THREE.MeshStandardMaterial({ color: 0x5d5a4a, roughness: 1 }));
  net.scale.set(1.5, 0.35, 1.1); net.position.set(-2.6, 0.78, 0.1);
  net.castShadow = true;
  group.add(net);
  for (const x of [-1.6, 0.6, 2.2]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, B * 0.7), wood);
    bench.position.set(x, 0.92, 0); group.add(bench);
  }
  return { group, deck: 0.69 };
}

/** The cast net in the water in front of Simão and André (Mark 1:16): a disc of netting. */
export function castNet(): THREE.Mesh {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.strokeStyle = "rgba(225,215,190,0.95)"; g.lineWidth = 1.4;
  for (let i = 0; i <= 128; i += 8) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3);
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 });
  const net = new THREE.Mesh(new THREE.CircleGeometry(1.8, 24), m);
  net.rotation.x = -Math.PI / 2;
  return net;
}
