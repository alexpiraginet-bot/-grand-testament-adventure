import * as THREE from 'three/webgpu';
import {GLTFLoader,type GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {LimitedTextureLoader} from './limited-textures.ts';
import {abortable,readAssetBody} from './asset-loading.ts';
import type {NpcAsset} from './npc-assets.ts';
import type {Vec2} from './missions.ts';

export interface NpcLoadOptions{signal?:AbortSignal;timeoutMs?:number;fetch?:typeof fetch;
 parseGLB?:(bytes:ArrayBuffer,context:{signal:AbortSignal;textureLimit:number})=>Promise<GLTF>}
function selfContained(bytes:ArrayBuffer){
 const v=new DataView(bytes);if(bytes.byteLength<20||v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==bytes.byteLength||v.getUint32(16,true)!==0x4e4f534a)throw Error('Invalid NPC GLB');
 const length=v.getUint32(12,true);if(length>bytes.byteLength-20)throw Error('Invalid NPC GLB JSON');
 const json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)));
 if([...json.buffers??[],...json.images??[]].some((item:{uri?:string})=>item.uri))throw Error('NPC GLB must have embedded resources');
}
/** Owns only its loaded GLB and cloned skeleton. No resources are shared with the world/fauna. */
export class NpcActor{
 readonly root=new THREE.Group();readonly id='simao';private mixer:THREE.AnimationMixer;
 private idle:THREE.AnimationAction;private walk:THREE.AnimationAction;private weight=0;private disposed=false;
 private model:THREE.Object3D;readonly spec:NpcAsset;private release:()=>void;
 constructor(gltf:GLTF,spec:NpcAsset,release:()=>void){
  this.spec=spec;this.release=release;
  const get=(name:string)=>{const clip=gltf.animations.find(c=>c.name===name);if(!clip||clip.duration<=0||!Number.isFinite(clip.duration)||!clip.tracks.length)throw Error('Missing reviewed NPC clip');return clip;};
  let skins=0;gltf.scene.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)skins++;});if(!skins)throw Error('NPC requires reviewed skin');
  const idle=get(spec.idle),walk=get(spec.walk);this.model=cloneSkeleton(gltf.scene);this.root.add(this.model);
  this.root.name='character:simao';this.root.userData.character={id:'simao',role:'npc',source:`npc-r12/${spec.sha256}`};
  this.model.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh){mesh.castShadow=mesh.receiveShadow=true;if((mesh as THREE.SkinnedMesh).isSkinnedMesh)mesh.frustumCulled=false;}});
  this.mixer=new THREE.AnimationMixer(this.model);this.idle=this.mixer.clipAction(idle).play();this.walk=this.mixer.clipAction(walk).play();
  this.idle.setEffectiveWeight(1);this.walk.setEffectiveWeight(0);this.mixer.update(0);this.root.visible=false;
 }
 place(pos:Vec2,y:number,heading:number){this.root.position.set(pos.x,y,pos.z);this.root.rotation.y=-heading;}
 update(dt:number,speed:number,visible:boolean,paused=false){
  if(this.disposed)return;this.root.visible=visible;if(paused||!visible||!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,.05);this.weight=THREE.MathUtils.damp(this.weight,speed>.02?1:0,12,dt);
  this.walk.setEffectiveWeight(this.weight);this.idle.setEffectiveWeight(1-this.weight);this.walk.setEffectiveTimeScale(Math.max(0,Math.min(1.25,speed/this.spec.walkSpeedMps)));this.mixer.update(dt);
 }
 diagnostics(){return{id:this.id,visible:this.root.visible,weight:this.weight,idleTime:this.idle.time,walkTime:this.walk.time,mixerTime:this.mixer.time,
  clips:{idle:this.idle.getClip().name,walk:this.walk.getClip().name},textureLimit:this.spec.textureMaxSize,bytes:this.spec.expectedBytes,sha256:this.spec.sha256};}
 dispose(){if(this.disposed)return;this.disposed=true;this.root.visible=false;this.root.removeFromParent();this.mixer.stopAllAction();this.mixer.uncacheRoot(this.model);
  this.model.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)(o as THREE.SkinnedMesh).skeleton.dispose();});this.root.clear();this.release();}
}
/** Caller catches this optional promise; failure never starts a placeholder or invisible collider. */
export async function loadNpcActor(spec:NpcAsset,options:NpcLoadOptions={}):Promise<NpcActor>{
 if(!/^(?:\/|\.\/)(?:[a-zA-Z0-9_-]+\/)*models\/npc-r12\/[a-z0-9-]+\.glb$/.test(spec.url)||!/^[a-f0-9]{64}$/.test(spec.sha256)||!spec.url.includes(spec.sha256.slice(0,12))||!Number.isSafeInteger(spec.expectedBytes)||spec.expectedBytes<20||spec.expectedBytes>(spec.textureMaxSize===512?1000000:2000000)||![512,1024].includes(spec.textureMaxSize))throw Error('Invalid pinned NPC profile');
 const owner=new AbortController(),abort=()=>owner.abort(options.signal?.reason);options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();
 const timeout=Math.max(1,Math.min(30000,options.timeoutMs??20000));let manager:THREE.LoadingManager|undefined,limited:LimitedTextureLoader|undefined,result:GLTF|undefined;
 const timer=setTimeout(()=>owner.abort(new DOMException('Optional NPC timed out','TimeoutError')),timeout),disposed=new WeakSet<object>();
 const dispose=(asset?:GLTF)=>{
  const resources=new Set<{dispose():void}>(limited?.pendingTextures??[]),images=new Set<{close?:()=>void}>();
  asset?.scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;resources.add(mesh.geometry);if((mesh as THREE.SkinnedMesh).isSkinnedMesh)resources.add((mesh as THREE.SkinnedMesh).skeleton);
   for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){resources.add(mat);for(const value of Object.values(mat))if(value?.isTexture){resources.add(value);if(value.image)images.add(value.image);}}});
  for(const tex of limited?.pendingTextures??[])if(tex.image)images.add(tex.image);
  for(const image of images)if(!disposed.has(image)){image.close?.();disposed.add(image);}
  for(const resource of resources)if(!disposed.has(resource)){resource.dispose();disposed.add(resource);}limited?.pendingTextures.clear();
 };
 try{
  owner.signal.throwIfAborted();const response=await abortable((options.fetch??fetch)(spec.url,{signal:owner.signal}),owner.signal);
  const bytes=await readAssetBody(response,spec.expectedBytes,()=>{},owner.signal);selfContained(bytes);
  const digest=await abortable(crypto.subtle.digest('SHA-256',bytes),owner.signal),hash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');if(hash!==spec.sha256)throw Error('NPC integrity mismatch');
  let parsing:Promise<GLTF>,textureErrors=0;
  if(options.parseGLB)parsing=options.parseGLB(bytes,{signal:owner.signal,textureLimit:spec.textureMaxSize});
  else{manager=new THREE.LoadingManager();manager.onError=()=>textureErrors++;const loader=new GLTFLoader(manager);
   loader.register(parser=>{limited=new LimitedTextureLoader(manager!,spec.textureMaxSize,owner.signal);parser.textureLoader=limited as unknown as THREE.TextureLoader;return{name:'GTA_npc_texture_budget'};});parsing=loader.parseAsync(bytes,'');}
  void parsing.then(asset=>{if(owner.signal.aborted)dispose(asset);},()=>{});
  result=await abortable(parsing,owner.signal);owner.signal.throwIfAborted();if(textureErrors)throw Error('NPC texture failed');
  return new NpcActor(result,spec,()=>dispose(result));
 }catch(error){owner.abort(error);manager?.abort();dispose(result);throw error;}
 finally{clearTimeout(timer);options.signal?.removeEventListener('abort',abort);}
}
