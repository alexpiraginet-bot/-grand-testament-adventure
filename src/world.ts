// The 3D world: ground from the real relief, the lake, the far hills, sky, plants, Capernaum's houses, the boat.
// Tripo scenery + sourced CC0 surface maps; the settlement layout is a documented recreation.
import * as THREE from "three/webgpu";
import { texture, positionWorld, vec2, vec3, mix, clamp, smoothstep, min, float, step, color } from 'three/tsl';
import { settlementDetails } from './settlement-details.ts';
import { Terrain } from "./terrain.ts";
import { sceneryMesh, type AssetLibrary, type AssetId } from './tripo-assets.ts';
import { rng, distanceToSegment, insideObstacle, settlementLayout, type Segment, type Obstacle } from './world-layout.ts';
export { rng, type Segment } from './world-layout.ts';

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

type GroundTextures = { albedo: THREE.Texture; normal: THREE.Texture; roughness: THREE.Texture };
export async function loadGroundTextures(): Promise<GroundTextures> {
  const loader=new THREE.TextureLoader(), result={} as GroundTextures;
  await Promise.all((['albedo','normal','roughness'] as const).map(async role=>{
    const tex=await loader.loadAsync(`${import.meta.env.BASE_URL}textures/ground/rocky-gravel-${role}.webp`);
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.anisotropy=8;
    if(role==='albedo') tex.colorSpace=THREE.SRGBColorSpace;
    result[role]=tex;
  }));
  return result;
}

export async function loadSkyTextures(): Promise<{background:THREE.Texture;environment:THREE.Texture}> {
  const loader=new THREE.TextureLoader();
  const [background,environment]=await Promise.all(['background','environment'].map(role=>loader.loadAsync(`${import.meta.env.BASE_URL}textures/sky/clouds-${role}.webp`)));
  background.colorSpace=environment.colorSpace=THREE.SRGBColorSpace;
  environment.mapping=THREE.EquirectangularReflectionMapping;
  return {background,environment};
}

export function groundMesh(t: Terrain, segments: number, routes: Segment[], maps: GroundTextures): THREE.Mesh {
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
  // One measured surface. Paths are a fragment mask, not floating decal planes or altered elevation.
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i,pos.getX(i)/3.6,-pos.getZ(i)/3.6);
  const m = new THREE.MeshStandardNodeMaterial({vertexColors:true,normalMap:maps.normal,normalScale:new THREE.Vector2(.72,.72),roughness:.96,metalness:0});
  const xz=positionWorld.xz, detailUV=vec2(positionWorld.x,positionWorld.z.negate()).div(3.6);
  let pathDistance=min(float(10000),float(10000));
  for(const s of routes) {
    const a=vec2(s.ax,s.az),d=vec2(s.bx-s.ax,s.bz-s.az),p=xz.sub(a);
    const u=clamp(p.dot(d).div(d.dot(d)),0,1);
    pathDistance=min(pathDistance,p.sub(d.mul(u)).length());
  }
  const macro=texture(grainTexture(),xz.div(27)).r;
  const path=smoothstep(.65,1.5,pathDistance.add(macro.sub(.5).mul(.6))).oneMinus();
  const photographed=texture(maps.albedo,detailUV).rgb;
  const gravel=mix(vec3(photographed.dot(vec3(.2126,.7152,.0722))),photographed,.38);
  const undisturbed=gravel.mul(vec3(1.45,1.42,1.37));
  const worn=gravel.mul(.72).add(vec3(.26,.23,.18));
  m.colorNode=mix(undisturbed,worn,path).mul(macro.mul(.3).add(.9));
  m.roughnessNode=texture(maps.roughness,detailUV).r.mul(.2).add(.8);
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

