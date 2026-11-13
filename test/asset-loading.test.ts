import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assetLoadPolicy,encodedImageSize,fitTexture,readAssetBody,abortable,serialQueue} from '../src/asset-loading.ts';

test('mobile texture caps preserve aspect and do not upscale while desktop is unrestricted',()=>{
  const mobile=assetLoadPolicy(true),desktop=assetLoadPolicy(false);
  assert.equal(mobile.parallelAssets,1);assert.equal(desktop.parallelAssets,2);
  assert.deepEqual(fitTexture(2048,2048,mobile.sceneryTextureLimit),{width:512,height:512});
  assert.deepEqual(fitTexture(2048,1024,mobile.heroTextureLimit),{width:1024,height:512});
  assert.deepEqual(fitTexture(64,128,512),{width:64,height:128});
  assert.deepEqual(fitTexture(2048,2048,desktop.sceneryTextureLimit),{width:2048,height:2048});
});

test('stream progress counts received bytes and assembles exactly the advertised asset',async()=>{
  const chunks=[new Uint8Array([1,2]),new Uint8Array([3,4,5])],seen:number[]=[];
  const response=new Response(new ReadableStream({start(c){for(const chunk of chunks)c.enqueue(chunk);c.close();}}));
  const buffer=await readAssetBody(response,5,n=>seen.push(n),new AbortController().signal);
  assert.deepEqual([...new Uint8Array(buffer)],[1,2,3,4,5]);assert.deepEqual(seen,[2,3]);
});

test('image metadata avoids full-resolution decoding and rejects truncated headers',()=>{
  const png=new Uint8Array(24),view=new DataView(png.buffer);
  view.setUint32(0,0x89504e47);view.setUint32(4,0x0d0a1a0a);view.setUint32(16,2048);view.setUint32(20,1024);
  assert.deepEqual(encodedImageSize(png),{width:2048,height:1024});
  const jpeg=new Uint8Array([0xff,0xd8,0xff,0xc2,0,8,8,4,0,8,0,0]);
  assert.deepEqual(encodedImageSize(jpeg),{width:2048,height:1024});
  assert.equal(encodedImageSize(jpeg.slice(0,8)),null);assert.equal(encodedImageSize(new Uint8Array([1,2,3])),null);
});

test('truncated, oversized and failed HTTP assets reject instead of inventing completion bytes',async()=>{
  for(const [bytes,expected] of [[2,5],[6,5]]){
    let received=0;
    await assert.rejects(readAssetBody(new Response(new Uint8Array(bytes)),expected,n=>received+=n,new AbortController().signal),/Unexpected asset size/);
    assert.equal(received,bytes);
  }
  let received=0;
  await assert.rejects(readAssetBody(new Response('missing',{status:404}),5,n=>received+=n,new AbortController().signal),/HTTP 404/);
  assert.equal(received,0);
});

test('aborted body work and a stalled parse terminate promptly',async()=>{
  const controller=new AbortController();let cancelled=false;
  const response=new Response(new ReadableStream({cancel(){cancelled=true;}}));
  const work=readAssetBody(response,5,()=>{},controller.signal);controller.abort(new Error('deadline'));
  await assert.rejects(work,/deadline/);assert.equal(cancelled,true);
  await assert.rejects(abortable(new Promise(()=>{}),controller.signal),/deadline/);
});

test('image decoder queue stays serial and continues after a rejected texture',async()=>{
  const queue=serialQueue(),events:string[]=[];let release!:()=>void;
  const first=queue(async()=>{events.push('first-start');await new Promise<void>(r=>release=r);events.push('first-end');throw Error('bad image');});
  const rejection=assert.rejects(first,/bad image/);
  const second=queue(async()=>events.push('second'));
  await Promise.resolve();assert.deepEqual(events,['first-start']);release();
  await Promise.all([rejection,second]);assert.deepEqual(events,['first-start','first-end','second']);
});
