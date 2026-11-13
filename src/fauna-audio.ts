// Spatial wildlife uses the game's existing audio graph; it never unlocks or creates a context.
// Call update with approved, currently visible animal agents only. Habitat sounds are separate.
import type {FaunaAgent,FaunaKind} from './fauna-simulation.ts';
import {abortable} from './asset-loading.ts';

export type FaunaSoundKind=Exclude<FaunaKind,'fish'>|'birds'|'lake';
export interface FaunaSoundClip {id:string;kind:FaunaSoundKind;url:string;gain?:number;radius?:number}
export interface FaunaSoundHabitat {id:string;kind:'birds'|'lake';x:number;y:number;z:number;radius?:number}
export interface FaunaListener {x:number;y:number;z:number;yaw:number}
export type AudibleFauna=Pick<FaunaAgent,'id'|'kind'|'x'|'y'|'z'>&{visible?:boolean};
export interface FaunaAudioOptions {
  habitats?:readonly FaunaSoundHabitat[];
  maxVoices?:number;
  maxDecodedBytes?:number;
  fetch?:typeof fetch;
  document?:Pick<Document,'hidden'|'addEventListener'|'removeEventListener'>|null;
  onError?:(clipId:string,error:unknown)=>void;
}
interface Emitter {id:string;kind:FaunaSoundKind;x:number;y:number;z:number;radius?:number}
interface Schedule {due:number;event:number;lastSeen:number}
interface Voice {source:AudioBufferSourceNode;envelope:GainNode;gain:GainNode;panner:PannerNode;clip:FaunaSoundClip;emitterId:string;until:number;level:number}
const defaults:Record<FaunaSoundKind,{gain:number;radius:number;cooldown:number}>={
  chicken:{gain:.16,radius:22,cooldown:14},donkey:{gain:.12,radius:55,cooldown:55},
  sheep:{gain:.12,radius:32,cooldown:32},goat:{gain:.12,radius:32,cooldown:34},
  birds:{gain:.06,radius:48,cooldown:36},lake:{gain:.08,radius:40,cooldown:3},
};
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const pointValid=(p:{x:number;y:number;z:number})=>[p.x,p.y,p.z].every(Number.isFinite);
const scheduleLimit=512,scheduleTTL=120,decodedLimit=12*1024**2;

/** Quiet at the boundary, silent outside; height separation counts too. */
export function faunaAttenuation(distance:number,radius:number):number {
  return Number.isFinite(distance)&&Number.isFinite(radius)&&radius>0?(1-clamp(distance/radius,0,1))**2:0;
}
/** Per-emitter hash: iteration order and other animals do not change a call's timing. */
export function faunaCallDelay(id:string,kind:FaunaSoundKind,event:number):number {
  let hash=2166136261;
  for(const c of `${id}:${kind}:${event}`)hash=Math.imul(hash^c.charCodeAt(0),16777619);
  const random=(hash>>>0)/4294967296;
  return event===0?2+random*5:defaults[kind].cooldown*(.8+random*.7);
}

export class FaunaAudio {
  private ctx:AudioContext;
  private master:GainNode;
  private clips:readonly FaunaSoundClip[];
  private options:FaunaAudioOptions;
  private doc:FaunaAudioOptions['document'];
  private enabled=false;
  private visible=true;
  private disposed=false;
  private time=0;
  private started=0;
  private receivedBytes=0;
  private voices=new Set<Voice>();
  private schedules=new Map<string,Schedule>();
  private cache=new Map<string,AudioBuffer>();
  private pending=new Map<string,Promise<void>>();
  private failed=new Set<string>();
  private controller=new AbortController();
  private queue:Promise<void>=Promise.resolve();
  private decodeQueue:Promise<unknown>=Promise.resolve();
  private visibility=()=>this.setVisible(!this.doc?.hidden);