export function water(size: number, terrain: Terrain): { mesh: THREE.Mesh; update: (t: number) => void } {
  const nrm = waveNormals();
  nrm.repeat.set(size / 3.5, size / 3.5);
  // Depth comes from the same authored lake bed used by the existing height field.
  // Keep the actual surface at y=0; transparent shallows reveal the real rendered floor.
  const pixels=new Uint8Array(terrain.h.length*4);
  for(let i=0;i<terrain.h.length;i++){
    const v=Math.round(Math.max(0,Math.min(9,-terrain.h[i]))/9*255);
    pixels.set([v,v,v,255],i*4);
  }
  const depthMap=new THREE.DataTexture(pixels,terrain.n,terrain.n);
  depthMap.minFilter=depthMap.magFilter=THREE.LinearFilter;depthMap.needsUpdate=true;
  const m = new THREE.MeshStandardNodeMaterial({
    color: 0x3f747c, roughness: 0.11, metalness: 0.0, normalMap: nrm, normalScale: new THREE.Vector2(0.32, 0.32),
    transparent: true, depthWrite:false,
  });
  const near=step(positionWorld.x.abs(),float(terrain.size/2)).mul(step(positionWorld.z.abs(),float(terrain.size/2)));
  // Height samples occupy texel centres, including both terrain endpoints.
  const depthUV=positionWorld.xz.add(terrain.size/2).div(terrain.step).add(.5).div(terrain.n);
  const depth=mix(float(9),texture(depthMap,depthUV).r.mul(9),near);
  m.opacityNode=mix(.18,.96,smoothstep(0,1.6,depth));
  m.colorNode=mix(color(0x7aaca0),color(0x315f7a),smoothstep(0,6,depth));
  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, m);
  mesh.receiveShadow = true;
  mesh.renderOrder = 2;
  return { mesh, update: (t) => { nrm.offset.set(t * 0.004, t * 0.0027); } };
}

/** Sky dome: CC0 photographic panorama; gradient retained for an explicit fallback. */
export function sky(sunDir: THREE.Vector3, panorama?:THREE.Texture): THREE.Mesh {
  const geo = new THREE.SphereGeometry(40000, 32, 16);
  if(panorama) {
    const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:panorama,side:THREE.BackSide,fog:false,depthWrite:false,toneMapped:false}));
    mesh.rotation.y=-.38;mesh.renderOrder=-1;
    return mesh;
  }
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const top = new THREE.Color(0x337dc5), hor = new THREE.Color(0xc5dce8), glow = new THREE.Color(0xffe5bb), c = new THREE.Color();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const h = Math.max(0, v.y);
    c.copy(hor).lerp(top, Math.pow(h, 0.3));
    const g = Math.pow(Math.max(0, v.dot(sunDir)), 32);
    c.lerp(glow, g * 0.42);
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

