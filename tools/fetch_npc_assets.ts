// Node 24. Reviewed proprietary binaries remain outside the MIT source repository.
import {createHash,randomUUID} from 'node:crypto';
import {linkSync,lstatSync,mkdirSync,readFileSync,realpathSync,unlinkSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {checkFaunaGLB} from './fetch_fauna_assets.ts';

const HOST='https://grand-testament-assets.vercel.app/';
const SOURCE='1a7aca8ebaf995ee409eca8a67c35b3534cca4d1ba8c09ce43af1970cd494793';
type Profile={url:string;expectedBytes:number;sha256:string;textureMaxSize:number};
type Catalog={schemaVersion:number;id:string;approval:string;sourceSha256:string;units:string;nativeForward:string;groundY:number;
  animation:{idle:string;walk:string;walkSpeedMps:number};profiles:{desktop:Profile;mobile:Profile}};
type Download={file:string;url:string;bytes:number;sha256:string;profile:'desktop'|'mobile'};
type Options={publicRoot:string;host?:string;fetch?:typeof fetch;timeoutMs?:number;signal?:AbortSignal};
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');

/** Fail closed before network or writes; pending actors and remote catalogue URLs are not admissions. */
export function reviewedNpcDownloads(catalog:Catalog,host=HOST):readonly Download[]{
  if(host!==HOST)throw Error('NPC binaries require the reviewed HTTPS asset host');
  if(catalog?.schemaVersion!==1||catalog.id!=='simao-r12'||catalog.approval!=='reviewed-integration-candidate'||catalog.sourceSha256!==SOURCE)
    throw Error('NPC source or review state is not admitted');
  if(catalog.units!=='meters'||catalog.nativeForward!=='-Z'||catalog.groundY!==0||catalog.animation?.idle!=='simao-idle-r11'||
    catalog.animation.walk!=='simao-walk-r11'||catalog.animation.walkSpeedMps!==.70)throw Error('Unexpected NPC coordinate/animation contract');
  return(['desktop','mobile'] as const).map(profile=>{
    const spec=catalog.profiles?.[profile],limit=profile==='desktop'?1024:512,maxBytes=profile==='desktop'?2000000:1000000;
    if(!spec||spec.textureMaxSize!==limit)throw Error('NPC requires explicit reviewed desktop and mobile profiles');
    if(typeof spec.sha256!=='string'||! /^[a-f0-9]{64}$/.test(spec.sha256))throw Error('NPC requires lowercase SHA-256');
    if(!Number.isSafeInteger(spec.expectedBytes)||spec.expectedBytes<28||spec.expectedBytes>maxBytes)throw Error('NPC byte budget exceeded');
    const expected=`models/npc-r12/simao-r12-${limit}-${spec.sha256.slice(0,12)}.glb`;
    if(spec.url!==expected)throw Error('Unsafe NPC path or filename/hash mismatch');
    return{profile,file:expected,url:new URL(expected,host).href,bytes:spec.expectedBytes,sha256:spec.sha256};
  });
}

/** Reuses the established URI guard; adds complete BIN/layout checks for the pinned NPC container. */
export function checkNpcGLB(bytes:Uint8Array):void{
  checkFaunaGLB(bytes);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),jsonSize=view.getUint32(12,true);
  const json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(20,20+jsonSize)));
  const binOffset=20+jsonSize;
  if(binOffset+8>bytes.length||view.getUint32(binOffset+4,true)!==0x004e4942)throw Error('NPC GLB requires embedded BIN');
  const binSize=view.getUint32(binOffset,true);
  if(binSize%4!==0||binOffset+8+binSize!==bytes.length||json.buffers?.length!==1||
    !Number.isSafeInteger(json.buffers[0].byteLength)||json.buffers[0].byteLength<0||
    json.buffers[0].byteLength>binSize||binSize-json.buffers[0].byteLength>3)throw Error('Invalid NPC BIN bounds');
  if(!Array.isArray(json.bufferViews)||!Array.isArray(json.images))throw Error('Missing NPC embedded resources');
  for(const v of json.bufferViews){const offset=v.byteOffset??0;
    if(v.buffer!==0||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(v.byteLength)||v.byteLength<0||offset+v.byteLength>json.buffers[0].byteLength)
      throw Error('NPC bufferView exceeds BIN');
  }
  for(const image of json.images)if(!Number.isSafeInteger(image.bufferView)||!json.bufferViews[image.bufferView])throw Error('NPC image is not embedded');
  if(json.skins?.length!==1||json.skins[0].joints?.length!==22||json.animations?.length!==2||
    !['simao-idle-r11','simao-walk-r11'].every(name=>json.animations.some((clip:{name?:string})=>clip.name===name)))throw Error('NPC rig/clip contract mismatch');
}
function verify(bytes:Uint8Array,asset:Download){
  if(bytes.length!==asset.bytes||sha(bytes)!==asset.sha256)throw Error(`NPC integrity mismatch; preserved: ${asset.file}`);
  checkNpcGLB(bytes);
}
function optionalStat(file:string){try{return lstatSync(file);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}
function directory(file:string){const stat=optionalStat(file);
  if(stat&&(stat.isSymbolicLink()||!stat.isDirectory()))throw Error('NPC destination is not an ordinary directory');
  if(!stat)mkdirSync(file);
}
function bounded<T>(task:Promise<T>,signal:AbortSignal):Promise<T>{
  if(signal.aborted){void task.catch(()=>{});return Promise.reject(signal.reason);}
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});
    task.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}
