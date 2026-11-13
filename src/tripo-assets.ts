import * as THREE from 'three/webgpu';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import roster from './data/tripo-assets.json';

export type AssetId = keyof typeof roster.assets;
export type AssetLibrary = Partial<Record<AssetId, GLTF>>;
const loader = new GLTFLoader();

export async function loadTripoAssets(): Promise<AssetLibrary> {
  const assets: AssetLibrary = {};
  // Only selected runtime assets load; six A-pose NPCs are intentionally deferred until rigging.
  const ids = (Object.keys(roster.assets) as AssetId[]).filter(id => roster.assets[id].status === 'runtime');
  // Bound concurrent texture decodes, especially on phones.
  let next = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (next < ids.length) {
      const id = ids[next++], spec = roster.assets[id];
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${spec.file}`, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength !== spec.bytes) throw new Error('Unexpected asset size');
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
        if (hash !== spec.sha256) throw new Error('Asset integrity mismatch');
        assets[id] = await loader.parseAsync(buffer, '');
      } catch (error) { console.warn(`Modelo ${id} indisponível; usando forma provisória.`, error); }
    }
  }));
  return assets;
}

/** Bake only static scenery, never skins. glTF quantized attributes are expanded before transforms. */
export function sceneryMesh(asset: GLTF | undefined): THREE.Mesh | undefined {
  if (!asset) return undefined;
  asset.scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  asset.scene.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  if (meshes.length !== 1 || (meshes[0] as THREE.SkinnedMesh).isSkinnedMesh) throw new Error('Scenery must be one static mesh');
  const source = meshes[0], geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(source.geometry.attributes)) {
    const values = new Float32Array(attribute.count * attribute.itemSize);
    for (let i=0; i<attribute.count; i++) for (let k=0; k<attribute.itemSize; k++) values[i*attribute.itemSize+k]=attribute.getComponent(i,k);
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, attribute.itemSize));
  }
  if (source.geometry.index) geometry.setIndex(source.geometry.index.clone());
  geometry.applyMatrix4(source.matrixWorld);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, source.material);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}
