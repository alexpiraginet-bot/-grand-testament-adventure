// Review page of the house kit (src/house-kit.ts), outside the game: tools/casas/index.html, served by the dev server
// only. It exists so the houses can be looked at and approved before any of them goes into the town;
// tools/shoot_casas.mjs takes its pictures.
//   ?view=rua|meio|alto|porta            a street of lots of the sizes the village has, on flat ground
//   ?view=comparar                       the three sculpted meshes the village uses today, each beside the kit's
//                                        house for a lot of its size, all facing the camera
//   ?view=vila|vila-alto|vila-rua        the kit on the village's 158 real lots, turned as the town turns them, on
//                                        the real ground and the town's own foundations. No water, plants, people,
//                                        walls or sky here: this is not the game's scene, only its lots.
//   &i=<house for the close views>   &n=<houses in the street>   &hud=0 hides the text   &perfil=mobile
import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import houseMaterials from "./data/house-materials-r17.json";
import facadeMaterials from "./data/facade-materials-r13.json";
import catalog from "./data/tripo-assets.json";
import { houseDesign, houseMesh, mergeHouses, villageDesigns, type HouseMesh, type MaterialId, type VillageLot } from "./house-kit.ts";
import { Terrain, decodeHeights } from "./terrain.ts";
import { buildingPoint, missionRoutes, settlementLayout } from "./world-layout.ts";
import { convexFootprint, foundationMeshData } from "./village-house-placement.ts";
import { HOUSE_B_FRONT_YAW, facadeHousePlacements } from "./village-facade-layout.ts";

const q = new URLSearchParams(location.search);
const view = q.get("view") ?? "rua", count = Number(q.get("n") ?? 16), pick = Number(q.get("i") ?? 3);
const out = document.getElementById("stats")!;
if (q.get("hud") === "0") out.hidden = true;
const SCULPTED = ["casa-basalto-a", "casa-basalto-b", "casa-basalto-c"] as const;

type Maps = { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture };
async function maps(profile: Record<string, { url: string }>): Promise<Maps> {
  const loader = new THREE.TextureLoader(), result = {} as Maps;
  for (const role of ["map", "normalMap", "roughnessMap"] as const) {
    const t = await loader.loadAsync(`/${profile[role].url}`);
    t.colorSpace = role === "map" ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    result[role] = t;
  }
  return result;
}

/** A street's lots: the three catalogued footprints at one uniform scale each, as the village's are (docs/CASAS-R10.md). */
function streetLots(n: number, lane: number): (VillageLot & { rot: number })[] {
  const base = SCULPTED.map((id) => { const b = catalog.assets[id].bounds; return { w: b.max[0] - b.min[0], d: b.max[2] - b.min[2], h: b.max[1] - b.min[1] }; });
  let xa = 0, xb = 0;
  return Array.from({ length: n }, (_, i) => {
    const b = base[(i * 7 + (i >> 2)) % 3], s = 0.78 + (((i * 2654435761) >>> 0) % 1000) / 1000 * 0.34, w = b.w * s, d = b.d * s, north = i % 2 === 0, gap = 0.5 + ((i * 37) % 10) / 10;
    const x = north ? xa + w / 2 : xb + w / 2; if (north) xa += w + gap; else xb += w + gap;
    return { w, d, h: b.h * s, seed: i + 1, x, z: north ? -(lane / 2 + d / 2) : lane / 2 + d / 2, rot: north ? 0 : Math.PI };
  });
}