/** Two instanced pools per asset: retain detail nearby without hundreds of cell draw calls. */
function sceneryInstances(asset: THREE.Mesh, fallback: THREE.BufferGeometry, material: THREE.Material,
  spots: Spot[], seed: number, scale: (r: () => number) => [number, number, number], near = 140) {
  const group = new THREE.Group();
  const detailed=instanced(asset.geometry,asset.material as THREE.Material,spots,seed,scale);
  const distant=instanced(fallback,material,spots,seed,scale,false);
  const matrices=spots.map((_,i)=>{const m=new THREE.Matrix4();detailed.getMatrixAt(i,m);return m;});
  detailed.instanceMatrix.setUsage(THREE.DynamicDrawUsage); distant.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(detailed,distant);
  let lastX=Infinity,lastZ=Infinity;
  group.userData.update=(x:number,z:number)=>{
    if(Math.hypot(x-lastX,z-lastZ)<8)return;
    lastX=x;lastZ=z;
    let high=0,low=0;
    spots.forEach((s,i)=>{
      const distance=Math.hypot(x-s.x,z-s.z);
      if(distance<near) detailed.setMatrixAt(high++,matrices[i]);
      else if(distance<650) distant.setMatrixAt(low++,matrices[i]);
    });
    detailed.count=high;distant.count=low;
    for(const m of [detailed,distant]){m.visible=m.count>0;m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();}
  };
  return group;
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
function nearSeg(x: number, z: number, s: Segment) {
  return distanceToSegment(x,z,s)<s.r;
}

function alongRoutes(t:Terrain, routes:Segment[], count:number, seed:number, band:number, ok:(x:number,z:number,y:number)=>boolean):Spot[] {
  const r=rng(seed),out:Spot[]=[];
  for(let tries=0;out.length<count&&tries<count*20;tries++) {
    const s=routes[Math.floor(r()*routes.length)],u=r(),dx=s.bx-s.ax,dz=s.bz-s.az,l=Math.hypot(dx,dz),off=(r()*2-1)*band;
    const x=s.ax+dx*u+dz/l*off,z=s.az+dz*u-dx/l*off,y=t.heightAt(x,z);
    if(ok(x,z,y))out.push({x,z,y});
  }
  return out;
}

export function props(t: Terrain, keepClear: Segment[], q: number, assets: AssetLibrary = {}, buildings:Obstacle[] = []) {
  const g = new THREE.Group();
  const clear = (x: number, z: number) => keepClear.every((s) => !nearSeg(x, z, s)) && !buildings.some(b=>insideObstacle(x,z,b,2));
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
    ...alongRoutes(t,keepClear,Math.round(125*q),24,95,(x,z,y)=>y>1.5&&clear(x,z)&&keepClear.every(s=>distanceToSegment(x,z,s)>11)),
  ];
  const treeScale = (r: () => number): [number,number,number] => { const k = 0.75+r()*0.6; return [k,k*(0.85+r()*0.3),k]; };
  const treeIds: AssetId[] = ['oliveira-a','oliveira-b','arvore-espinhosa'];
  treeIds.forEach((id,i) => {
    const real = sceneryMesh(assets[id]), spots = trees.filter((_,n) => n%3===i);
    g.add(real ? sceneryInstances(real,tree,vc,spots,22+i,treeScale,180) : instanced(tree,vc,spots,22+i,treeScale));
  });

  // shrubs and dry grass tufts
  const bush = mergeGeos([tinted(new THREE.IcosahedronGeometry(0.5, 0), 0x7f7b4a, 0.25, 1, 0.6, 1)]);
  const bushes = [...scatter(t, Math.round(1600 * q), 31, (x, z, y, s) => y > 0.9 && s < 0.5 && clear(x, z), t.size * 0.3),
    ...alongRoutes(t,keepClear,Math.round(550*q),33,65,(x,z,y)=>y>.5&&clear(x,z)&&noise2(x*.12,z*.12)>.42)];
  const bushScale = (r: () => number): [number,number,number] => { const k=0.5+r()*1.1; return [k,k*(0.6+r()*0.6),k]; };
  const realBush = sceneryMesh(assets['arbusto-seco']);
  g.add(realBush ? sceneryInstances(realBush,bush,vc,bushes,32,bushScale,95) : instanced(bush,vc,bushes,32,bushScale,q>0.6));

  // basalt rocks (the local stone)
  const rock = mergeGeos([tinted(new THREE.DodecahedronGeometry(0.5, 0), 0x3d3a37, 0.1, 1, 0.6, 1)]);
  const rocks = [...scatter(t, Math.round(900 * q), 41, (x, z, y) => y > 0.3 && clear(x, z), t.size * 0.3),
    ...alongRoutes(t,keepClear,Math.round(420*q),43,55,(x,z,y)=>y>-.15&&clear(x,z))];
  const rockScale = (r: () => number): [number,number,number] => { const k=0.22+r()*r()*1.05; return [k,k*.85,k]; };
  const realRock = sceneryMesh(assets['pedras-basalto']);
  g.add(realRock ? sceneryInstances(realRock,rock,vc,rocks,42,rockScale,110) : instanced(rock,vc,rocks,42,rockScale));

  // reeds at the water's edge
  const reed = mergeGeos([tinted(new THREE.ConeGeometry(0.25, 1.4, 5), 0x8d8c55, 0.7, 1, 1, 1)]);
  const reeds = [...scatter(t, Math.round(700 * q), 51, (x, z, y) => y > -0.25 && y < 0.35 && clear(x, z) && noise2(x * 0.03, z * 0.03) > 0.55, t.size * 0.35),
    ...alongRoutes(t,keepClear.slice(1),Math.round(230*q),53,22,(x,z,y)=>y>-.2&&y<.7&&clear(x,z))];
  const reedScale = (r: () => number): [number,number,number] => { const k=0.6+r()*0.8; return [k,k,k]; };
  const realReed = sceneryMesh(assets.junco);
  g.add(realReed ? sceneryInstances(realReed,reed,vc,reeds,52,reedScale,100) : instanced(reed,vc,reeds,52,reedScale,false));
  // Small dry blades break the ground silhouette without alpha cards or a draw per tuft.
  const bladeParts:THREE.BufferGeometry[]=[];
  for(let i=0;i<5;i++) {
    const blade=new THREE.ConeGeometry(.025,.25+(i%3)*.09,3,1);
    blade.rotateZ((i-2)*.22);blade.rotateY(i*2.4);
    bladeParts.push(tinted(blade,[0x7d8050,0x999468,0x6d7850][i%3],.15,1,1,1,(i%2-.5)*.08,0));
  }
  const grasses=alongRoutes(t,keepClear,Math.round(8500*q),35,90,(x,z,y)=>y>.55&&clear(x,z)&&noise2(x*.18,z*.18)>.43);
  g.add(instanced(mergeGeos(bladeParts),vc,grasses,36,r=>{const s=.55+r()*.85;return[s,s,s];},false));
  g.userData.counts={trees:trees.length,bushes:bushes.length,rocks:rocks.length,reeds:reeds.length,grassTufts:grasses.length};
  g.userData.update=(x:number,z:number)=>{for(const child of g.children) child.userData.update?.(x,z);};
  return g;
}

