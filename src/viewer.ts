// Mesh viewer for the Tripo deliveries: tools/viewer/index.html?src=/models/heroi.glb&yaw=180&h=1.76
// Renders the model under the game's light, scaled to the height of its sheet (h, metres), and lists what matters for
// the budget (triangles, textures, rig, animations, raw size). tools/check_model.mjs drives it with Playwright.
import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const q = new URLSearchParams(location.search);
const src = q.get("src") ?? "/models/heroi.glb";
const yaw = THREE.MathUtils.degToRad(Number(q.get("yaw") ?? 0));
const targetH = Number(q.get("h") ?? 0);
const out = document.getElementById("stats")!;

async function main() {
  const canvas = document.getElementById("c") as HTMLCanvasElement;
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true, forceWebGL: q.get("gl") === "1" });
  renderer.setPixelRatio(1);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  await renderer.init();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc9ccc2);
  scene.add(new THREE.HemisphereLight(0xcfe0f5, 0x7d6c4f, 1.25));
  const sun = new THREE.DirectionalLight(0xfff0d4, 2.7);
  sun.position.set(2, 3.5, 2.6); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.1, far: 12 });
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), new THREE.MeshStandardMaterial({ color: 0xcdb68c, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(src);
  const model = gltf.scene;
  let tris = 0, verts = 0, skinned = 0;
  const textures = new Set<string>();
  model.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true;
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    verts += g.attributes.position.count;
    if ((m as unknown as THREE.SkinnedMesh).isSkinnedMesh) skinned++;
    const mat = m.material as THREE.MeshStandardMaterial;
    for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap"] as const) {
      const t = mat[k] as THREE.Texture | null;
      const img = t?.image as { width?: number; height?: number } | undefined;
      if (t && img?.width) textures.add(`${k} ${img.width}×${img.height}`);
    }
  });
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const k = targetH > 0 ? targetH / size.y : 1;
  model.scale.setScalar(k);
  const box2 = new THREE.Box3().setFromObject(model);
  model.position.set(-(box2.min.x + box2.max.x) / 2, -box2.min.y, -(box2.min.z + box2.max.z) / 2);
  const pivot = new THREE.Group(); pivot.add(model); pivot.rotation.y = yaw; scene.add(pivot);

  const h = size.y * k;
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 50);
  camera.position.set(0, h * 0.55, h * 2.3);
  camera.lookAt(0, h * 0.5, 0);
  renderer.render(scene, camera);
  await new Promise((r) => setTimeout(r, 300));
  renderer.render(scene, camera);

  const stats = {
    src, triangles: Math.round(tris), vertices: verts, skinnedMeshes: skinned, animations: gltf.animations.map((a) => `${a.name} (${a.duration.toFixed(2)} s)`),
    rawSize: [size.x, size.y, size.z].map((v) => +v.toFixed(3)), scaledSize: [size.x * k, size.y * k, size.z * k].map((v) => +v.toFixed(3)),
    textures: [...textures], yaw: Number(q.get("yaw") ?? 0),
  };
  out.textContent = JSON.stringify(stats, null, 1);
  (window as unknown as { __viewer: unknown }).__viewer = stats;
}

main().catch((e) => { out.textContent = `ERRO: ${e}`; (window as unknown as { __viewer: unknown }).__viewer = { error: String(e) }; });