async function receive(asset:Download,fetcher:typeof fetch,timeoutMs:number,external?:AbortSignal):Promise<Uint8Array>{
  const controller=new AbortController(),signal=external?AbortSignal.any([external,controller.signal]):controller.signal;
  const timer=setTimeout(()=>controller.abort(Error('NPC download timed out')),timeoutMs);
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  try{
    signal.throwIfAborted();const request=fetcher(asset.url,{redirect:'error',signal});
    void request.then(response=>{if(signal.aborted)void response.body?.cancel().catch(()=>{});},()=>{});
    const response=await bounded(request,signal);
    if(!response.ok||response.redirected||(response.url&&response.url!==asset.url))throw Error(`NPC HTTP/source mismatch: ${response.status}`);
    const declared=response.headers.get('content-length');
    if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>2000000))throw Error('NPC response exceeds byte budget');
    if(declared!==null&&!response.headers.has('content-encoding')&&Number(declared)!==asset.bytes)throw Error('NPC Content-Length differs from catalogue');
    if(!response.body)throw Error('Empty NPC response');reader=response.body.getReader();
    const parts:Uint8Array[]=[];let size=0;
    for(;;){const{done,value}=await bounded(reader.read(),signal);if(done)break;size+=value.byteLength;
      if(size>asset.bytes)throw Error('NPC streamed body exceeds reviewed size');parts.push(value);}
    if(size!==asset.bytes)throw Error('Truncated NPC download');
    const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
    verify(bytes,asset);signal.throwIfAborted();return bytes;
  }finally{clearTimeout(timer);controller.abort();if(reader)void reader.cancel().catch(()=>{});}
}

export async function fetchNpcAssets(catalog:Catalog,options:Options){
  const downloads=reviewedNpcDownloads(catalog,options.host),timeout=options.timeoutMs??30000;
  if(!Number.isFinite(timeout)||timeout<1||timeout>60000)throw Error('Invalid NPC timeout');
  options.signal?.throwIfAborted();
  const root=resolve(options.publicRoot),stat=optionalStat(root);
  if(!stat?.isDirectory()||stat.isSymbolicLink())throw Error('NPC public root must be an existing ordinary directory');
  directory(join(root,'models'));directory(join(root,'models','npc-r12'));
  if(realpathSync(join(root,'models','npc-r12'))!==join(realpathSync(root),'models','npc-r12'))throw Error('NPC destination escapes public root');
  const present=new Set<string>();
  // Check every existing file before downloading anything; never replace a divergent local binary.
  for(const asset of downloads){const target=join(root,...asset.file.split('/')),existing=optionalStat(target);
    if(existing){if(existing.isSymbolicLink()||!existing.isFile()||existing.size!==asset.bytes)throw Error(`Existing NPC differs; preserved: ${asset.file}`);
      verify(readFileSync(target),asset);present.add(asset.file);}}
  let downloadedBytes=0;
  for(const asset of downloads){options.signal?.throwIfAborted();if(present.has(asset.file))continue;
    const bytes=await receive(asset,options.fetch??fetch,timeout,options.signal);options.signal?.throwIfAborted();
    const target=join(root,...asset.file.split('/')),temporary=join(dirname(target),`.${randomUUID()}.part`);
    writeFileSync(temporary,bytes,{flag:'wx'});
    try{linkSync(temporary,target);}finally{unlinkSync(temporary);}downloadedBytes+=bytes.length;
  }
  return{files:downloads.length,downloadedBytes,verifiedBytes:downloads.reduce((sum,item)=>sum+item.bytes,0),license:'NPC binaries are separate from MIT code'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const catalog=JSON.parse(readFileSync(new URL('../src/data/npc-assets.json',import.meta.url),'utf8'));
  const host=JSON.parse(readFileSync(new URL('../src/data/asset-host.json',import.meta.url),'utf8')).url;
  console.log(JSON.stringify(await fetchNpcAssets(catalog,{host,publicRoot:fileURLToPath(new URL('../public',import.meta.url))})));
}