function toObject(mesh: HouseMesh, materials: Record<MaterialId, THREE.Material>): THREE.Group {
  const group = new THREE.Group();
  for (const id of ["wall", "mud", "wood"] as const) {
    const part = mesh[id]; if (!part.indices.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(part.positions, 3)); g.setAttribute("normal", new THREE.BufferAttribute(part.normals, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(part.uvs, 2)); g.setAttribute("color", new THREE.BufferAttribute(part.colors, 3));
    g.setIndex(new THREE.BufferAttribute(part.indices, 1));
    const m = new THREE.Mesh(g, materials[id]); m.castShadow = m.receiveShadow = true; group.add(m);
  }
  return group;
}

async function main() {
  const canvas = document.getElementById("c") as HTMLCanvasElement;
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: q.get("gl") === "1" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;   // the game's (look.ts)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  await renderer.init();
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x9daab9); scene.fog = new THREE.Fog(0x9daab9, 160, 1400);
  // main.ts: the same sky light and sun
  scene.add(new THREE.HemisphereLight(0xcfe0f5, 0x7d6c4f, 1.25));
  const sun = new THREE.DirectionalLight(0xfff0d4, 2.7); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  const shade = (half: number) => { const sc = sun.shadow.camera; sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 1; sc.far = 700; sc.updateProjectionMatrix(); sun.shadow.bias = -0.0004; sun.shadow.normalBias = Number(q.get("sombra") ?? (half > 100 ? 0.12 : 0.03)); };
  scene.add(sun, sun.target);
  const light = (x: number, y: number, z: number, half: number) => { shade(half); sun.target.position.set(x, y, z); sun.position.set(x - 70 * 2.4, y + 85 * 2.4, z + 60 * 2.4); };

  const profile = q.get("perfil") === "mobile" ? "mobile" : "desktop";
  const [wall, mud, wood] = await Promise.all([maps(houseMaterials.materials["basalt-wall"].profiles[profile]), maps(houseMaterials.materials["mud-plaster"].profiles[profile]), maps(facadeMaterials.profiles[profile])]);
  const standard = (m: Maps, bump: number) => new THREE.MeshStandardMaterial({ ...m, vertexColors: true, metalness: 0, roughness: 1, normalScale: new THREE.Vector2(bump, bump) });
  // &relevo=<n>: how strongly the stone's normal map bends the light. 0.8 unless given: at 1.15 a wall the sun only
  // grazes, seen from a hand's width, showed light streaks on the stones' edges (docs/CASAS-R17.md). &sombra=<n>: the
  // shadow's normal bias, which did not change them.
  const materials: Record<MaterialId, THREE.Material> = { wall: standard(wall, Number(q.get("relevo") ?? 0.8)), mud: standard(mud, 0.9), wood: standard(wood, 1) };
  const dirt = await new THREE.TextureLoader().loadAsync("/textures/ground/r13/dirt-1024-albedo.webp");
  dirt.colorSpace = THREE.SRGBColorSpace; dirt.wrapS = dirt.wrapT = THREE.RepeatWrapping; dirt.anisotropy = 8;
  const earth = new THREE.MeshStandardMaterial({ map: dirt, roughness: 1, metalness: 0 });

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3000);
  const report: Record<string, unknown> = {};
  let text = "";

  if (view.startsWith("vila")) {
    // ---- the village's real lots, as village-houses.ts makes them (test/fixtures/town-scene.ts does the same in Node)
    const [meta, heights] = await Promise.all([fetch("/world/cafarnaum.json").then((r) => r.json()), fetch("/world/cafarnaum-heights.json").then((r) => r.json())]);
    const t = new Terrain(meta, decodeHeights(heights)), routes = missionRoutes(t), lots = settlementLayout(t, routes, 0, 0);
    const placements = facadeHousePlacements(t, lots, SCULPTED.map((id) => ({ bounds: catalog.assets[id].bounds })), routes, 256), plans = placements.map((p) => p.plan);
    const designs = villageDesigns(plans.map((p, i) => ({ w: p.w, d: p.d, h: p.h, seed: i + 1, x: p.x, z: p.z }))), meshes = designs.map(houseMesh);
    const village = mergeHouses(meshes.map((mesh, i) => ({ mesh, x: plans[i].x, y: plans[i].y, z: plans[i].z, rot: plans[i].rot })));
    scene.add(toObject(village, materials));
    // the town's own foundations, under each kit house's base instead of under the sculpted mesh's outline
    const f = foundationMeshData(t, placements.map((p, i) => { const b = designs[i].base; return { ...p, outline: convexFootprint([{ x: b.x0, z: b.z0 }, { x: b.x1, z: b.z0 }, { x: b.x1, z: b.z1 }, { x: b.x0, z: b.z1 }]) }; }), 256);
    const fg = new THREE.BufferGeometry(); fg.setAttribute("position", new THREE.BufferAttribute(f.positions, 3)); fg.setAttribute("uv", new THREE.BufferAttribute(f.uvs, 2)); fg.setAttribute("color", new THREE.BufferAttribute(f.colors, 3)); fg.setIndex(f.indices); fg.computeVertexNormals();
    const foundation = new THREE.Mesh(fg, materials.wall); foundation.castShadow = foundation.receiveShadow = true; scene.add(foundation);
    // the real ground under and around them, drawn plainly
    const xs = plans.map((p) => p.x), zs = plans.map((p) => p.z), x0 = Math.min(...xs) - 90, x1 = Math.max(...xs) + 90, z0 = Math.min(...zs) - 90, z1 = Math.max(...zs) + 90, step = 2;
    const nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step), gp = new Float32Array((nx + 1) * (nz + 1) * 3), guv = new Float32Array((nx + 1) * (nz + 1) * 2), gi: number[] = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { const x = x0 + i * step, z = z0 + j * step, k = j * (nx + 1) + i; gp.set([x, t.heightAt(x, z), z], k * 3); guv.set([x / 6, z / 6], k * 2); }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 2, d = a + nx + 1; gi.push(a, d, c, a, c, b); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute("position", new THREE.BufferAttribute(gp, 3)); gg.setAttribute("uv", new THREE.BufferAttribute(guv, 2)); gg.setIndex(gi); gg.computeVertexNormals();
    const ground = new THREE.Mesh(gg, earth); ground.receiveShadow = true; scene.add(ground);
    // y = 0 is the lake's surface (terrain.ts): a plain sheet there, only to tell shore from water
    const lake = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3f6f86, roughness: 0.35, metalness: 0 }));
    lake.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); scene.add(lake);

    scene.fog = null;
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2, span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
    // where most of the houses are: the middle lot, and how far from it four in five of them stand
    const mid = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)], mx = mid(xs), mz = mid(zs), reach = [...plans.map((p) => Math.hypot(p.x - mx, p.z - mz))].sort((a, b) => a - b)[Math.floor(plans.length * 0.8)];
    // the close view: before the lot with most neighbours (or &i=), looking along its street
    const crowd = (i: number) => plans.filter((p) => Math.hypot(p.x - plans[i].x, p.z - plans[i].z) < 30).length;
    const chosen = q.has("i") ? Math.min(pick, plans.length - 1) : plans.map((_, i) => i).reduce((best, i) => (crowd(i) > crowd(best) ? i : best), 0), p = plans[chosen];
    if (view === "vila-rua") {
      const side = Number(q.get("lado") ?? 1), eye = buildingPoint(p, -9 * side, p.d / 2 + Number(q.get("dist") ?? 5)), look = buildingPoint(p, 12 * side, p.d / 2 + 2.5);
      camera.position.set(eye.x, t.heightAt(eye.x, eye.z) + 1.65, eye.z); camera.lookAt(look.x, t.heightAt(look.x, look.z) + 1.7, look.z);
      light(p.x, p.y, p.z, 60);
    } else if (view === "vila-alto") {
      camera.fov = 40; camera.updateProjectionMatrix(); camera.position.set(cx, span * 1.45, cz + 1); camera.lookAt(cx, 0, cz); light(cx, 0, cz, span * 0.62);
    } else {
      const turn = Number(q.get("giro") ?? 0.6), far = Number(q.get("dist") ?? 0.8) * reach, my = t.heightAt(mx, mz);
      camera.position.set(mx - Math.sin(turn) * far, my + far * 0.5, mz + Math.cos(turn) * far); camera.lookAt(mx, my + 2, mz); light(mx, my, mz, reach * 1.25);
    }
    const kinds: Record<string, number> = {}; for (const d of designs) kinds[d.kind] = (kinds[d.kind] ?? 0) + 1;
    Object.assign(report, { houses: plans.length, triangles: village.triangles, foundationTriangles: f.indices.length / 3, kinds, looks: new Set(designs.map((d) => d.look)).size, redrawn: designs.filter((d, i) => d.seed !== i + 1).length, chosen, highest: Math.max(...meshes.map((m) => m.height)) });
    text = `kit de casas nos ${plans.length} lotes reais da vila · ${village.triangles} triângulos em 3 malhas (pedra, reboco, madeira) · ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(", ")}\nvista ${view} · só lotes, chão e fundações: sem água, plantas, pessoas, muros nem céu do jogo`;
  } else {
    dirt.repeat.set(60, 60);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), earth); ground.receiveShadow = true; scene.add(ground);
    if (view === "comparar") {
      // ---- today's three meshes, each with the kit's house for a lot of its size beside it, all facing the camera
      const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
      let x = 0, sculpted = 0, triangles = 0, kit = 0; const names: string[] = [], pairs: { x: number; w: number }[] = [];
      for (const id of SCULPTED) {
        const entry = catalog.assets[id] as { url?: string; file?: string; triangles: number; bounds: { min: number[]; max: number[] } }, url = `/${entry.url ?? entry.file}`;
        // house B's real entrance is on its +X side: the town turns it to the street (village-facade-layout.ts), so here too
        const turned = id === "casa-basalto-b", b = entry.bounds, sx = b.max[0] - b.min[0], sz = b.max[2] - b.min[2], w = turned ? sz : sx, d = turned ? sx : sz, h = b.max[1] - b.min[1];
        try {
          const gltf = await loader.loadAsync(url);
          gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = o.receiveShadow = true; } });
          const holder = new THREE.Group(); gltf.scene.position.set(-(b.min[0] + b.max[0]) / 2, -b.min[1], -(b.min[2] + b.max[2]) / 2); holder.add(gltf.scene);
          holder.rotation.y = turned ? HOUSE_B_FRONT_YAW : 0; holder.position.set(x + w / 2, 0, -d / 2); scene.add(holder); sculpted++; triangles += entry.triangles;
        } catch (error) { text = `malha atual indisponível: ${url} (${String(error)})\n`; }
        pairs.push({ x: x + w + 0.5, w: 2 * w + 1 }); x += w + 1.0;
        const design = houseDesign({ w, d, h, seed: 500 + names.length }), mesh = houseMesh(design), object = toObject(mesh, materials);
        object.position.set(x + w / 2, 0, -d / 2); scene.add(object); kit += mesh.triangles; names.push(design.kind);
        x += w + 2.2;
      }
      // &i=0..2: one pair close; without it, the three pairs in a row
      const one = q.has("i") ? pairs[Math.min(pick, pairs.length - 1)] : null, width = x - 2.2, centre = one ? one.x : width / 2, far = (one ? one.w : width) * (innerWidth > innerHeight ? 0.66 : 1.5);
      camera.position.set(centre, one ? 2.4 : 4.2, far); camera.lookAt(centre, one ? 1.25 : 1.5, -2); light(centre, 0, 0, 45);
      Object.assign(report, { sculpted, sculptedTriangles: triangles, kitTriangles: kit, kinds: names });
      text += `da esquerda para a direita: malha atual A, casa do kit, malha atual B, casa do kit, malha atual C, casa do kit (${names.join(", ")})\nmalhas atuais ${triangles} triângulos · kit ${kit} triângulos`;
    } else {
      // ---- the street: two rows of houses facing each other across a lane, on flat ground
      const lane = 4.6, all = streetLots(count, lane), designs = villageDesigns(all);
      let triangles = 0; const kinds: Record<string, number> = {};
      designs.forEach((design, i) => {
        const mesh = houseMesh(design), object = toObject(mesh, materials);
        object.position.set(all[i].x, 0, all[i].z); object.rotation.y = all[i].rot; scene.add(object);
        triangles += mesh.triangles; kinds[design.kind] = (kinds[design.kind] ?? 0) + 1;
      });
      const length = Math.max(...all.map((l) => l.x + l.w / 2)), target = all[Math.min(pick, all.length - 1)];
      const views: Record<string, [THREE.Vector3, THREE.Vector3]> = {
        rua: [new THREE.Vector3(-3.5, 1.65, 0.5), new THREE.Vector3(18, 1.7, 0)],
        meio: [new THREE.Vector3(length * 0.42, 1.65, -0.6), new THREE.Vector3(length, 1.9, 0.4)],
        alto: [new THREE.Vector3(-9, 13, 17), new THREE.Vector3(length * 0.42, 0, 0)],
        porta: [new THREE.Vector3(target.x + 1.6, 1.6, target.z + (target.rot ? -1 : 1) * (target.d / 2 + 3.4)), new THREE.Vector3(target.x, 1.35, target.z)],
      };
      const [eye, look] = views[view] ?? views.rua;
      camera.position.copy(eye); camera.lookAt(look); light(length * 0.4, 0, 0, 45);
      Object.assign(report, { houses: all.length, triangles, kinds });
      text += `kit de casas · ${all.length} casas · ${triangles} triângulos · ${Object.entries(kinds).map(([k, n]) => `${k} ${n}`).join(", ")}\nvista ${view} · rua de teste em chão plano, lotes dos tamanhos da vila`;
    }
  }

  out.textContent = `${text} · materiais gerados por código (${profile})`;
  let frames = 0;
  renderer.setAnimationLoop(() => { renderer.render(scene, camera); if (++frames === 3) (window as unknown as { __casas: unknown }).__casas = { ready: true, view, ...report, calls: renderer.info.render.drawCalls }; });
  addEventListener("resize", () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
}
main().catch((error) => { out.textContent = `falhou: ${String(error?.stack ?? error)}`; (window as unknown as { __casas: unknown }).__casas = { ready: false, error: String(error) }; });
