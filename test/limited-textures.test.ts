import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {decodeLimitedImage} from '../src/limited-textures.ts';

function pngHeader(width:number,height:number){
  const bytes=new Uint8Array(24),v=new DataView(bytes.buffer);
  v.setUint32(0,0x89504e47);v.setUint32(4,0x0d0a1a0a);v.setUint32(16,width);v.setUint32(20,height);return new Blob([bytes]);
}
function mockBitmap(t:TestContext,value:unknown){
  const original=Object.getOwnPropertyDescriptor(globalThis,'createImageBitmap');
  Object.defineProperty(globalThis,'createImageBitmap',{value,writable:true,configurable:true});
  t.after(()=>{if(original)Object.defineProperty(globalThis,'createImageBitmap',original);else Reflect.deleteProperty(globalThis,'createImageBitmap');});
}

test('bitmap resize request caps both dimensions and preserves alpha/color settings before GPU use',async t=>{
  let options:ImageBitmapOptions|undefined;
  mockBitmap(t,async (_blob:Blob,opts:ImageBitmapOptions)=>{options=opts;return{width:opts.resizeWidth,height:opts.resizeHeight,close(){}} as ImageBitmap;});
  const bitmap=await decodeLimitedImage(pngHeader(2048,1024),512,new AbortController().signal);
  assert.equal(bitmap.width,512);assert.equal(bitmap.height,256);
  assert.equal(options?.colorSpaceConversion,'none');assert.equal(options?.premultiplyAlpha,'none');
  const small=await decodeLimitedImage(pngHeader(128,64),512,new AbortController().signal);
  assert.equal(small.width,128);assert.equal(small.height,64);
});

test('bitmap completing after cancellation is closed and cannot enter a scene',async t=>{
  let finish!:(image:ImageBitmap)=>void,closed=0,started!:(v?:unknown)=>void;
  const start=new Promise(r=>started=r),controller=new AbortController();
  mockBitmap(t,()=>new Promise<ImageBitmap>(resolve=>{finish=resolve;started();}));
  const decoding=decodeLimitedImage(pngHeader(2048,2048),512,controller.signal);
  await start;controller.abort(new Error('deadline'));await assert.rejects(decoding,/deadline/);
  finish({width:512,height:512,close(){closed++;}} as ImageBitmap);
  await Promise.resolve();assert.equal(closed,1);
});

test('abort between bitmap resolution and await continuation also closes the bitmap',async t=>{
  const controller=new AbortController();let closed=0;
  mockBitmap(t,()=>{
    queueMicrotask(()=>queueMicrotask(()=>controller.abort(Error('device lost'))));
    return Promise.resolve({width:512,height:512,close(){closed++;}} as ImageBitmap);
  });
  await assert.rejects(decodeLimitedImage(pngHeader(2048,2048),512,controller.signal),/device lost/);
  assert.equal(closed,1);
});