/** Basalt blocks, shared courtyards and an inhabited lane; see docs/CAFARNAUM-CENARIO.md. */
export function houses(t: Terrain, cx: number, cz: number, keepClear: Segment[], assets: AssetLibrary = {}): { group: THREE.Group; boxes: Obstacle[] } {
  const group=new THREE.Group(), plans=settlementLayout(t,keepClear,cx,cz);
  const boxes:Obstacle[]=plans.map(p=>({x:p.x,z:p.z,hx:p.w/2+.35,hz:p.d/2+.35,rot:p.rot,bottom:p.y-p.foundation,top:p.y+p.h}));
  const wall=new THREE.MeshStandardMaterial({color:0x49473f,roughness:.98});
  const o=new THREE.Object3D(), foundation=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),wall,plans.length);
  const models=['casa-basalto-a','casa-basalto-b','casa-basalto-c'].map(id=>sceneryMesh(assets[id as AssetId]));
  models.forEach((model,variant)=>{
    const list=plans.filter(p=>p.variant===variant);
    const geo=model?.geometry ?? new THREE.BoxGeometry(1,1,1).translate(0,.5,0);
    geo.computeBoundingBox();const size=geo.boundingBox!.getSize(new THREE.Vector3());
    const batch=new THREE.InstancedMesh(geo,model?.material??wall,list.length);
    list.forEach((p,i)=>{
      o.position.set(p.x,p.y,p.z);o.rotation.set(0,p.rot,0);o.scale.set(p.w/size.x,p.h/size.y,p.d/size.z);o.updateMatrix();batch.setMatrixAt(i,o.matrix);
      batch.setColorAt(i,new THREE.Color().setRGB(.91+(i%4)*.03,.90+(i%3)*.03,.87+(i%5)*.025));
    });
    batch.castShadow=true;batch.receiveShadow=true;group.add(batch);
  });
  plans.forEach((p,i)=>{
    o.position.set(p.x,p.y-p.foundation/2,p.z);o.rotation.set(0,p.rot,0);o.scale.set(p.w,p.foundation,p.d);o.updateMatrix();foundation.setMatrixAt(i,o.matrix);
  });
  foundation.receiveShadow=true;group.add(foundation);

  const details=settlementDetails(t,plans,keepClear,boxes,sceneryMesh(assets['muro-pedra']));
  group.add(details.group);boxes.push(...details.boxes);
  group.userData.counts={houses:plans.length,...details.counts};
  return {group,boxes};
}

/** A wooden fishing boat, open, about 8 m long, with nets heaped at the stern. Its deck height is returned. */
export function boat(assets: AssetLibrary = {}): { group: THREE.Group; deck: number } {
  const group = new THREE.Group();
  const real = sceneryMesh(assets['barco-galileia']);
  if (real) {
    real.position.y = -0.35; group.add(real);
    const pile = sceneryMesh(assets['rede-amontoada']);
    if (pile) { pile.position.set(-2.5,0.24,0.1); group.add(pile); }
    return {group,deck:0.24};
  }
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
export function castNet(assets: AssetLibrary = {}): THREE.Mesh {
  const real = sceneryMesh(assets['rede-lancada']);
  if (real) return real;
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
