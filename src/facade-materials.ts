import * as THREE from 'three/webgpu';
import catalog from './data/facade-materials-r13.json' with {type:'json'};
import {readAssetBody,encodedImageSize,abortable} from './asset-loading.ts';
import {decodePbrMap} from './ground-materials.ts';

export type FacadeMaps={map:THREE.Texture;normalMap:THREE.Texture;roughnessMap:THREE.Texture};
export const FACADE_MATERIAL_CREDIT={name:'Rough Wood',author:catalog.author,url:catalog.assetUrl,license:catalog.license};

/** Same-origin reviewed images, one decode at a time, owned by startup until success. */
export async function loadFacadeMaterials(mobile:boolean,parent?:AbortSignal):Promise<FacadeMaps>{
  const controller=new AbortController(),signal=controller.signal,abort=()=>controller.abort(parent?.reason);
  parent?.addEventListener('abort',abort,{once:true});if(parent?.aborted)abort();
  const timer=setTimeout(()=>controller.abort(new DOMException('Facade materials timed out','TimeoutError')),20000);
  const result={} as FacadeMaps,profile=mobile?catalog.profiles.mobile:catalog.profiles.desktop;
  try{
    for(const role of ['map','normalMap','roughnessMap'] as const){
      const entry=profile[role];signal.throwIfAborted();
      const response=await fetch(`${import.meta.env.BASE_URL}${entry.url}`,{signal,credentials:'same-origin'});
      const bytes=await readAssetBody(response,entry.bytes,()=>{},signal);
      const digest=await abortable(crypto.subtle.digest('SHA-256',bytes),signal);
      const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
      const size=encodedImageSize(new Uint8Array(bytes));
      if(hash!==entry.sha256||size?.width!==entry.size||size.height!==entry.size)throw Error(`Facade material integrity mismatch: ${role}`);
      const decoded=await decodePbrMap(new Blob([bytes],{type:'image/webp'}),signal);
      if(signal.aborted){decoded.close();signal.throwIfAborted();}
      const map=new THREE.Texture(decoded.image);map.name=`rough-wood-${role}`;map.flipY=decoded.flipY;
      map.colorSpace=role==='map'?THREE.SRGBColorSpace:THREE.NoColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
      map.anisotropy=mobile?2:8;map.needsUpdate=true;map.addEventListener('dispose',decoded.close);
      map.userData={sha256:entry.sha256,encodedBytes:entry.bytes,size:entry.size};result[role]=map;
    }
    return result;
  }catch(error){controller.abort(error);for(const map of Object.values(result))map.dispose();throw error;}
  finally{clearTimeout(timer);parent?.removeEventListener('abort',abort);}
}
