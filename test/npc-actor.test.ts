import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import * as THREE from 'three/webgpu';import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {loadNpcActor} from '../src/npc-actor.ts';import {npcManifest,NPC_SOURCE_SHA256,type NpcAsset,type NpcCatalog} from '../src/npc-assets.ts';
import {characterDiagnostics} from '../src/character-quality.ts';
import {readFileSync} from 'node:fs';
const json=new TextEncoder().encode('{"asset":{"version":"2.0"},"scene":0,"scenes":[{}]}'.padEnd(52,' '));
const bytes=new Uint8Array(20+json.length),v=new DataView(bytes.buffer);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,bytes.length,true);v.setUint32(12,json.length,true);v.setUint32(16,0x4e4f534a,true);bytes.set(json,20);
const hash=createHash('sha256').update(bytes).digest('hex');
const spec=(limit=512):NpcAsset=>({url:`/models/npc-r12/simao-${hash.slice(0,12)}.glb`,expectedBytes:bytes.length,sha256:hash,textureMaxSize:limit,idle:'simao-idle-r11',walk:'simao-walk-r11',walkSpeedMps:.7});
function fixture(){
 const scene=new THREE.Group(),bone=new THREE.Bone();bone.name='Foot';scene.add(bone);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.1,0,0,0,1,0],3));geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(12),4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
 const material=new THREE.MeshStandardMaterial(),mesh=new THREE.SkinnedMesh(geometry,material);scene.add(mesh);scene.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton([bone]));
 const idle=new THREE.AnimationClip('simao-idle-r11',1,[new THREE.VectorKeyframeTrack('Foot.position',[0,1],[0,.02,0,0,.02,0])]);
 const walk=new THREE.AnimationClip('simao-walk-r11',1,[new THREE.VectorKeyframeTrack('Foot.position',[0,.5,1],[0,0,0,0,.1,.2,0,0,0])]);
 const gltf={scene,scenes:[scene],animations:[idle,walk],cameras:[],asset:{version:'2.0'},parser:{},userData:{}} as unknown as GLTF;
 return{gltf,geometry,material,bone};
}
const fetchOK:typeof fetch=async()=>new Response(bytes.slice());
test('a real skin is cloned and idle is applied before visibility; pause freezes mixer and disposal removes actor',async()=>{
 const f=fixture(),limits:number[]=[],actor=await loadNpcActor(spec(),{fetch:fetchOK,parseGLB:async(_bytes,c)=>{limits.push(c.textureLimit);return f.gltf;}});
 assert.equal(actor.root.visible,false);assert.deepEqual(limits,[512]);const cloned=actor.root.getObjectByName('Foot')!;assert.notEqual(cloned,f.bone);assert.ok(Math.abs(cloned.position.y-.02)<1e-6);assert.equal(f.bone.position.y,0);
 const scene=new THREE.Scene();scene.add(actor.root);actor.place({x:3,z:2},.4,1);actor.update(.05,.7,true);assert.equal(characterDiagnostics(scene).npcs,1);assert.equal(characterDiagnostics(scene).primitiveHumanMeshes,0);
 const before=actor.diagnostics();actor.update(.05,.7,true,true);assert.equal(actor.diagnostics().mixerTime,before.mixerTime);assert.equal(actor.diagnostics().walkTime,before.walkTime);
 let disposed=0;f.geometry.addEventListener('dispose',()=>disposed++);actor.dispose();actor.dispose();assert.equal(disposed,1);assert.equal(characterDiagnostics(scene).npcs,0);
});
test('404, integrity mismatch, invalid URL or missing rig reject without a fallback actor',async()=>{
 let parsed=0;await assert.rejects(loadNpcActor(spec(),{fetch:async()=>new Response('',{status:404}),parseGLB:async()=>{parsed++;return fixture().gltf;}}),/HTTP 404/);assert.equal(parsed,0);
 const wrong={...spec(),sha256:'a'.repeat(64),url:`/models/npc-r12/simao-${'a'.repeat(12)}.glb`};await assert.rejects(loadNpcActor(wrong,{fetch:fetchOK,parseGLB:async()=>{parsed++;return fixture().gltf;}}),/integrity/);assert.equal(parsed,0);
 await assert.rejects(loadNpcActor({...spec(),url:'https://arbitrary.example/model.glb'},{fetch:fetchOK}),/pinned/);
 const f=fixture();f.gltf.scene.clear();await assert.rejects(loadNpcActor(spec(),{fetch:fetchOK,parseGLB:async()=>f.gltf}),/skin/);
});
test('a parse completing after cancellation is disposed, and never becomes an actor',async()=>{
 const f=fixture(),controller=new AbortController();let complete!:(g:GLTF)=>void,started!:()=>void;const parsing=new Promise<void>(r=>started=r);let disposed=0;
 f.geometry.addEventListener('dispose',()=>disposed++);
 const task=loadNpcActor(spec(),{signal:controller.signal,fetch:fetchOK,parseGLB:()=>{started();return new Promise(r=>complete=r);}});
 await parsing;controller.abort(new Error('left page'));await assert.rejects(task,/left page/);complete(f.gltf);await new Promise(r=>setImmediate(r));assert.equal(disposed,1);
});
test('profile selection keeps mobile budget and rejects arbitrary endpoints or unreviewed conventions',()=>{
 const profile={...spec(),url:spec().url.slice(1)},catalog:NpcCatalog={schemaVersion:1,id:'simao-r12',approval:'reviewed-integration-candidate',sourceSha256:NPC_SOURCE_SHA256,units:'meters',nativeForward:'-Z',groundY:0,animation:{idle:spec().idle,walk:spec().walk,walkSpeedMps:.7},profiles:{mobile:profile,desktop:{...profile,textureMaxSize:1024}}};
 assert.equal(npcManifest(catalog,true).textureMaxSize,512);assert.equal(npcManifest(catalog,false,'/preview/').url,`/preview/${profile.url}`);
 assert.throws(()=>npcManifest({...catalog,nativeForward:'+Z'},true),/catalogue/);assert.throws(()=>npcManifest(catalog,true,'https://external/'),/same-origin/);
 assert.throws(()=>npcManifest({...catalog,profiles:{...catalog.profiles,mobile:{...profile,url:'//external/file.glb'}}},true),/pinned/);
});
test('the configured Vite base reaches the NPC fetch while external and traversing bases stay rejected',async()=>{
 const vite=readFileSync(new URL('../vite.config.ts',import.meta.url),'utf8');
 const base=/base:\s*"([^"]+)"/.exec(vite)![1];assert.equal(base,'./');
 const profile={...spec(),url:spec().url.slice(1)},catalog:NpcCatalog={schemaVersion:1,id:'simao-r12',approval:'reviewed-integration-candidate',sourceSha256:NPC_SOURCE_SHA256,units:'meters',nativeForward:'-Z',groundY:0,animation:{idle:spec().idle,walk:spec().walk,walkSpeedMps:.7},profiles:{mobile:profile,desktop:{...profile,textureMaxSize:1024}}};
 const asset=npcManifest(catalog,true,base);let requested='';
 const actor=await loadNpcActor(asset,{fetch:async input=>{requested=String(input);return new Response(bytes.slice());},parseGLB:async()=>fixture().gltf});
 assert.equal(requested,`./${profile.url}`);assert.equal(actor.root.visible,false);actor.dispose();
 for(const invalid of ['//host/','../','/../','./../','https://host/','./%2e%2e/','/bad?x=/','/bad\\path/'])assert.throws(()=>npcManifest(catalog,true,invalid),/same-origin/);
});
