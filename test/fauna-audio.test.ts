import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FaunaAudio,faunaAttenuation,faunaCallDelay,type AudibleFauna,type FaunaSoundClip} from '../src/fauna-audio.ts';
import type {FaunaAgent} from '../src/fauna-simulation.ts';

class Param {
  value=0;
  setValueAtTime(v:number){this.value=v;}
  linearRampToValueAtTime(v:number){this.value=v;}
  setTargetAtTime(v:number){this.value=v;}
}
class Node {
  connected:unknown=null;disconnected=false;
  connect(target:unknown){this.connected=target;}
  disconnect(){this.disconnected=true;}
}
class Gain extends Node {gain=new Param();}
class Panner extends Node {
  positionX=new Param();positionY=new Param();positionZ=new Param();
  panningModel='';distanceModel='';rolloffFactor=1;
}
class Buffer {
  length:number;numberOfChannels:number;sampleRate:number;duration:number;data:Float32Array[];
  constructor(channels=1,length=2000,rate=100){this.length=length;this.numberOfChannels=channels;this.sampleRate=rate;this.duration=length/rate;this.data=Array.from({length:channels},()=>new Float32Array(length));}
  getChannelData(c:number){return this.data[c];}
}
class Source extends Node {
  buffer:Buffer|null=null;loop=false;onended:(()=>void)|null=null;started=false;stopped=false;
  start(){this.started=true;}
  stop(){this.stopped=true;this.onended?.();}
  end(){this.stopped=true;this.onended?.();}
}
class Context {
  state='running';currentTime=0;resumeCalls=0;closeCalls=0;
  sources:Source[]=[];panners:Panner[]=[];gains:Gain[]=[];startTimes:number[]=[];
  listener={positionX:new Param(),positionY:new Param(),positionZ:new Param(),forwardX:new Param(),forwardY:new Param(),forwardZ:new Param(),upX:new Param(),upY:new Param(),upZ:new Param()};
  decode:()=>Promise<Buffer>=async()=>new Buffer();
  async decodeAudioData(){return this.decode();}
  createBuffer(channels:number,length:number,rate:number){return new Buffer(channels,length,rate);}
  createBufferSource(){const s=new Source(),start=s.start.bind(s);s.start=()=>{this.startTimes.push(this.currentTime);start();};this.sources.push(s);return s;}
  createGain(){const g=new Gain();this.gains.push(g);return g;}
  createPanner(){const p=new Panner();this.panners.push(p);return p;}
  async resume(){this.resumeCalls++;}
  async close(){this.closeCalls++;}
}
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
const listener={x:0,y:1,z:0,yaw:0};
const chicken:AudibleFauna={id:'hen-1',kind:'chicken',x:1,y:0,z:-2};
const clips:FaunaSoundClip[]=[{id:'chicken',kind:'chicken',url:'/chicken.mp3'}, {id:'birds',kind:'birds',url:'/birds.mp3'},{id:'lake',kind:'lake',url:'/lake.mp3'}];
const response=()=>new Response(new Uint8Array([1,2,3,4]),{headers:{'content-length':'4'}});
const fakeFetch=async()=>response();
function setup(manifest=clips,options:ConstructorParameters<typeof FaunaAudio>[3]={}){
  const ctx=new Context(),master=new Gain();
  const audio=new FaunaAudio(ctx as unknown as AudioContext,master as unknown as GainNode,manifest,{document:null,fetch:fakeFetch,...options});
  return{ctx,master,audio};
}
async function advance(audio:FaunaAudio,ctx:Context,agents:AudibleFauna[]=[chicken],steps=36){
  for(let i=0;i<steps;i++){ctx.currentTime+=.25;audio.update(.25,listener,agents);await flush();}
}

test('jitter is deterministic per emitter and attenuation includes an exact silent boundary',()=>{
  assert.equal(faunaCallDelay('hen-1','chicken',2),faunaCallDelay('hen-1','chicken',2));
  assert.notEqual(faunaCallDelay('hen-1','chicken',2),faunaCallDelay('hen-2','chicken',2));
  assert.ok(faunaCallDelay('hen-1','chicken',1)>faunaCallDelay('hen-1','chicken',0));
  assert.equal(faunaAttenuation(0,20),1);assert.equal(faunaAttenuation(10,20),.25);
  assert.equal(faunaAttenuation(20,20),0);assert.equal(faunaAttenuation(21,20),0);
  assert.equal(faunaAttenuation(NaN,20),0);
});