  constructor(ctx:AudioContext,master:GainNode,manifest:readonly FaunaSoundClip[],options:FaunaAudioOptions={}) {
    this.ctx=ctx;this.master=master;this.options=options;
    if(new Set(manifest.map(c=>c.id)).size!==manifest.length)throw Error('Duplicate fauna audio clip ID');
    this.clips=manifest.filter(c=>c.url&&defaults[c.kind]);
    this.doc=options.document===undefined?(typeof document==='undefined'?null:document):options.document;
    this.visible=!this.doc?.hidden;
    this.doc?.addEventListener('visibilitychange',this.visibility);
  }
  /** Invoke after the root unlocks its existing context from a user gesture. */
  enable():void {if(this.disposed)return;this.enabled=true;if(this.controller.signal.aborted)this.controller=new AbortController();}
  resume():void {this.enable();}
  stop():void {this.enabled=false;this.halt();}
  setVisible(visible:boolean):void {
    this.visible=visible;
    if(!visible)this.halt();else if(this.enabled&&!this.disposed&&this.controller.signal.aborted)this.controller=new AbortController();
  }
  dispose():void {
    if(this.disposed)return;this.disposed=true;this.stop();this.cache.clear();this.schedules.clear();
    this.doc?.removeEventListener('visibilitychange',this.visibility);
    // The shared master/context belong to Sfx, not to this module.
  }
  get stats(){return{enabled:this.enabled,visible:this.visible,voices:this.voices.size,
    loadedClips:this.cache.size,decodedBytes:this.cacheBytes(),pending:this.pending.size,
    failedClips:[...this.failed],startedVoices:this.started,receivedBytes:this.receivedBytes,scheduledEmitters:this.schedules.size};}

  update(dt:number,listener:FaunaListener,visibleAgents:readonly AudibleFauna[]):void {
    if(this.disposed||!this.enabled||!this.visible||this.ctx.state!=='running'||!Number.isFinite(dt)||dt<=0||!pointValid(listener)||!Number.isFinite(listener.yaw))return;
    this.time+=Math.min(dt,.25);
    this.listener(listener);
    const emitters:Emitter[]=[];
    for(const a of visibleAgents)if(a.kind!=='fish'&&a.visible!==false&&pointValid(a))emitters.push({...a,id:`animal:${a.id}`,kind:a.kind});
    for(const h of this.options.habitats??[])if(pointValid(h))emitters.push({...h,id:`habitat:${h.id}`});
    const byId=new Map(emitters.map(e=>[e.id,e]));
    for(const voice of this.voices){
      const e=byId.get(voice.emitterId);
      if(!e||this.ctx.currentTime>=voice.until||this.level(e,voice.clip,listener)<=.00001){this.removeVoice(voice);continue;}
      this.position(voice.panner,e);
      voice.level=this.level(e,voice.clip,listener);
      voice.gain.gain.setTargetAtTime(voice.level,this.ctx.currentTime,.12);
    }
    // Streamed sectors can supply new IDs for hours. Retain current emitters/voices without
    // resetting their due times, but expire absent history and cap it before adding another ID.
    const protectedIds=new Set([...byId.keys(),...[...this.voices].map(v=>v.emitterId)]);
    for(const [id,schedule] of this.schedules){
      if(protectedIds.has(id))schedule.lastSeen=this.time;
      else if(this.time-schedule.lastSeen>=scheduleTTL)this.schedules.delete(id);
    }
    emitters.sort((a,b)=>Math.hypot(a.x-listener.x,a.z-listener.z)-Math.hypot(b.x-listener.x,b.z-listener.z)||a.id.localeCompare(b.id));
    const requested=this.options.maxVoices??3,limit=Number.isFinite(requested)?clamp(Math.floor(requested),0,3):3;
    for(const e of emitters){
      const clips=this.clips.filter(c=>c.kind===e.kind);if(!clips.length)continue;
      let schedule=this.schedules.get(e.id);
      if(!schedule){
        if(this.schedules.size>=scheduleLimit){
          let oldest:string|undefined,seen=Infinity;
          for(const [id,prior] of this.schedules)if(!protectedIds.has(id)&&prior.lastSeen<seen){oldest=id;seen=prior.lastSeen;}
          if(oldest===undefined)continue; // All retained slots belong to current emitters/voices.
          this.schedules.delete(oldest);
        }
        schedule={due:this.time+faunaCallDelay(e.id,e.kind,0),event:0,lastSeen:this.time};this.schedules.set(e.id,schedule);
      }
      const clip=clips[schedule.event%clips.length];
      if(this.level(e,clip,listener)<=.00001||schedule.due>this.time||this.voices.size>=limit||[...this.voices].some(v=>v.emitterId===e.id)||this.failed.has(clip.id))continue;
      const buffer=this.cache.get(clip.id);
      if(!buffer){this.request(clip);continue;}
      this.cache.delete(clip.id);this.cache.set(clip.id,buffer); // LRU, without duplicating PCM.
      this.play(e,clip,buffer,listener);
      schedule.event++;schedule.due=this.time+buffer.duration+faunaCallDelay(e.id,e.kind,schedule.event);
    }
  }

