import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkFaunaGLB,fetchFaunaAssets,reviewedFaunaDownloads} from '../tools/fetch_fauna_assets.ts';

function glb(document:unknown={asset:{version:'2.0'}}){
  const json=Buffer.from(JSON.stringify(document)),length=Math.ceil(json.length/4)*4,bytes=Buffer.alloc(20+length,32);
  bytes.writeUInt32LE(0x46546c67,0);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);
  bytes.writeUInt32LE(length,12);bytes.writeUInt32LE(0x4e4f534a,16);json.copy(bytes,20);return bytes;
}
function spec(bytes=glb()){
  const sha256=createHash('sha256').update(bytes).digest('hex');
  return{kind:'chicken',status:'approved',url:`/models/fauna-r8/chicken-${sha256.slice(0,12)}.glb`,sha256,expectedBytes:bytes.length};
}
function folder(t:TestContext){
  const parent=resolve(fileURLToPath(new URL('../assets-src/fauna-fetch-tests/',import.meta.url)));
  mkdirSync(parent,{recursive:true});const result=mkdtempSync(join(parent,'test-'));
  t.after(()=>{assert.equal(dirname(resolve(result)),parent);rmSync(result,{recursive:true,force:true});});
  return result;
}
const catalog=(asset=spec())=>[{kind:'chicken',desktop:asset,mobile:asset}];
const asBody=(bytes:Uint8Array)=>new Uint8Array(bytes);
test('catalogue deduplicates reviewed profiles and never invents a mobile fallback',()=>{
  assert.equal(reviewedFaunaDownloads(catalog()).length,1);
  assert.deepEqual(reviewedFaunaDownloads(catalog())[0].uses,['chicken:desktop','chicken:mobile']);
  assert.deepEqual(reviewedFaunaDownloads([{kind:'chicken',desktop:spec()}])[0].uses,['chicken:desktop']);
});
test('pending models make no request or filesystem write',async()=>{
  const result=await fetchFaunaAssets(catalog({...spec(),status:'pending'}),{publicRoot:'does-not-exist',fetch:()=>{throw Error('must not fetch');}});
  assert.equal(result.files,0);assert.equal(result.downloadedBytes,0);
});
test('rejects path traversal, outside origins, queries and hashes before network',async t=>{
  const root=folder(t),bad=['/models/fauna-r8/../secret.glb','https://evil.invalid/x.glb','//evil.invalid/x.glb','models/fauna-r8/a%2f.glb','models\\fauna-r8\\x.glb',`${spec().url}?token=x`];
  for(const url of bad)await assert.rejects(fetchFaunaAssets(catalog({...spec(),url}),{publicRoot:root,fetch:()=>{throw Error('must not fetch');}}),/Unsafe/);
  assert.throws(()=>reviewedFaunaDownloads([{kind:'chicken',desktop:{...spec(),sha256:undefined}}]),/SHA/);
  assert.throws(()=>reviewedFaunaDownloads(catalog({...spec(),url:'/models/fauna-r8/chicken-wrong.glb'})),/hash prefix/);
  assert.throws(()=>reviewedFaunaDownloads(catalog(),'https://grand-testament-assets.vercel.app.evil.invalid/'),/host/);
  assert.deepEqual(readdirSync(root),[]);
});
test('budgets and conflicting catalogue entries fail closed',()=>{
  for(const expectedBytes of [NaN,Infinity,0,33*1024**2,25.5])assert.throws(()=>reviewedFaunaDownloads(catalog({...spec(),expectedBytes})),/budget/);
  assert.throws(()=>reviewedFaunaDownloads([{kind:'chicken',desktop:spec(),mobile:{...spec(),expectedBytes:100}}]),/Conflicting/);
  assert.throws(()=>reviewedFaunaDownloads([...catalog(),...catalog()]),/duplicate/);
});
test('valid local binary downloads once, verifies on reuse and keeps no temp file',async t=>{
  const root=folder(t),bytes=glb(),asset=spec(bytes);let calls=0;
  const fetcher:typeof fetch=async(input,options)=>{
    calls++;assert.equal(input,`https://grand-testament-assets.vercel.app${asset.url}`);assert.equal(options?.redirect,'error');assert.ok(options?.signal);
    return new Response(asBody(bytes),{headers:{'content-length':String(bytes.length)}});
  };
  const first=await fetchFaunaAssets(catalog(asset),{publicRoot:root,fetch:fetcher});assert.equal(first.downloadedBytes,bytes.length);
  const second=await fetchFaunaAssets(catalog(asset),{publicRoot:root,fetch:fetcher});assert.equal(second.downloadedBytes,0);assert.equal(calls,1);
  assert.deepEqual(readFileSync(join(root,asset.url.slice(1))),bytes);
  assert.deepEqual(readdirSync(join(root,'models','fauna-r8')),[asset.url.split('/').at(-1)]);
});
test('preexisting divergent binary is preserved without downloading',async t=>{
  const root=folder(t),asset=spec(),target=join(root,asset.url.slice(1)),original=Buffer.alloc(asset.expectedBytes,7);
  mkdirSync(dirname(target),{recursive:true});writeFileSync(target,original);
  await assert.rejects(fetchFaunaAssets(catalog(asset),{publicRoot:root,fetch:()=>{throw Error('must not fetch');}}),/integrity mismatch/);
  assert.deepEqual(readFileSync(target),original);
});
test('HTTP redirect/error responses never create a runtime file',async t=>{
  const root=folder(t);
  for(const status of [302,404,500])await assert.rejects(fetchFaunaAssets(catalog(),{publicRoot:root,fetch:async()=>new Response('',{status})}),/HTTP/);
  const redirected=new Response(asBody(glb()));Object.defineProperty(redirected,'redirected',{value:true});
  await assert.rejects(fetchFaunaAssets(catalog(),{publicRoot:root,fetch:async()=>redirected}),/HTTP/);
  assert.deepEqual(readdirSync(join(root,'models','fauna-r8')),[]);
});
test('truncated, oversized and hash-mismatched bodies leave no partial runtime binary',async t=>{
  const root=folder(t),bytes=glb();
  for(const bad of [bytes.subarray(0,bytes.length-1),Buffer.concat([bytes,Buffer.from([0])]),Buffer.alloc(bytes.length)]){
    await assert.rejects(fetchFaunaAssets(catalog(),{publicRoot:root,fetch:async()=>new Response(asBody(bad))}),/Truncated|exceeds|integrity/);
  }
  await assert.rejects(fetchFaunaAssets(catalog(),{publicRoot:root,fetch:async()=>new Response(asBody(bytes),{headers:{'content-length':'999999999'}})}),/budget/);
  assert.deepEqual(readdirSync(join(root,'models','fauna-r8')),[]);
});
test('stalled response is bounded even with a fetch implementation ignoring AbortSignal',async t=>{
  const root=folder(t);
  await assert.rejects(fetchFaunaAssets(catalog(),{publicRoot:root,timeoutMs:20,fetch:()=>new Promise(()=>{})}),/timed out/);
  assert.deepEqual(readdirSync(join(root,'models','fauna-r8')),[]);
});
test('external/data URI GLBs are rejected even when their expected size and hash match',async t=>{
  const root=folder(t);
  for(const uri of ['https://evil.invalid/texture.png','data:application/octet-stream;base64,AA==','']){
    const bytes=glb({asset:{version:'2.0'},images:[{uri}]});
    await assert.rejects(fetchFaunaAssets(catalog(spec(bytes)),{publicRoot:root,fetch:async()=>new Response(asBody(bytes))}),/URI/);
  }
  const invalid=glb();invalid.writeUInt32LE(1,4);assert.throws(()=>checkFaunaGLB(invalid),/GLB/);
});
test('a concurrent destination is never overwritten by the final publish step',async t=>{
  const root=folder(t),bytes=glb(),asset=spec(bytes),target=join(root,asset.url.slice(1)),other=Buffer.from('created by another task');
  await assert.rejects(fetchFaunaAssets(catalog(asset),{publicRoot:root,fetch:async()=>{writeFileSync(target,other,{flag:'wx'});return new Response(asBody(bytes));}}),/EEXIST/);
  assert.deepEqual(readFileSync(target),other);assert.equal(readdirSync(dirname(target)).length,1);
});
