import * as THREE from 'three/webgpu';
import {abortable,encodedImageSize,fitTexture,serialQueue} from './asset-loading.ts';

type TextureImage=ImageBitmap|HTMLCanvasElement;
const closeImage=(image:TextureImage)=>{if('close' in image)image.close();};

function canvasCopy(image:CanvasImageSource,width:number,height:number,limit:number):HTMLCanvasElement {
  const size=fitTexture(width,height,limit),canvas=document.createElement('canvas');
  canvas.width=size.width;canvas.height=size.height;
  const context=canvas.getContext('2d');if(!context)throw Error('Cannot resize texture');
  context.drawImage(image,0,0,size.width,size.height);return canvas;
}

async function decodeViaImage(blob:Blob,limit:number,signal:AbortSignal):Promise<HTMLCanvasElement> {
  const image=new Image(),url=URL.createObjectURL(blob);
  try {
    await abortable(new Promise<void>((resolve,reject)=>{
      image.onload=()=>resolve();image.onerror=()=>reject(Error('Image decode failed'));image.src=url;
    }),signal);
    signal.throwIfAborted();return canvasCopy(image,image.naturalWidth,image.naturalHeight,limit);
  } finally {
    image.onload=image.onerror=null;image.src='';URL.revokeObjectURL(url);
  }
}

/** Resize before creating/uploading a GPU texture. Canvas fallback covers older Safari and ignored options. */
export async function decodeLimitedImage(blob:Blob,limit:number,signal:AbortSignal):Promise<TextureImage> {
  signal.throwIfAborted();
  if(typeof createImageBitmap==='function'){
    try {
      const header=new Uint8Array(await abortable(blob.slice(0,65536).arrayBuffer(),signal));
      const source=encodedImageSize(header),size=source?fitTexture(source.width,source.height,limit):{width:limit};
      const task=createImageBitmap(blob,{resizeWidth:size.width,...('height' in size?{resizeHeight:size.height}:{}),resizeQuality:'high',premultiplyAlpha:'none',colorSpaceConversion:'none',imageOrientation:'none'});
      // ImageBitmap decoding itself is not abortable: close a result arriving after its owner timed out.
      task.then(image=>{if(signal.aborted)image.close();},()=>{});
      const image=await abortable(task,signal);
      if(signal.aborted){image.close();signal.throwIfAborted();}
      if(image.width<=limit&&image.height<=limit)return image;
      try{return canvasCopy(image,image.width,image.height,limit);}finally{image.close();}
    } catch(error) {signal.throwIfAborted(); /* Older engines can reject bitmap resize options. */}
  }
  return decodeViaImage(blob,limit,signal);
}

/** GLTFLoader-compatible TextureLoader, with one decode active and a per-asset abort owner. */
export class LimitedTextureLoader extends THREE.Loader<THREE.Texture> {
  readonly pendingTextures=new Set<THREE.Texture>();
  private queue=serialQueue();
  private limit:number;
  private signal:AbortSignal;
  constructor(manager:THREE.LoadingManager,limit:number,signal:AbortSignal){super(manager);this.limit=limit;this.signal=signal;}
  override load(url:string,onLoad?:(texture:THREE.Texture)=>void,_onProgress?:(event:ProgressEvent)=>void,onError?:(error:unknown)=>void):THREE.Texture {
    const texture=new THREE.Texture();this.pendingTextures.add(texture);
    const resolved=this.manager.resolveURL(this.path+url);this.manager.itemStart(resolved);
    void this.queue(async()=>{
      this.signal.throwIfAborted();
      const response=await fetch(resolved,{signal:this.signal,credentials:this.crossOrigin==='anonymous'?'same-origin':'include',headers:this.requestHeader});
      if(!response.ok)throw Error(`Texture HTTP ${response.status}`);
      const image=await decodeLimitedImage(await response.blob(),this.limit,this.signal);
      if(this.signal.aborted){closeImage(image);this.signal.throwIfAborted();}
      texture.image=image;texture.needsUpdate=true;onLoad?.(texture);
    }).catch(error=>{texture.dispose();onError?.(error);this.manager.itemError(resolved);}).finally(()=>{
      // GLB image URLs belong to this one parser; free them on failure as well as success.
      if(resolved.startsWith('blob:'))URL.revokeObjectURL(resolved);
      this.manager.itemEnd(resolved);
    });
    return texture;
  }
  disposePending(){for(const texture of this.pendingTextures){const image=texture.image as TextureImage|undefined;if(image)closeImage(image);texture.dispose();}this.pendingTextures.clear();}
}
