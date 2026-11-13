import * as THREE from 'three/webgpu';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import roster from './data/tripo-assets.json';
import {assetLoadPolicy,abortable,readAssetBody,type AssetLoadProgress} from './asset-loading.ts';
import {LimitedTextureLoader} from './limited-textures.ts';
export type {AssetLoadProgress} from './asset-loading.ts';

export type AssetId = keyof typeof roster.assets;
export type AssetLibrary = Partial<Record<AssetId, GLTF>>;
export type AssetLoadOptions={mobile?:boolean;onProgress?:(progress:AssetLoadProgress)=>void;signal?:AbortSignal};
export async function loadTripoAssets({mobile=false,onProgress,signal}:AssetLoadOptions={}): Promise<AssetLibrary> {
  const assets: AssetLibrary = {};
  // Only selected runtime assets load; six A-pose NPCs are intentionally deferred until rigging.
  const ids = (Object.keys(roster.assets) as AssetId[]).filter(id => roster.assets[id].status === 'runtime');
  const policy=assetLoadPolicy(mobile),progress:AssetLoadProgress={completed:0,total:ids.length,loaded:0,failed:0,receivedBytes:0,totalBytes:ids.reduce((sum,id)=>sum+roster.assets[id].bytes,0),current:null,phase:'fetch'};
  const report=()=>{try{onProgress?.({...progress});}catch(error){console.warn('Asset progress callback failed',error);}};
  const batch=new AbortController(),batchTimer=setTimeout(()=>batch.abort(new DOMException('Asset loading timed out','TimeoutError')),120000);
  const cancel=()=>batch.abort(signal?.reason);
  signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
  report();
  // Mobile: one GLB and one image decode at a time. Desktop retains original image quality.
  let next = 0;
  try {await Promise.all(Array.from({ length: policy.parallelAssets }, async () => {
    while (next < ids.length) {
      const id = ids[next++], spec = roster.assets[id];
      const owner=new AbortController(),abort=()=>owner.abort(batch.signal.reason);
      batch.signal.addEventListener('abort',abort,{once:true});if(batch.signal.aborted)abort();
      const timer=setTimeout(()=>owner.abort(new DOMException(`Asset ${id} timed out`,'TimeoutError')),30000);
      const manager=new THREE.LoadingManager(),loader=new GLTFLoader(manager);let limited:LimitedTextureLoader|undefined,textureErrors=0;
      manager.onError=()=>{textureErrors++;};
      if(mobile)loader.register(parser=>{
        limited=new LimitedTextureLoader(manager,id==='heroi'?policy.heroTextureLimit:policy.sceneryTextureLimit,owner.signal);
        // GLTF's runtime contract accepts a loader producing Texture. Its narrower type assumes HTMLImageElement.
        parser.textureLoader=limited as unknown as THREE.TextureLoader;return{name:'GTA_mobile_texture_budget'};
      });
      try {
        owner.signal.throwIfAborted();progress.current=id;progress.phase='fetch';report();
        const response = await fetch(`${import.meta.env.BASE_URL}${spec.file}`, { signal: owner.signal });
        const buffer = await readAssetBody(response,spec.bytes,n=>{progress.receivedBytes+=n;progress.current=id;progress.phase='fetch';report();},owner.signal);
        const digest = await abortable(crypto.subtle.digest('SHA-256', buffer),owner.signal);
        const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
        if (hash !== spec.sha256) throw new Error('Asset integrity mismatch');
        owner.signal.throwIfAborted();progress.phase='decode';progress.current=id;report();
        const parsing=loader.parseAsync(buffer,'');
        parsing.then(result=>{if(owner.signal.aborted)disposeAsset(result);},()=>{});
        const result=await abortable(parsing,owner.signal);
        if(textureErrors){disposeAsset(result);throw Error(`Asset has ${textureErrors} failed textures`);}
        result.userData.loadingProfile=textureProfile(result,mobile,id==='heroi'?policy.heroTextureLimit:policy.sceneryTextureLimit);
        assets[id]=result;progress.loaded++;
      } catch (error) {
        owner.abort(error);limited?.disposePending();manager.abort();progress.failed++;
        console.warn(`Modelo ${id} indisponível; usando forma provisória.`, error);
      } finally {
        clearTimeout(timer);batch.signal.removeEventListener('abort',abort);progress.completed++;report();
      }
    }
  }));}finally{
    clearTimeout(batchTimer);signal?.removeEventListener('abort',cancel);
    if(signal?.aborted)disposeTripoAssets(assets);
    progress.phase='done';progress.current=null;report();
  }
  signal?.throwIfAborted();
  return assets;
}

export function disposeTripoAssets(assets:AssetLibrary){for(const asset of Object.values(assets))if(asset)disposeAsset(asset);}

/** Actual decoded image dimensions, not a claim about total GPU/browser memory. */
function textureProfile(asset:GLTF,mobile:boolean,limit:number){
  const images=new Set<{width:number;height:number}>();
  asset.scene.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])for(const value of Object.values(material)){
      const image=value?.isTexture?value.image:undefined;
      if(image&&Number.isFinite(image.width)&&Number.isFinite(image.height))images.add(image);
    }
  });
  const dimensions=[...images].map(image=>({width:image.width,height:image.height}));
  return{mobile,textureLimit:Number.isFinite(limit)?limit:null,images:dimensions,decodedPixels:dimensions.reduce((sum,p)=>sum+p.width*p.height,0)};
}

function disposeAsset(asset:GLTF){
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  asset.scene.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;geometries.add(mesh.geometry);for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(m);});
  for(const material of materials)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  for(const texture of textures){(texture.image as {close?:()=>void}|undefined)?.close?.();texture.dispose();}
  for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
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
