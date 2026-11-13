// Bounded resource work and measured progress; no renderer or browser is required by these helpers.
export type AssetLoadProgress = {
  completed:number; total:number; loaded:number; failed:number;
  receivedBytes:number; totalBytes:number; current:string|null;
  phase:'fetch'|'decode'|'done';
};
export const assetLoadPolicy=(mobile:boolean)=>({
  parallelAssets:mobile?1:2,
  heroTextureLimit:mobile?1024:Infinity,
  sceneryTextureLimit:mobile?512:Infinity,
});

export function fitTexture(width:number,height:number,limit:number):{width:number;height:number} {
  if(width<=0||height<=0||!Number.isFinite(width+height)||limit<1)throw Error('Invalid texture dimensions');
  const scale=Math.min(1,limit/Math.max(width,height));
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}

/** Read common embedded-image dimensions without allocating a full-resolution decoded image. */
export function encodedImageSize(bytes:Uint8Array):{width:number;height:number}|null {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),size=(width:number,height:number)=>width>0&&height>0?{width,height}:null;
  if(bytes.length>=24&&view.getUint32(0)===0x89504e47&&view.getUint32(4)===0x0d0a1a0a)return size(view.getUint32(16),view.getUint32(20));
  if(bytes.length>=30&&view.getUint32(0)===0x52494646&&view.getUint32(8)===0x57454250){
    const tag=view.getUint32(12),u24=(i:number)=>bytes[i]+(bytes[i+1]<<8)+(bytes[i+2]<<16);
    if(tag===0x56503858)return size(u24(24)+1,u24(27)+1); // VP8X
    if(tag===0x56503820&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a)return size(view.getUint16(26,true)&0x3fff,view.getUint16(28,true)&0x3fff);
  }
  if(bytes.length>=25&&view.getUint32(0)===0x52494646&&view.getUint32(8)===0x57454250&&view.getUint32(12)===0x5650384c&&bytes[20]===0x2f){const bits=view.getUint32(21,true);return size((bits&0x3fff)+1,((bits>>>14)&0x3fff)+1);}
  if(bytes.length>=4&&bytes[0]===0xff&&bytes[1]===0xd8){
    let p=2;
    while(p+3<bytes.length){
      if(bytes[p++]!==0xff)return null;while(bytes[p]===0xff)p++;
      const marker=bytes[p++];if(marker===0xd9||marker===0xda)return null;
      if(marker===1||(marker>=0xd0&&marker<=0xd7))continue;
      if(p+2>bytes.length)return null;const length=view.getUint16(p);
      if(length<2||p+length>bytes.length)return null;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=7)return size(view.getUint16(p+5),view.getUint16(p+3));
      p+=length;
    }
  }
  return null;
}

/** Reject promptly on abort and remove listeners after success/error. The underlying owner cancels work. */
export function abortable<T>(task:Promise<T>,signal:AbortSignal):Promise<T> {
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason??new DOMException('Aborted','AbortError'));
    signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted)abort();
    task.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}

/** Single pre-sized buffer; never retain a chunk list plus a second full concatenated copy. */
export async function readAssetBody(response:Response,expectedBytes:number,onBytes:(bytes:number)=>void,signal:AbortSignal):Promise<ArrayBuffer> {
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  if(!Number.isSafeInteger(expectedBytes)||expectedBytes<=0)throw Error('Invalid asset size');
  signal.throwIfAborted();
  if(!response.body){
    const result=await abortable(response.arrayBuffer(),signal);onBytes(result.byteLength);
    if(result.byteLength!==expectedBytes)throw Error('Unexpected asset size');return result;
  }
  const result=new Uint8Array(expectedBytes),reader=response.body.getReader();let offset=0;
  const abort=()=>{void reader.cancel(signal.reason).catch(()=>{});};
  signal.addEventListener('abort',abort,{once:true});
  try {
    while(true){
      const {done,value}=await abortable(reader.read(),signal);signal.throwIfAborted();
      if(done)break;
      onBytes(value.byteLength);
      if(offset+value.byteLength>expectedBytes)throw Error('Unexpected asset size');
      result.set(value,offset);offset+=value.byteLength;
    }
    if(offset!==expectedBytes)throw Error('Unexpected asset size');
    return result.buffer;
  } finally {
    signal.removeEventListener('abort',abort);
    if(offset!==expectedBytes||signal.aborted)await reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
}

/** Serialize image decodes within one mobile GLB, including its PBR maps. */
export function serialQueue(){
  let tail:Promise<unknown>=Promise.resolve();
  return <T>(job:()=>Promise<T>):Promise<T>=>{
    const result=tail.then(job,job);tail=result.catch(()=>{});return result;
  };
}
