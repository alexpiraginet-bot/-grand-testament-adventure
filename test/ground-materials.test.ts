import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import * as THREE from 'three/webgpu';
import {groundMaterialProfile,loadGroundMaterialsR13} from '../src/ground-materials.ts';
import catalog from '../src/data/ground-materials-r13.json' with {type:'json'};
const fileBuffer=(url:string)=>readFile(new URL('../public/'+url.replace(/^\.\//,''),import.meta.url));

test('shipped profiles match pinned bytes/hash, decode within budgets and retain packed data channels',async()=>{
  const publicCatalog=JSON.parse(await readFile(new URL('../public/textures/ground/r13/manifest.json',import.meta.url),'utf8'));
  assert.deepEqual(publicCatalog,catalog,'runtime and public provenance cannot drift');
  let total=0;
  for(const mobile of [true,false]){
    const profile=groundMaterialProfile(mobile);let bytes=0;
    for(const file of profile.files){
      const data=await fileBuffer(file.path);bytes+=data.length;
      assert.equal(data.length,file.bytes);assert.equal(createHash('sha256').update(data).digest('hex'),file.sha256);
      const {data:pixels,info}=await sharp(data).raw().toBuffer({resolveWithObject:true});
      assert.equal(info.width,profile.textureMax);assert.equal(info.height,profile.textureMax);
      if(file.colorSpace==='linear'){
        assert.equal(info.channels,4);let rmin=255,rmax=0;
        for(let p=0;p<pixels.length;p+=4){
          const length=Math.hypot(pixels[p]/127.5-1,pixels[p+1]/127.5-1,pixels[p+2]/127.5-1);
          assert.ok(Math.abs(length-1)<.015,'renormalized normals survive lossless packing');
          rmin=Math.min(rmin,pixels[p+3]);rmax=Math.max(rmax,pixels[p+3]);
        }
        assert.ok(rmax-rmin>20,'roughness keeps real spatial variation');
      }
    }
    assert.equal(bytes,profile.totalBytes);total+=bytes;
  }
  assert.ok(total<6_000_000);
});

test('loader is sequential, selects only the mobile profile and closes images when its owner disposes textures',async t=>{
  const events:string[]=[],closed:string[]=[],profile=groundMaterialProfile(true);
  t.mock.method(globalThis,'fetch',async(url:URL|RequestInfo)=>{events.push('fetch');return new Response(await fileBuffer(String(url)));});
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'createImageBitmap');
  Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,writable:true,value:async(_blob:Blob,options:ImageBitmapOptions)=>{
    events.push('decode');assert.equal(options.premultiplyAlpha,'none');assert.equal(options.colorSpaceConversion,'none');assert.equal(options.imageOrientation,'flipY');
    const id=String(events.length);return{width:512,height:512,close:()=>closed.push(id)};
  }});
  t.after(()=>descriptor?Object.defineProperty(globalThis,'createImageBitmap',descriptor):Reflect.deleteProperty(globalThis,'createImageBitmap'));
  const maps=await loadGroundMaterialsR13({mobile:true,base:'./'});
  assert.deepEqual(events,['fetch','decode','fetch','decode','fetch','decode','fetch','decode']);
  assert.equal(Object.keys(maps).length,4);
  for(const entry of profile.files){const map=maps[entry.key as keyof typeof maps];
    assert.equal(map.userData.sha256,entry.sha256);assert.equal(map.flipY,false);assert.equal(map.premultiplyAlpha,false);
    assert.equal(map.colorSpace,entry.colorSpace==='srgb'?THREE.SRGBColorSpace:THREE.NoColorSpace);map.dispose();
  }
  assert.equal(closed.length,4);
});

test('a wrong hash stops before GPU upload and releases textures loaded earlier',async t=>{
  let request=0,closed=0,decoded=0;
  t.mock.method(globalThis,'fetch',async(url:URL|RequestInfo)=>{const bytes=await fileBuffer(String(url));if(request++===1)bytes[bytes.length-1]^=1;return new Response(bytes);});
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'createImageBitmap');
  Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,writable:true,value:async()=>{decoded++;return{width:512,height:512,close:()=>closed++};}});
  t.after(()=>descriptor?Object.defineProperty(globalThis,'createImageBitmap',descriptor):Reflect.deleteProperty(globalThis,'createImageBitmap'));
  await assert.rejects(loadGroundMaterialsR13({mobile:true,base:'./'}),/hash mismatch/);
  assert.equal(request,2);assert.equal(decoded,1);assert.equal(closed,1);
});

test('abort rejects promptly and closes an image bitmap that arrives after cancellation',async t=>{
  let entered!:()=>void,resolveImage!:(image:unknown)=>void,closed=0;
  const decoding=new Promise<void>(resolve=>{entered=resolve;});
  t.mock.method(globalThis,'fetch',async(url:URL|RequestInfo)=>new Response(await fileBuffer(String(url))));
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'createImageBitmap');
  Object.defineProperty(globalThis,'createImageBitmap',{configurable:true,writable:true,value:()=>{entered();return new Promise(resolve=>{resolveImage=resolve;});}});
  t.after(()=>descriptor?Object.defineProperty(globalThis,'createImageBitmap',descriptor):Reflect.deleteProperty(globalThis,'createImageBitmap'));
  const controller=new AbortController(),task=loadGroundMaterialsR13({mobile:true,base:'./',signal:controller.signal});
  await decoding;controller.abort(new DOMException('Stopped','AbortError'));
  await assert.rejects(task,{name:'AbortError'});resolveImage({width:512,height:512,close:()=>closed++});
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(closed,1);
});

test('a stalled network request has a terminal timeout instead of an eternal loading state',async t=>{
  t.mock.method(globalThis,'fetch',async(_url:URL|RequestInfo,options?:RequestInit)=>new Promise<Response>((_resolve,reject)=>{
    options!.signal!.addEventListener('abort',()=>reject(options!.signal!.reason),{once:true});
  }));
  await assert.rejects(loadGroundMaterialsR13({mobile:true,base:'./',timeoutMs:10}),{name:'TimeoutError'});
  await assert.rejects(loadGroundMaterialsR13({mobile:true,base:'https://unrelated.invalid/'}),/same-origin/);
});