  private listener(p:FaunaListener):void {
    const l=this.ctx.listener,t=this.ctx.currentTime;
    if(l.positionX){
      l.positionX.setValueAtTime(p.x,t);l.positionY.setValueAtTime(p.y,t);l.positionZ.setValueAtTime(p.z,t);
      l.forwardX.setValueAtTime(Math.sin(p.yaw),t);l.forwardY.setValueAtTime(0,t);l.forwardZ.setValueAtTime(-Math.cos(p.yaw),t);
      l.upX.setValueAtTime(0,t);l.upY.setValueAtTime(1,t);l.upZ.setValueAtTime(0,t);
    }else {l.setPosition(p.x,p.y,p.z);l.setOrientation(Math.sin(p.yaw),0,-Math.cos(p.yaw),0,1,0);}
  }
  private position(panner:PannerNode,p:Emitter):void {
    if(panner.positionX){panner.positionX.setValueAtTime(p.x,this.ctx.currentTime);panner.positionY.setValueAtTime(p.y,this.ctx.currentTime);panner.positionZ.setValueAtTime(p.z,this.ctx.currentTime);}
    else panner.setPosition(p.x,p.y,p.z);
  }
  private level(e:Emitter,clip:FaunaSoundClip,listener:FaunaListener):number {
    const radius=e.radius??clip.radius??defaults[e.kind].radius;
    const gain=Number.isFinite(clip.gain)?clamp(clip.gain!,0,.25):defaults[e.kind].gain;
    return gain*faunaAttenuation(Math.hypot(e.x-listener.x,e.y-listener.y,e.z-listener.z),radius);
  }
  private play(e:Emitter,clip:FaunaSoundClip,buffer:AudioBuffer,listener:FaunaListener):void {
    const source=this.ctx.createBufferSource(),envelope=this.ctx.createGain(),gain=this.ctx.createGain(),panner=this.ctx.createPanner(),at=this.ctx.currentTime;
    const level=this.level(e,clip,listener),duration=buffer.duration,fade=Math.min(.22,duration/4);
    source.buffer=buffer;source.loop=false;panner.panningModel='equalpower';
    // Custom attenuation reaches zero at the habitat edge. Avoid applying it a second time in PannerNode.
    panner.distanceModel='inverse';panner.rolloffFactor=0;this.position(panner,e);
    gain.gain.setValueAtTime(level,at);
    envelope.gain.setValueAtTime(0,at);envelope.gain.linearRampToValueAtTime(1,at+Math.min(.08,fade));
    envelope.gain.setValueAtTime(1,at+duration-fade);envelope.gain.linearRampToValueAtTime(0,at+duration);
    source.connect(envelope);envelope.connect(gain);gain.connect(panner);panner.connect(this.master);
    const voice:Voice={source,envelope,gain,panner,clip,emitterId:e.id,until:at+duration,level};
    source.onended=()=>this.removeVoice(voice,false);this.voices.add(voice);
    try {source.start();this.started++;}catch(error){this.removeVoice(voice);this.fail(clip,error);}
  }
  private removeVoice(v:Voice,stop=true):void {
    if(!this.voices.delete(v))return;
    v.source.onended=null;if(stop)try{v.source.stop();}catch{/* Already ended. */}
    v.source.disconnect();v.envelope.disconnect();v.gain.disconnect();v.panner.disconnect();v.source.buffer=null;
  }
  private halt():void {this.controller.abort();for(const voice of this.voices)this.removeVoice(voice);}
  private cacheBytes():number {return[...this.cache.values()].reduce((n,b)=>n+b.length*b.numberOfChannels*4,0);}
  private fail(clip:FaunaSoundClip,error:unknown):void {this.failed.add(clip.id);this.options.onError?.(clip.id,error);}