test('nothing loads before enable, while context is locked, or for absent, hidden, distant and fish agents',async()=>{
  let requests=0;const {audio,ctx}=setup(clips,{fetch:async()=>{requests++;return response();}});
  await advance(audio,ctx);assert.equal(requests,0);
  audio.enable();ctx.state='suspended';await advance(audio,ctx);assert.equal(requests,0);
  ctx.state='running';await advance(audio,ctx,[]);
  await advance(audio,ctx,[{...chicken,visible:false},{...chicken,id:'fish',kind:'fish'},{...chicken,id:'high',y:100},{...chicken,id:'far',x:1000}]);
  assert.equal(requests,0);assert.equal(ctx.resumeCalls,0);assert.equal(ctx.closeCalls,0);audio.dispose();
});

test('near visible animals share a lazy buffer, use spatial position/orientation, and never exceed three voices',async()=>{
  let requests=0;const {audio,ctx,master}=setup(clips,{maxVoices:99,fetch:async()=>{requests++;return response();}});
  audio.enable();const agents=Array.from({length:9},(_,i)=>({...chicken,id:`hen-${i}`,x:i*.2}));
  await advance(audio,ctx,agents);
  assert.equal(requests,1);assert.equal(audio.stats.voices,3);assert.equal(audio.stats.startedVoices,3);
  assert.equal(ctx.sources.filter(s=>s.started&&!s.stopped).length,3);
  audio.update(.1,{...listener,yaw:Math.PI/2},agents);
  assert.equal(ctx.listener.forwardX.value,1);assert.ok(Math.abs(ctx.listener.forwardZ.value)<1e-9);
  assert.equal(ctx.panners[0].positionY.value,0);assert.equal(ctx.panners[0].positionZ.value,-2);
  assert.equal(ctx.panners[0].connected,master);assert.equal(ctx.panners[0].rolloffFactor,0);
  assert.equal(ctx.sources[0].loop,false);
  audio.update(.1,listener,[]);assert.equal(audio.stats.voices,0);assert.ok(ctx.sources.every(s=>s.stopped&&s.disconnected));audio.dispose();
});

test('runtime animal body radii never replace the acoustic range at the player ear height',async()=>{
  const ear={x:0,y:1.55,z:0,yaw:0};
  for(const [kind,bodyRadius,hearingRadius] of [['chicken',.28,22],['donkey',.91,55]] as const){
    const agent:FaunaAgent={id:`runtime-${kind}`,kind,x:3,y:0,z:0,heading:0,homeX:3,homeZ:0,
      phase:0,scale:1,radius:bodyRadius,halfHeight:kind==='chicken'?.23:.7,seed:42,time:0,moving:false,speed:0};
    let requests=0;
    const {audio,ctx}=setup([{id:kind,kind,url:`/${kind}.mp3`,radius:hearingRadius}],{
      fetch:async()=>{requests++;return response();}
    });
    audio.enable();
    for(let i=0;i<36;i++){ctx.currentTime+=.25;audio.update(.25,ear,[agent]);await flush();}
    assert.equal(requests,1,`${kind} at 3m must load despite its small physical body radius`);
    assert.equal(audio.stats.voices,1,`${kind} is within its ${hearingRadius}m sound range`);
    const started=audio.stats.startedVoices;
    agent.x=hearingRadius+2;
    audio.update(.1,ear,[agent]);assert.equal(audio.stats.voices,0,'moving outside the acoustic range stops the current call');
    for(let i=0;i<400;i++){ctx.currentTime+=.25;audio.update(.25,ear,[agent]);await flush();}
    assert.equal(audio.stats.startedVoices,started,'a distant animal cannot restart a call');audio.dispose();
  }
});

test('habitat ambience needs no animal mesh, fetch and decode are sequential, and bytes are observed',async()=>{
  let activeFetch=0,maxFetch=0,activeDecode=0,maxDecode=0;
  const {audio,ctx}=setup(clips,{habitats:[{id:'grove',kind:'birds',x:4,y:3,z:0},{id:'shore',kind:'lake',x:-4,y:0,z:0}],fetch:async()=>{
    activeFetch++;maxFetch=Math.max(maxFetch,activeFetch);await flush();activeFetch--;return response();
  }});
  ctx.decode=async()=>{activeDecode++;maxDecode=Math.max(maxDecode,activeDecode);await flush();activeDecode--;return new Buffer();};
  audio.enable();await advance(audio,ctx,[]);
  assert.equal(audio.stats.voices,2);assert.equal(audio.stats.loadedClips,2);assert.equal(audio.stats.receivedBytes,8);
  assert.equal(maxFetch,1);assert.equal(maxDecode,1);assert.ok(ctx.sources.every(s=>!s.loop));audio.dispose();
});

