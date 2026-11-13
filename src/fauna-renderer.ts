// Optional original fauna only. No catalogue, placeholder, main-loop activation or approval is supplied here.
import * as THREE from 'three/webgpu';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {LimitedTextureLoader} from './limited-textures.ts';
import {abortable,readAssetBody} from './asset-loading.ts';
import type {FaunaAgent,FaunaKind} from './fauna-simulation.ts';

export interface FaunaAssetSpec {
  kind:FaunaKind;status:'approved'|'pending';url:string;expectedBytes:number;sha256?:string;
  /** Native +Z => PI, native +X => -PI/2. Three.js Y rotation from -Z to native forward. */
  nativeForwardYaw:number;scaleToMeters:number;
  /** Source scene coordinates from its inspected bounds: horizontal centre + feet (land), full centre (fish). */
  origin:readonly [number,number,number];
  /** Clip must be visually reviewed and in-place; the framework does not certify a moving-leg gait. */
  locomotion:{mode:'walk'|'swim';clip:string;speedMetersPerSecond:number};
  idleClip?:string;
  /** Reviewed stationary frame; default is locomotion frame zero, never an invented idle animation. */
  idlePose?:{clip:string;time:number};
}
export interface FaunaSceneOptions {
  mobile?:boolean;signal?:AbortSignal;maxAgents?:number;animateRadius?:number;visibleRadius?:number;
  timeoutMs?:number;maxAssetBytes?:number;fetch?:typeof fetch;
  onError?:(kind:FaunaKind,error:unknown)=>void;
  /** CPU test/custom-parser seam. Production uses GLTFLoader + LimitedTextureLoader. */
  parseGLB?:(bytes:ArrayBuffer,context:{signal:AbortSignal;textureLimit:number})=>Promise<GLTF>;
}
type Asset={spec:FaunaAssetSpec;gltf:GLTF;locomotion:THREE.AnimationClip;idle:THREE.AnimationClip};
type Actor={agent:FaunaAgent;root:THREE.Group;scene:THREE.Object3D;mixer:THREE.AnimationMixer;
  move:THREE.AnimationAction;idle:THREE.AnimationAction;weight:number;rate:number;animated:boolean};
const knownKinds:readonly FaunaKind[]=['chicken','donkey','goat','sheep','fish'];
const bounded=(value:number,min:number,max:number,name:string)=>{
  if(!Number.isFinite(value)||value<min||value>max)throw Error(`Invalid fauna ${name}`);return value;
};
const validAgent=(a:FaunaAgent)=>[a.x,a.y,a.z,a.heading,a.scale,a.speed].every(Number.isFinite)&&a.scale>0&&a.speed>=0;

/** Reject external dependencies: the measured/hashable GLB must contain its own buffers and textures. */
function checkGLB(bytes:ArrayBuffer){
  const view=new DataView(bytes);
  if(bytes.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength)
    throw Error('Invalid self-contained fauna GLB');
  const length=view.getUint32(12,true);
  if(view.getUint32(16,true)!==0x4e4f534a||20+length>bytes.byteLength)throw Error('Invalid fauna GLB JSON');
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)));
  if([...json.buffers??[],...json.images??[]].some((entry:{uri?:string})=>entry.uri))throw Error('Fauna GLB has external/data URI resources');
}
function heldPose(clip:THREE.AnimationClip,time:number){
  bounded(time,0,clip.duration,'idle pose time');
  const tracks=clip.tracks.map(track=>{
    if(!['number','vector','quaternion'].includes(track.ValueTypeName))throw Error('Unsupported fauna idle-pose track');
    const interpolant=(track as THREE.KeyframeTrack&{createInterpolant(result:Float32Array):THREE.Interpolant}).createInterpolant(new Float32Array(track.getValueSize()));
    const values=Array.from(interpolant.evaluate(time)),result=track.clone();
    result.times=new Float32Array([0,1]);result.values=new Float32Array([...values,...values]);return result;
  });
  return new THREE.AnimationClip(`fauna-held:${clip.name}:${time}`,1,tracks);
}
function validateAsset(spec:FaunaAssetSpec,gltf:GLTF):Asset {
  let skins=0,bones=0;gltf.scene.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)skins++;if((o as THREE.Bone).isBone)bones++;});
  if(!skins||!bones)throw Error('Approved fauna requires its original skin and skeleton');
  const find=(name:string)=>{
    const clip=gltf.animations.find(c=>c.name===name);
    if(!clip||!Number.isFinite(clip.duration)||clip.duration<=0||!clip.tracks.length)throw Error(`Missing fauna clip: ${name}`);return clip;
  };
  const locomotion=find(spec.locomotion.clip);
  const idle=spec.idleClip?find(spec.idleClip):heldPose(spec.idlePose?find(spec.idlePose.clip):locomotion,spec.idlePose?.time??0);
  if(idle===locomotion)throw Error('Fauna idle and locomotion must use separate actions');
  return{spec,gltf,locomotion,idle};
}