  private request(clip:FaunaSoundClip):void {
    if(this.pending.has(clip.id)||this.failed.has(clip.id))return;
    const session=this.controller.signal;
    const job=this.queue.then(async()=>{
      if(session.aborted||this.disposed)return;
      const controller=new AbortController(),abort=()=>controller.abort(session.reason);
      session.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(()=>controller.abort(new Error('Fauna audio load timed out')),15000);
      try {
        const fetcher=this.options.fetch??fetch;
        const response=await abortable(fetcher(clip.url,{signal:controller.signal}),controller.signal);
        if(!response.ok)throw Error(`Fauna audio HTTP ${response.status}`);
        const bytes=await this.read(response,controller.signal);
        // Native decoding cannot be cancelled. Keep its slot occupied until it settles,
        // even if a timeout/visibility change has already ended this request.
        const decoding=this.decodeQueue.then(()=>{controller.signal.throwIfAborted();return this.ctx.decodeAudioData(bytes);});
        // The barrier must hold only completion, never the last native PCM buffer after eviction/disposal.
        this.decodeQueue=decoding.then(()=>{},()=>{});
        const decoded=await abortable(decoding,controller.signal);
        controller.signal.throwIfAborted();
        if(!Number.isFinite(decoded.duration)||decoded.duration<=0||decoded.duration>30||decoded.numberOfChannels>2)throw Error('Fauna audio exceeds duration/channel budget');
        let buffer=decoded;
        if(decoded.numberOfChannels===2){
          buffer=this.ctx.createBuffer(1,decoded.length,decoded.sampleRate);
          const target=buffer.getChannelData(0),a=decoded.getChannelData(0),b=decoded.getChannelData(1);
          for(let i=0;i<target.length;i++)target[i]=(a[i]+b[i])*.5;
        }
        const size=buffer.length*buffer.numberOfChannels*4,requestedBudget=this.options.maxDecodedBytes??decodedLimit;
        const budget=Number.isFinite(requestedBudget)?clamp(requestedBudget,0,decodedLimit):decodedLimit;
        if(size>budget)throw Error('Fauna audio exceeds decoded memory budget');
        for(const [id] of this.cache){
          if(this.cacheBytes()+size<=budget)break;
          if(![...this.voices].some(v=>v.clip.id===id))this.cache.delete(id);
        }
        if(this.cacheBytes()+size>budget)throw Error('Fauna audio cache is full');
        session.throwIfAborted();if(!this.disposed)this.cache.set(clip.id,buffer);
      }catch(error){controller.abort(error);if(!session.aborted&&!this.disposed)this.fail(clip,error);}
      finally {clearTimeout(timer);session.removeEventListener('abort',abort);}
    });
    this.queue=job.catch(()=>{});
    this.pending.set(clip.id,job);
    void job.finally(()=>{if(this.pending.get(clip.id)===job)this.pending.delete(clip.id);}).catch(()=>{});
  }
  private async read(response:Response,signal:AbortSignal):Promise<ArrayBuffer> {
    const cap=2*1024**2,declared=Number(response.headers.get('content-length'));
    if(declared>cap){await response.body?.cancel();throw Error('Fauna audio exceeds download budget');}
    if(!response.body){const b=await abortable(response.arrayBuffer(),signal);this.receivedBytes+=b.byteLength;if(b.byteLength>cap)throw Error('Fauna audio exceeds download budget');return b;}
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0,complete=false;
    const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
    try {
      while(true){
        const {done,value}=await abortable(reader.read(),signal);signal.throwIfAborted();if(done){complete=true;break;}
        size+=value.byteLength;this.receivedBytes+=value.byteLength;if(size>cap)throw Error('Fauna audio exceeds download budget');chunks.push(value);
      }
      const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result.buffer;
    }finally{signal.removeEventListener('abort',cancel);if(!complete)await reader.cancel().catch(()=>{});reader.releaseLock();}
  }
}