test('hidden/stop/dispose stop sources without closing shared audio, and visible never undoes explicit stop',async()=>{
  const {audio,ctx,master}=setup();audio.enable();await advance(audio,ctx);
  assert.equal(audio.stats.voices,1);audio.setVisible(false);assert.equal(audio.stats.voices,0);
  await advance(audio,ctx);assert.equal(audio.stats.startedVoices,1);
  audio.stop();audio.setVisible(true);await advance(audio,ctx);assert.equal(audio.stats.startedVoices,1);
  audio.resume();await advance(audio,ctx,[chicken],200);assert.ok(audio.stats.startedVoices>1);
  audio.dispose();audio.enable();await advance(audio,ctx);assert.equal(audio.stats.voices,0);assert.equal(audio.stats.loadedClips,0);
  assert.equal(ctx.closeCalls,0);assert.equal(ctx.resumeCalls,0);assert.equal(master.disconnected,false);
});

test('decode completing after dispose cannot cache a buffer or start audio',async()=>{
  let resolve!:(b:Buffer)=>void,decoding=false;const {audio,ctx}=setup();
  ctx.decode=()=>{decoding=true;return new Promise(r=>resolve=r);};audio.enable();await advance(audio,ctx);
  assert.equal(decoding,true);audio.dispose();resolve(new Buffer());await flush();
  assert.equal(audio.stats.loadedClips,0);assert.equal(audio.stats.voices,0);assert.equal(audio.stats.pending,0);assert.equal(ctx.sources.length,0);
});

test('resume cannot overlap a native decode that was already cancelled by stop',async()=>{
  let finish!:(b:Buffer)=>void,decodes=0;
  const {audio,ctx}=setup([clips[0],{id:'sheep',kind:'sheep',url:'/sheep.mp3'}]);
  ctx.decode=()=>{decodes++;return decodes===1?new Promise(r=>finish=r):Promise.resolve(new Buffer());};
  audio.enable();await advance(audio,ctx);assert.equal(decodes,1);
  audio.stop();audio.resume();const sheep:AudibleFauna={...chicken,id:'sheep',kind:'sheep'};
  await advance(audio,ctx,[sheep]);assert.equal(decodes,1);assert.equal(audio.stats.voices,0);
  finish(new Buffer());await flush();await advance(audio,ctx,[sheep],2);
  assert.equal(decodes,2);assert.equal(audio.stats.loadedClips,1);assert.equal(audio.stats.voices,1);audio.dispose();
});

test('HTTP errors are terminal per clip rather than retrying every frame',async()=>{
  let requests=0,errors=0;const {audio,ctx}=setup([clips[0]],{fetch:async()=>{requests++;return new Response('',{status:404});},onError:()=>errors++});
  audio.enable();await advance(audio,ctx,[chicken],100);assert.equal(requests,1);assert.equal(errors,1);
  assert.deepEqual(audio.stats.failedClips,['chicken']);assert.equal(audio.stats.pending,0);audio.dispose();
});

test('a stalled download times out to a terminal failed clip and releases the serial queue',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let signal:AbortSignal|undefined;
  const {audio,ctx}=setup([clips[0]],{fetch:async(_url,init)=>{signal=init?.signal as AbortSignal;return new Promise<Response>(()=>{});}});
  audio.enable();await advance(audio,ctx);assert.equal(audio.stats.pending,1);
  t.mock.timers.tick(15001);await flush();
  assert.equal(signal?.aborted,true);assert.equal(audio.stats.pending,0);
  assert.deepEqual(audio.stats.failedClips,['chicken']);assert.equal(audio.stats.voices,0);audio.dispose();
});

