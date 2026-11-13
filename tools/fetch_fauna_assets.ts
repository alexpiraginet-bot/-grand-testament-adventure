// Node 24, CPU only. Reviewed game binaries remain separate from the MIT code.
import {createHash,randomUUID} from 'node:crypto';
import {linkSync,lstatSync,mkdirSync,readFileSync,realpathSync,unlinkSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const HOST='https://grand-testament-assets.vercel.app/';
const MAX_ASSET_BYTES=32*1024**2,MAX_TOTAL_BYTES=128*1024**2;
const KINDS=new Set(['chicken','donkey','sheep','goat','fish']);
type Asset={kind:string;status:string;url:string;expectedBytes:number;sha256?:string};
type Profile={kind:string;desktop?:Asset;mobile?:Asset};
type Download={file:string;url:string;bytes:number;sha256:string;uses:string[]};
type Options={publicRoot:string;host?:string;fetch?:typeof fetch;timeoutMs?:number};
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');

/** Validate the entire catalogue before any network request or write. Pending is not approval. */
export function reviewedFaunaDownloads(profiles:readonly Profile[],host=HOST):readonly Download[]{
  if(host!==HOST)throw Error('Fauna binaries require the reviewed HTTPS asset host');
  if(!Array.isArray(profiles)||profiles.length>KINDS.size)throw Error('Invalid fauna profile count');
  const downloads=new Map<string,Download>(),species=new Set<string>();
  for(const profile of profiles){
    if(!KINDS.has(profile.kind)||species.has(profile.kind))throw Error('Invalid or duplicate fauna species');
    species.add(profile.kind);
    for(const quality of ['desktop','mobile'] as const){
      const spec=profile[quality];if(!spec||spec.status!=='approved')continue;
      if(spec.kind!==profile.kind)throw Error('Fauna profile species mismatch');
      if(typeof spec.sha256!=='string'||! /^[a-f0-9]{64}$/.test(spec.sha256))throw Error('Approved fauna requires lowercase SHA-256');
      if(!Number.isSafeInteger(spec.expectedBytes)||spec.expectedBytes<20||spec.expectedBytes>MAX_ASSET_BYTES)throw Error('Fauna byte budget exceeded');
      // Local URL only: no query, encoded traversal, remote origin or Windows separator.
      if(!/^\/?models\/fauna-r8\/[a-z0-9]+(?:-[a-z0-9]+)*\.glb$/.test(spec.url))throw Error('Unsafe fauna asset path');
      const file=spec.url.replace(/^\//,'');
      if(!file.endsWith(`-${spec.sha256.slice(0,12)}.glb`))throw Error('Fauna filename must contain reviewed hash prefix');
      const previous=downloads.get(file);
      if(previous){
        if(previous.bytes!==spec.expectedBytes||previous.sha256!==spec.sha256)throw Error('Conflicting fauna profiles for one file');
        previous.uses.push(`${profile.kind}:${quality}`);
      }else downloads.set(file,{file,url:new URL(file,host).href,bytes:spec.expectedBytes,sha256:spec.sha256,uses:[`${profile.kind}:${quality}`]});
    }
  }
  const result=[...downloads.values()];
  if(result.reduce((sum,a)=>sum+a.bytes,0)>MAX_TOTAL_BYTES)throw Error('Fauna total byte budget exceeded');
  return result;
}

/** Mirrors the runtime's self-contained requirement; this is not visual/rig approval. */
export function checkFaunaGLB(bytes:Uint8Array):void{
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength)
    throw Error('Invalid self-contained fauna GLB');
  const size=view.getUint32(12,true);
  if(view.getUint32(16,true)!==0x4e4f534a||size%4!==0||size>1024**2||20+size>bytes.byteLength)throw Error('Invalid fauna GLB JSON');
  const json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(20,20+size)));
  if(json.asset?.version!=='2.0'||!Array.isArray(json.buffers??[])||!Array.isArray(json.images??[]))throw Error('Invalid glTF document');
  if([...json.buffers??[],...json.images??[]].some(entry=>entry&&Object.hasOwn(entry,'uri')))throw Error('Fauna GLB must not contain external or data URI resources');
}

