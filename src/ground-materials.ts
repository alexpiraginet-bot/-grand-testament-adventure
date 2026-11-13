import * as THREE from 'three/webgpu';
import catalog from './data/ground-materials-r13.json' with {type:'json'};
import {abortable,encodedImageSize,readAssetBody} from './asset-loading.ts';

export type GroundMaterialMapsR13={dirtAlbedo:THREE.Texture;dirtNormalRoughness:THREE.Texture;sandAlbedo:THREE.Texture;sandNormalRoughness:THREE.Texture};
export const GROUND_MATERIAL_CREDITS_R13=[
  {name:'Dirt',author:'Charlotte Baglioni',url:'https://polyhaven.com/a/dirt',license:'CC0-1.0'},
  {name:'Damp Beach Sand',author:'Dimitrios Savva',url:'https://polyhaven.com/a/damp_beach_sand',license:'CC0-1.0'},
] as const;
export function groundMaterialProfile(mobile:boolean){return mobile?catalog.profiles.mobile:catalog.profiles.desktop;}
type Decoded={image:ImageBitmap|HTMLImageElement;flipY:boolean;close:()=>void};
export {decodeMap as decodePbrMap};

async function decodeMap(blob:Blob,signal:AbortSignal):Promise<Decoded>{
  if(typeof createImageBitmap==='function'){
    try{
      // A normal map's alpha contains roughness, not opacity. Never premultiply or colour-convert it.
      const task=createImageBitmap(blob,{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
      task.then(image=>{if(signal.aborted)image.close();},()=>{});
      const image=await abortable(task,signal);signal.throwIfAborted();
      return{image,flipY:false,close:()=>image.close()};
    }catch(error){signal.throwIfAborted();/* Older Safari can reject the bitmap options. */}
  }
  const image=new Image(),url=URL.createObjectURL(blob);
  try{
    await abortable(new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Ground image decode failed'));image.src=url;}),signal);
    signal.throwIfAborted();
    return{image,flipY:true,close:()=>{image.src='';}};
  }finally{image.onload=image.onerror=null;URL.revokeObjectURL(url);if(signal.aborted)image.src='';}
}

/** Four sequential, bounded, hash-checked textures. The returned flat map is owned by the caller. */
export async function loadGroundMaterialsR13(options:{mobile:boolean;signal?:AbortSignal;base?:string;timeoutMs?:number}):Promise<GroundMaterialMapsR13>{
  const base=options.base??import.meta.env?.BASE_URL??'/';
  if(!/^(?:\/|\.\/)(?:[a-zA-Z0-9_-]+\/)*$/.test(base))throw Error('Ground material base must remain same-origin');
  const timeoutMs=options.timeoutMs??20000;
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('Invalid ground material timeout');
  const controller=new AbortController(),signal=controller.signal;
  const abort=()=>controller.abort(options.signal?.reason);
  options.signal?.addEventListener('abort',abort,{once:true});
  if(options.signal?.aborted)abort();
  const timer=setTimeout(()=>controller.abort(new DOMException('Ground materials timed out','TimeoutError')),timeoutMs);
  const profile=groundMaterialProfile(options.mobile),result={} as GroundMaterialMapsR13;
  try{
    for(const entry of profile.files){
      signal.throwIfAborted();
      const response=await fetch(base+entry.path,{signal,credentials:'same-origin'});
      const buffer=await readAssetBody(response,entry.bytes,()=>{},signal);
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
      if(hash!==entry.sha256)throw Error('Ground material hash mismatch: '+entry.key);
      const dimensions=encodedImageSize(new Uint8Array(buffer));
      if(dimensions?.width!==profile.textureMax||dimensions.height!==profile.textureMax)throw Error('Ground material dimensions exceed pinned profile');
      const decoded=await decodeMap(new Blob([buffer],{type:'image/webp'}),signal);
      if(signal.aborted){decoded.close();signal.throwIfAborted();}
      if(decoded.image.width!==profile.textureMax||decoded.image.height!==profile.textureMax){decoded.close();throw Error('Decoded ground material dimensions differ');}
      const map=new THREE.Texture(decoded.image);map.name=entry.key;map.flipY=decoded.flipY;
      map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=options.mobile?2:8;
      map.colorSpace=entry.colorSpace==='srgb'?THREE.SRGBColorSpace:THREE.NoColorSpace;
      map.premultiplyAlpha=false;map.needsUpdate=true;
      map.userData={sourceId:entry.sourceId,sha256:entry.sha256,encodedBytes:entry.bytes,textureMax:profile.textureMax};
      map.addEventListener('dispose',decoded.close);
      result[entry.key as keyof GroundMaterialMapsR13]=map;
    }
    signal.throwIfAborted();return result;
  }catch(error){
    controller.abort(error);for(const map of Object.values(result))map.dispose();throw error;
  }finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}