test('stereo is mixed to mono, a source remains within gain budget, and decoded oversize is rejected',async()=>{
  const {audio,ctx}=setup([{...clips[0],gain:20}]);
  ctx.decode=async()=>{const b=new Buffer(2);b.data[0].fill(.8);b.data[1].fill(.4);return b;};
  audio.enable();await advance(audio,ctx);
  assert.equal(ctx.sources[0].buffer?.numberOfChannels,1);assert.ok(Math.abs(ctx.sources[0].buffer!.data[0][0]-.6)<1e-6);
  assert.ok(ctx.gains[1].gain.value<=.25);assert.equal(audio.stats.decodedBytes,2000*4);audio.dispose();
  const small=setup([clips[0]],{maxDecodedBytes:4});small.audio.enable();await advance(small.audio,small.ctx);
  assert.equal(small.audio.stats.voices,0);assert.deepEqual(small.audio.stats.failedClips,['chicken']);small.audio.dispose();
});

test('streamed emitter history is capped and absent IDs expire without losing a present emitter',()=>{
  const {audio,ctx}=setup([clips[0]],{maxVoices:0});audio.enable();
  for(let i=0;i<10000;i++){
    ctx.currentTime+=.001;
    audio.update(.001,listener,[chicken,{...chicken,id:`passing-${i}`}]);
    assert.ok(audio.stats.scheduledEmitters<=512);
  }
  assert.equal(audio.stats.scheduledEmitters,512);
  for(let i=0;i<481;i++){ctx.currentTime+=.25;audio.update(.25,listener,[chicken]);}
  assert.equal(audio.stats.scheduledEmitters,1,'only the continuously present emitter retains history');
  assert.equal(audio.stats.pending,0);assert.equal(audio.stats.startedVoices,0);audio.dispose();
});

test('history pressure preserves the current voice and its existing next-call schedule',async()=>{
  const {audio,ctx}=setup([clips[0]]);audio.enable();await advance(audio,ctx);
  const first=ctx.sources[0];assert.ok(first.started);assert.equal(audio.stats.startedVoices,1);
  for(let i=0;i<1000;i++){
    ctx.currentTime+=.001;
    audio.update(.001,listener,[chicken,{...chicken,id:`passing-${i}`,x:1000}]);
  }
  assert.equal(first.stopped,false);assert.equal(audio.stats.voices,1);assert.equal(audio.stats.startedVoices,1);
  const due=ctx.startTimes[0]+20+faunaCallDelay(`animal:${chicken.id}`,'chicken',1);
  while(ctx.currentTime<due-.25){ctx.currentTime+=.05;audio.update(.05,listener,[chicken]);}
  assert.equal(audio.stats.startedVoices,1,'next call did not move earlier under pressure');
  while(ctx.currentTime<due+.5){ctx.currentTime+=.05;audio.update(.05,listener,[chicken]);}
  assert.equal(audio.stats.startedVoices,2,'the original due time survives history churn');audio.dispose();
});

test('non-finite decoded budgets fall back to the finite cap instead of disabling it',async()=>{
  const oversized=new Buffer(1,4_000_000,200_000); // 20 seconds, 16 MB PCM; exceeds the 12 MiB cap.
  for(const budget of [NaN,Infinity,-Infinity]){
    const {audio,ctx}=setup([clips[0]],{maxDecodedBytes:budget});ctx.decode=async()=>oversized;
    audio.enable();await advance(audio,ctx);
    assert.equal(audio.stats.decodedBytes,0);assert.equal(audio.stats.loadedClips,0);
    assert.equal(audio.stats.voices,0);assert.deepEqual(audio.stats.failedClips,['chicken']);audio.dispose();
  }
});

test('the native decode queue retains no PCM result after budget rejection or disposal',async()=>{
  const {audio,ctx}=setup([clips[0]],{maxDecodedBytes:4});
  ctx.decode=async()=>new Buffer(2); // Rejected after mono conversion; neither PCM is cache-owned.
  audio.enable();await advance(audio,ctx);
  assert.deepEqual(audio.stats.failedClips,['chicken']);
  assert.equal(audio.stats.loadedClips,0);assert.equal(audio.stats.decodedBytes,0);
  // Inspect the serialisation barrier: a fulfilled Promise retains its value even after cache.clear().
  const queue=audio as unknown as {decodeQueue:Promise<unknown>};
  assert.ok((await queue.decodeQueue)===undefined,'the decode barrier must not hold the original stereo AudioBuffer');
  audio.dispose();assert.equal(await queue.decodeQueue,undefined);
});