export class FaunaScene {
  readonly root=new THREE.Group();
  readonly textureLimit:number;
  private manifest:readonly FaunaAssetSpec[];
  private options:FaunaSceneOptions;
  private owner=new AbortController();
  private assets=new Map<FaunaKind,Asset>();
  private actors=new Map<string,Actor>();
  private failed=new Map<FaunaKind,string>();
  private pending=new Map<FaunaKind,Promise<void>>();
  private queue:Promise<void>=Promise.resolve();
  private nativeParsing:Promise<unknown>=Promise.resolve();
  private disposed=false;
  private receivedBytes=0;
  private maxAgents:number;private animateRadius:number;private visibleRadius:number;
  private disposedResources=new WeakSet<object>();
  private externalAbort:()=>void;

  constructor(manifest:readonly FaunaAssetSpec[],options:FaunaSceneOptions={}){
    this.manifest=manifest;this.options=options;this.textureLimit=options.mobile?512:2048;
    this.maxAgents=Math.floor(bounded(options.maxAgents??48,0,48,'instance cap'));
    this.visibleRadius=bounded(options.visibleRadius??90,1,200,'visible radius');
    this.animateRadius=bounded(options.animateRadius??45,0,this.visibleRadius,'animation radius');
    this.root.name='approved-fauna';
    this.externalAbort=()=>this.dispose();options.signal?.addEventListener('abort',this.externalAbort,{once:true});
    if(options.signal?.aborted)this.dispose();
  }
  /** Optional work: failures are recorded per species and never reject or block the game's Go handler. */
  async load(kinds:readonly FaunaKind[]=knownKinds):Promise<void>{
    if(this.disposed)return;
    const jobs:Promise<void>[]=[];
    for(const spec of this.manifest){
      if(spec.status!=='approved'||!kinds.includes(spec.kind)||this.assets.has(spec.kind)||this.failed.has(spec.kind))continue;
      let job=this.pending.get(spec.kind);
      if(!job){
        job=this.queue.then(()=>this.loadOne(spec));this.queue=job.catch(()=>{});this.pending.set(spec.kind,job);
        void job.finally(()=>{if(this.pending.get(spec.kind)===job)this.pending.delete(spec.kind);}).catch(()=>{});
      }
      jobs.push(job);
    }
    await Promise.all(jobs);
  }
  private async loadOne(spec:FaunaAssetSpec):Promise<void>{
    if(this.disposed)return;
    const owner=new AbortController(),abort=()=>owner.abort(this.owner.signal.reason);
    this.owner.signal.addEventListener('abort',abort,{once:true});
    let timer:ReturnType<typeof setTimeout>|undefined,limited:LimitedTextureLoader|undefined,manager:THREE.LoadingManager|undefined,result:GLTF|undefined;
    try{
      if(!knownKinds.includes(spec.kind)||!spec.url)throw Error('Invalid fauna species/URL');
      const cap=bounded(this.options.maxAssetBytes??32*1024**2,1,64*1024**2,'asset byte budget');
      if(!Number.isSafeInteger(spec.expectedBytes))throw Error('Invalid fauna expected bytes');
      bounded(spec.expectedBytes,20,cap,'expected bytes');bounded(spec.scaleToMeters,.00001,1000,'scale');
      if(spec.origin.length!==3||!spec.origin.every(Number.isFinite)||!Number.isFinite(spec.nativeForwardYaw))throw Error('Invalid fauna origin/forward profile');
      bounded(spec.locomotion.speedMetersPerSecond,.001,100,'authored locomotion speed');
      if(spec.locomotion.mode!==(spec.kind==='fish'?'swim':'walk'))throw Error('Fauna locomotion mode does not match species');
      if(spec.sha256&&!/^[a-f0-9]{64}$/i.test(spec.sha256))throw Error('Invalid fauna SHA-256');
      timer=setTimeout(()=>owner.abort(new DOMException('Optional fauna asset timed out','TimeoutError')),bounded(this.options.timeoutMs??30000,1,60000,'load timeout'));
      // A timed-out native parser can finish late; never overlap it with another GLB decode.
      await abortable(this.nativeParsing,owner.signal);owner.signal.throwIfAborted();
      const response=await abortable((this.options.fetch??fetch)(spec.url,{signal:owner.signal}),owner.signal);
      const bytes=await readAssetBody(response,spec.expectedBytes,n=>{this.receivedBytes+=n;},owner.signal);checkGLB(bytes);
      if(spec.sha256){
        const digest=await abortable(crypto.subtle.digest('SHA-256',bytes),owner.signal);
        if(Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')!==spec.sha256.toLowerCase())throw Error('Fauna asset integrity mismatch');
      }
      let parsing:Promise<GLTF>,textureErrors=0;
      if(this.options.parseGLB)parsing=this.options.parseGLB(bytes,{signal:owner.signal,textureLimit:this.textureLimit});
      else{
        manager=new THREE.LoadingManager();manager.onError=()=>{textureErrors++;};
        const loader=new GLTFLoader(manager);
        loader.register(parser=>{limited=new LimitedTextureLoader(manager!,this.textureLimit,owner.signal);parser.textureLoader=limited as unknown as THREE.TextureLoader;return{name:'GTA_fauna_texture_budget'};});
        parsing=loader.parseAsync(bytes,'');
      }
      this.nativeParsing=parsing.then(()=>{},()=>{});
      parsing.then(asset=>{if(owner.signal.aborted||this.disposed)this.disposeAsset(asset,limited?.pendingTextures);},()=>{});
      result=await abortable(parsing,owner.signal);owner.signal.throwIfAborted();
      if(textureErrors)throw Error(`Fauna asset has ${textureErrors} failed textures`);
      const asset=validateAsset(spec,result);
      if(this.disposed)throw Error('Fauna scene disposed');
      // Keep texture-loader-owned intermediates with the cache; clones share the final resources.
      result.userData.faunaPendingTextures=limited?.pendingTextures;
      this.assets.set(spec.kind,asset);
    }catch(error){
      owner.abort(error);manager?.abort();this.disposeAsset(result,limited?.pendingTextures);
      if(!this.disposed){this.failed.set(spec.kind,String(error));try{this.options.onError?.(spec.kind,error);}catch{/* Optional reporting must not reject load. */}}
    }finally{if(timer!==undefined)clearTimeout(timer);this.owner.signal.removeEventListener('abort',abort);}
  }
  sync(agents:readonly FaunaAgent[]):void {
    if(this.disposed)return;
    const selected=new Map<string,FaunaAgent>();
    for(const a of agents){if(selected.size>=this.maxAgents)break;if(validAgent(a)&&this.assets.has(a.kind)&&!selected.has(a.id))selected.set(a.id,a);}
    for(const [id,actor] of this.actors)if(!selected.has(id)||selected.get(id)!.kind!==actor.agent.kind){this.retire(actor);this.actors.delete(id);}
    for(const [id,agent] of selected){
      const previous=this.actors.get(id);if(previous){previous.agent=agent;continue;}
      const asset=this.assets.get(agent.kind)!,scene=cloneSkeleton(asset.gltf.scene),root=new THREE.Group(),normalization=new THREE.Group(),origin=new THREE.Group();
      root.name=`fauna:${id}`;normalization.name='metres-and-forward';origin.name='source-origin';
      normalization.scale.setScalar(asset.spec.scaleToMeters);normalization.rotation.y=-asset.spec.nativeForwardYaw;
      origin.position.fromArray(asset.spec.origin).negate();root.add(normalization);normalization.add(origin);origin.add(scene);
      scene.traverse(o=>{if((o as THREE.Mesh).isMesh){const mesh=o as THREE.Mesh;mesh.castShadow=mesh.receiveShadow=true;if((mesh as THREE.SkinnedMesh).isSkinnedMesh)mesh.frustumCulled=false;}});
      const mixer=new THREE.AnimationMixer(scene),move=mixer.clipAction(asset.locomotion).play(),idle=mixer.clipAction(asset.idle).play();
      move.setEffectiveWeight(0);idle.setEffectiveWeight(1);mixer.update(0);
      root.position.set(agent.x,agent.y,agent.z);root.rotation.y=-agent.heading;root.scale.setScalar(agent.scale);root.visible=false;
      this.root.add(root);this.actors.set(id,{agent,root,scene,mixer,move,idle,weight:0,rate:0,animated:false});
    }
  }
  update(dt:number,player:{x:number;z:number},options:{paused?:boolean}={}):void {
    if(this.disposed||options.paused||!Number.isFinite(dt)||dt<=0||![player.x,player.z].every(Number.isFinite))return;
    dt=Math.min(dt,.1);
    for(const actor of this.actors.values()){
      const a=actor.agent;if(!validAgent(a)){actor.root.visible=false;actor.animated=false;continue;}
      const distance=Math.hypot(a.x-player.x,a.z-player.z);
      actor.root.visible=distance<=this.visibleRadius;actor.animated=distance<=this.animateRadius;
      actor.root.position.set(a.x,a.y,a.z);actor.root.rotation.y=-a.heading;actor.root.scale.setScalar(a.scale);
      if(!actor.animated)continue;
      actor.weight=THREE.MathUtils.damp(actor.weight,a.moving&&a.speed>.02?1:0,12,dt);
      actor.rate=THREE.MathUtils.clamp(a.speed/(this.assets.get(a.kind)!.spec.locomotion.speedMetersPerSecond*a.scale),0,3);
      actor.move.setEffectiveTimeScale(actor.rate);actor.move.setEffectiveWeight(actor.weight);actor.idle.setEffectiveWeight(1-actor.weight);
      actor.mixer.update(dt);
    }
  }
  /** Scene-visible by distance, with approved loaded meshes; this is not an occlusion/readback claim. */
  visibleApprovedAgents():FaunaAgent[]{return this.root.visible?[...this.actors.values()].filter(a=>a.root.visible).map(a=>a.agent):[];}
  diagnostics(){return{textureLimit:this.textureLimit,receivedBytes:this.receivedBytes,loadedKinds:[...this.assets.keys()],failedKinds:[...this.failed.keys()],
    errors:Object.fromEntries(this.failed),pending:this.pending.size,instances:this.actors.size,
    actors:[...this.actors].map(([id,a])=>({id,visible:a.root.visible,animated:a.animated,weight:a.weight,rate:a.rate,clipTime:a.move.time}))};}
  private retire(actor:Actor){
    actor.mixer.stopAllAction();actor.mixer.uncacheRoot(actor.scene);actor.root.removeFromParent();
    const skeletons=new Set<THREE.Skeleton>();actor.scene.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)skeletons.add((o as THREE.SkinnedMesh).skeleton);});
    for(const skeleton of skeletons)skeleton.dispose();
    // Clone geometry/material/texture belong to the species cache, not to this actor.
  }
  private disposeAsset(asset?:GLTF,extraTextures?:Set<THREE.Texture>){
    const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set(extraTextures),skeletons=new Set<THREE.Skeleton>();
    for(const scene of asset?.scenes??(asset?[asset.scene]:[]))scene.traverse(o=>{
      const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;geometries.add(mesh.geometry);
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(material);
      if((mesh as THREE.SkinnedMesh).isSkinnedMesh)skeletons.add((mesh as THREE.SkinnedMesh).skeleton);
    });
    for(const material of materials)for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
    for(const texture of textures){const image=texture.image as {close?:()=>void}|undefined;if(image&&!this.disposedResources.has(image)){image.close?.();this.disposedResources.add(image);}}
    for(const resource of [...textures,...geometries,...materials,...skeletons])if(!this.disposedResources.has(resource)){resource.dispose();this.disposedResources.add(resource);}
    extraTextures?.clear();
  }
  dispose():void {
    if(this.disposed)return;this.disposed=true;this.owner.abort(new DOMException('Fauna scene disposed','AbortError'));
    this.options.signal?.removeEventListener('abort',this.externalAbort);
    for(const actor of this.actors.values())this.retire(actor);this.actors.clear();
    for(const asset of this.assets.values())this.disposeAsset(asset.gltf,asset.gltf.userData.faunaPendingTextures as Set<THREE.Texture>|undefined);
    this.assets.clear();this.root.removeFromParent();this.root.clear();
  }
}
