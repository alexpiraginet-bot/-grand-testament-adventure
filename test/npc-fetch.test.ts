import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,symlinkSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkNpcGLB,fetchNpcAssets,reviewedNpcDownloads} from '../tools/fetch_npc_assets.ts';

function glb(extra:Record<string,unknown>={}){
  const document={asset:{version:'2.0'},buffers:[{byteLength:4}],bufferViews:[{buffer:0,byteOffset:0,byteLength:4}],images:[],
    skins:[{joints:Array.from({length:22},(_,i)=>i)}],animations:[{name:'simao-idle-r11'},{name:'simao-walk-r11'}],...extra};
  const json=Buffer.from(JSON.stringify(document)),length=Math.ceil(json.length/4)*4,bytes=Buffer.alloc(32+length);
  bytes.writeUInt32LE(0x46546c67);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);
  bytes.writeUInt32LE(length,12);bytes.writeUInt32LE(0x4e4f534a,16);bytes.fill(32,20,20+length);json.copy(bytes,20);
  bytes.writeUInt32LE(4,20+length);bytes.writeUInt32LE(0x004e4942,24+length);return bytes;
}
function catalog(bytes=glb()){
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const spec=(size:number)=>({url:`models/npc-r12/simao-r12-${size}-${sha256.slice(0,12)}.glb`,sha256,expectedBytes:bytes.length,textureMaxSize:size});
  return{schemaVersion:1,id:'simao-r12',approval:'reviewed-integration-candidate',sourceSha256:'1a7aca8ebaf995ee409eca8a67c35b3534cca4d1ba8c09ce43af1970cd494793',
    units:'meters',nativeForward:'-Z',groundY:0,animation:{idle:'simao-idle-r11',walk:'simao-walk-r11',walkSpeedMps:.7},profiles:{desktop:spec(1024),mobile:spec(512)}};
}
function folder(t:TestContext){
  const parent=resolve(fileURLToPath(new URL('../assets-src/npc-fetch-tests/',import.meta.url)));mkdirSync(parent,{recursive:true});
  const root=mkdtempSync(join(parent,'test-'));
  t.after(()=>{assert.equal(dirname(resolve(root)),parent);rmSync(root,{recursive:true,force:true});});return root;
}
const body=(bytes:Uint8Array)=>new Uint8Array(bytes);
test('catalogue requires the admitted source, animation and both explicit texture profiles',()=>{
  assert.equal(reviewedNpcDownloads(catalog()).length,2);
  for(const change of [{approval:'pending'},{id:'andre-r12'},{sourceSha256:'0'.repeat(64)},{nativeForward:'+Z'},{groundY:1}])
    assert.throws(()=>reviewedNpcDownloads({...catalog(),...change}),/not admitted|contract/);
  const c=catalog();c.profiles.mobile.textureMaxSize=1024;assert.throws(()=>reviewedNpcDownloads(c),/explicit/);
  assert.throws(()=>reviewedNpcDownloads(catalog(),'https://grand-testament-assets.vercel.app.evil.invalid/'),/host/);
});
test('unsafe paths, hashes and oversized budgets fail before writes or requests',async t=>{
  const root=folder(t);
  for(const url of ['../model.glb','/models/npc-r12/a.glb','https://evil.invalid/x.glb','models\\npc-r12\\x.glb','models/npc-r12/a%2f.glb',`${catalog().profiles.desktop.url}?x=1`]){
    const c=catalog();c.profiles.desktop.url=url;
    await assert.rejects(fetchNpcAssets(c,{publicRoot:root,fetch:()=>{throw Error('No network expected');}}),/Unsafe/);
  }
  for(const expectedBytes of [0,2000001,Infinity,2.5]){const c=catalog();c.profiles.desktop.expectedBytes=expectedBytes;assert.throws(()=>reviewedNpcDownloads(c),/budget/);}
  const bad=catalog();bad.profiles.desktop.sha256='XYZ';assert.throws(()=>reviewedNpcDownloads(bad),/SHA/);
  assert.deepEqual(readdirSync(root),[]);
});
test('downloads sequentially, verifies both profiles, and reuses exact local files',async t=>{
  const root=folder(t),bytes=glb(),c=catalog(bytes);let calls=0,active=0;
  const fetcher:typeof fetch=async(url,options)=>{assert.equal(active++,0);calls++;assert.equal(options?.redirect,'error');assert.ok(options.signal);
    assert.ok(String(url).startsWith('https://grand-testament-assets.vercel.app/models/npc-r12/'));
    await new Promise(resolve=>setTimeout(resolve,2));active--;
    return new Response(body(bytes),{headers:{'content-length':String(bytes.length)}});};
  const first=await fetchNpcAssets(c,{publicRoot:root,fetch:fetcher});assert.equal(first.downloadedBytes,2*bytes.length);
  const second=await fetchNpcAssets(c,{publicRoot:root,fetch:fetcher});assert.equal(second.downloadedBytes,0);assert.equal(calls,2);
  for(const spec of Object.values(c.profiles))assert.deepEqual(readFileSync(join(root,spec.url)),bytes);
  assert.equal(readdirSync(join(root,'models/npc-r12')).length,2);
});
test('a divergent second profile is preserved and blocks any first-profile download',async t=>{
  const root=folder(t),c=catalog(),target=join(root,c.profiles.mobile.url),original=Buffer.alloc(c.profiles.mobile.expectedBytes,5);
  mkdirSync(dirname(target),{recursive:true});writeFileSync(target,original);
  await assert.rejects(fetchNpcAssets(c,{publicRoot:root,fetch:()=>{throw Error('No network expected');}}),/integrity mismatch/);
  assert.deepEqual(readFileSync(target),original);assert.equal(readdirSync(dirname(target)).length,1);
});
test('junction or symlink destinations are rejected without writing through them',async t=>{
  const root=folder(t),outside=join(root,'outside');mkdirSync(outside);symlinkSync(outside,join(root,'models'),'junction');
  await assert.rejects(fetchNpcAssets(catalog(),{publicRoot:root,fetch:()=>{throw Error('No network expected');}}),/ordinary directory/);
  assert.deepEqual(readdirSync(outside),[]);
});
test('redirects, HTTP failures and unexpected source URLs never admit a file',async t=>{
  const root=folder(t);
  for(const status of [302,404,500])await assert.rejects(fetchNpcAssets(catalog(),{publicRoot:root,fetch:async()=>new Response('',{status})}),/HTTP/);
  const redirected=new Response(body(glb()));Object.defineProperty(redirected,'redirected',{value:true});
  await assert.rejects(fetchNpcAssets(catalog(),{publicRoot:root,fetch:async()=>redirected}),/HTTP/);
  const other=new Response(body(glb()));Object.defineProperty(other,'url',{value:'https://evil.invalid/x'});
  await assert.rejects(fetchNpcAssets(catalog(),{publicRoot:root,fetch:async()=>other}),/HTTP/);
  assert.deepEqual(readdirSync(join(root,'models/npc-r12')),[]);
});
test('truncated, excess and corrupt streams leave no partial runtime file',async t=>{
  const root=folder(t),bytes=glb();
  for(const invalid of [bytes.subarray(0,-1),Buffer.concat([bytes,Buffer.from([1])]),Buffer.alloc(bytes.length)])
    await assert.rejects(fetchNpcAssets(catalog(),{publicRoot:root,fetch:async()=>new Response(body(invalid))}),/Truncated|exceeds|integrity/);
  await assert.rejects(fetchNpcAssets(catalog(),{publicRoot:root,fetch:async()=>new Response(body(bytes),{headers:{'content-length':'99999999'}})}),/budget/);
  assert.deepEqual(readdirSync(join(root,'models/npc-r12')),[]);
});
test('external and data URIs, malformed BIN bounds and missing clips fail despite matching hash',async t=>{
  const root=folder(t);
  for(const uri of ['https://evil.invalid/t.webp','data:image/webp;base64,AA==','']){
    const bytes=glb({images:[{uri}]});await assert.rejects(fetchNpcAssets(catalog(bytes),{publicRoot:root,fetch:async()=>new Response(body(bytes))}),/URI/);
  }
  assert.throws(()=>checkNpcGLB(glb({buffers:[{byteLength:999}]})),/BIN/);
  assert.throws(()=>checkNpcGLB(glb({bufferViews:[{buffer:0,byteOffset:2,byteLength:99}]})),/bufferView/);
  assert.throws(()=>checkNpcGLB(glb({animations:[{name:'pose'}]})),/clip/);
});
test('timeouts bound ignored AbortSignals and stalled streams; external cancellation is terminal',async t=>{
  const root=folder(t);
  await assert.rejects(fetchNpcAssets(catalog(),{publicRoot:root,timeoutMs:20,fetch:()=>new Promise(()=>{})}),/timed out/);
  let cancelled=false;
  await assert.rejects(fetchNpcAssets(catalog(),{publicRoot:root,timeoutMs:20,fetch:async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}))}),/timed out/);
  assert.equal(cancelled,true);
  const controller=new AbortController(),pending=fetchNpcAssets(catalog(),{publicRoot:root,signal:controller.signal,fetch:()=>new Promise(()=>{})});
  controller.abort(Error('test cancelled'));await assert.rejects(pending,/test cancelled/);
  assert.deepEqual(readdirSync(join(root,'models/npc-r12')),[]);
});
test('concurrent destination creation is never overwritten and temp files are removed',async t=>{
  const root=folder(t),bytes=glb(),c=catalog(bytes),target=join(root,c.profiles.desktop.url),other=Buffer.from('owned by another task');
  await assert.rejects(fetchNpcAssets(c,{publicRoot:root,fetch:async()=>{writeFileSync(target,other,{flag:'wx'});return new Response(body(bytes));}}),/EEXIST/);
  assert.deepEqual(readFileSync(target),other);assert.equal(readdirSync(dirname(target)).length,1);
});