function verify(bytes:Uint8Array,asset:Download):void{
  if(bytes.length!==asset.bytes||sha(bytes)!==asset.sha256)throw Error(`Fauna integrity mismatch: ${asset.file}`);
  checkFaunaGLB(bytes);
}
function optionalStat(path:string){try{return lstatSync(path);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}
function directory(path:string):void{
  const stat=optionalStat(path);
  if(stat&&(stat.isSymbolicLink()||!stat.isDirectory()))throw Error(`Fauna directory is not an ordinary directory: ${path}`);
  if(!stat)mkdirSync(path); // Parent must already exist, so no unreviewed recursive traversal.
}
function withAbort<T>(task:Promise<T>,signal:AbortSignal):Promise<T>{
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});
    task.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}
async function receive(asset:Download,fetcher:typeof fetch,timeoutMs:number):Promise<Uint8Array>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('Fauna download timed out')),timeoutMs);
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  try{
    const response=await withAbort(fetcher(asset.url,{redirect:'error',signal:controller.signal}),controller.signal);
    if(!response.ok||response.redirected||(response.url&&response.url!==asset.url))throw Error(`Fauna HTTP/source mismatch: ${response.status}`);
    const declared=response.headers.get('content-length');
    if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_ASSET_BYTES))throw Error('Fauna response exceeds byte budget');
    if(declared!==null&&!response.headers.has('content-encoding')&&Number(declared)!==asset.bytes)throw Error('Fauna Content-Length differs from catalogue');
    if(!response.body)throw Error('Empty fauna response');
    reader=response.body.getReader();
    const chunks:Uint8Array[]=[];let size=0;
    for(;;){
      const {done,value}=await withAbort(reader.read(),controller.signal);if(done)break;
      size+=value.byteLength;if(size>asset.bytes)throw Error('Fauna streamed body exceeds reviewed size');chunks.push(value);
    }
    if(size!==asset.bytes)throw Error('Truncated fauna download');
    const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
    verify(bytes,asset);return bytes;
  }finally{
    clearTimeout(timer);controller.abort();
    // Do not await a potentially stalled underlying stream on failure.
    if(reader)void reader.cancel().catch(()=>{});
  }
}

export async function fetchFaunaAssets(profiles:readonly Profile[],options:Options){
  const downloads=reviewedFaunaDownloads(profiles,options.host);
  const timeout=options.timeoutMs??30000;
  if(!Number.isFinite(timeout)||timeout<1||timeout>60000)throw Error('Invalid fauna download timeout');
  if(!downloads.length)return{files:0,downloadedBytes:0,verifiedBytes:0,license:'Binary assets are separate from MIT code'};
  const root=resolve(options.publicRoot),stat=optionalStat(root);
  if(!stat?.isDirectory()||stat.isSymbolicLink())throw Error('Public root must be an existing ordinary directory');
  // Never follow a models/fauna-r8 junction or symlink out of the public root.
  directory(join(root,'models'));directory(join(root,'models','fauna-r8'));
  if(realpathSync(join(root,'models','fauna-r8'))!==join(realpathSync(root),'models','fauna-r8'))throw Error('Fauna destination escapes public root');
  let downloadedBytes=0,verifiedBytes=0;
  for(const asset of downloads){
    const target=join(root,...asset.file.split('/')),existing=optionalStat(target);
    if(existing){
      if(existing.isSymbolicLink()||!existing.isFile()||existing.size!==asset.bytes)throw Error(`Existing fauna asset differs; preserved: ${asset.file}`);
      verify(readFileSync(target),asset);verifiedBytes+=asset.bytes;continue;
    }
    const bytes=await receive(asset,options.fetch??fetch,timeout),temp=join(dirname(target),`.${randomUUID()}.part`);
    // Exclusive temp creation and hard-link publication cannot overwrite a concurrent file.
    writeFileSync(temp,bytes,{flag:'wx'});
    try{linkSync(temp,target);}finally{unlinkSync(temp);}
    downloadedBytes+=bytes.length;verifiedBytes+=bytes.length;
  }
  return{files:downloads.length,downloadedBytes,verifiedBytes,license:'Binary assets are separate from MIT code'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const {FAUNA_ASSET_PROFILES}=await import('../src/fauna-assets-manifest.ts');
  const host=JSON.parse(readFileSync(new URL('../src/data/asset-host.json',import.meta.url),'utf8')).url;
  const report=await fetchFaunaAssets(FAUNA_ASSET_PROFILES,{host,publicRoot:fileURLToPath(new URL('../public',import.meta.url))});
  console.log(JSON.stringify(report));
}
