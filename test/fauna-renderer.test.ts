import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three/webgpu';
import type {GLTF} from 'three/addons/loaders/GLTFLoader.js';
import {FaunaScene,type FaunaAssetSpec} from '../src/fauna-renderer.ts';
import type {FaunaAgent} from '../src/fauna-simulation.ts';

const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
function bytes(json:object={asset:{version:'2.0'},scenes:[{nodes:[]}],scene:0}):ArrayBuffer {
  const text=JSON.stringify(json),content=new TextEncoder().encode(text.padEnd(Math.ceil(text.length/4)*4,' '));
  const data=new Uint8Array(20+content.length),v=new DataView(data.buffer);
  v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,data.length,true);v.setUint32(12,content.length,true);v.setUint32(16,0x4e4f534a,true);data.set(content,20);return data.buffer;
}
const glb=bytes();
const spec=(kind:FaunaAssetSpec['kind']='chicken'):FaunaAssetSpec=>({kind,status:'approved',url:`/${kind}.glb`,expectedBytes:glb.byteLength,
  sha256:createHash('sha256').update(new Uint8Array(glb)).digest('hex'),nativeForwardYaw:Math.PI,scaleToMeters:.5,origin:[3,1,4],
  locomotion:{mode:kind==='fish'?'swim':'walk',clip:kind==='fish'?'swim':'walk',speedMetersPerSecond:1}});
function fixture(clipName='walk'){
  const scene=new THREE.Group(),armature=new THREE.Group(),bone=new THREE.Bone();scene.name='Animal';armature.name='Armature';bone.name='Leg';
  scene.add(armature);armature.add(bone);
  const geometry=new THREE.BoxGeometry(2,2,2);geometry.translate(3,2,4);
  const count=geometry.attributes.position.count,weights=new Float32Array(count*4);
  for(let i=0;i<count;i++)weights[i*4]=1;
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4),4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  let imageCloses=0;const texture=new THREE.Texture();texture.image={width:8,height:8,close:()=>imageCloses++};
  const material=new THREE.MeshStandardMaterial({map:texture}),mesh=new THREE.SkinnedMesh(geometry,material);mesh.name='AnimalSkin';
  scene.add(mesh);scene.updateMatrixWorld(true);mesh.bind(new THREE.Skeleton([bone]));
  const middle=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.3);
  const clip=new THREE.AnimationClip(clipName,1,[new THREE.QuaternionKeyframeTrack('Leg.quaternion',[0,.5,1],[0,0,0,1,...middle.toArray(),0,0,0,1])]);
  const gltf={scene,scenes:[scene],animations:[clip],cameras:[],asset:{version:'2.0'},userData:{},parser:{}} as unknown as GLTF;
  return{gltf,mesh,bone,geometry,material,texture,imageCloses:()=>imageCloses};
}
const agent=(id='a',overrides:Partial<FaunaAgent>={}):FaunaAgent=>({id,kind:'chicken',x:0,y:2,z:0,heading:0,homeX:0,homeZ:0,
  phase:0,scale:1,radius:.5,halfHeight:.5,seed:1,time:0,moving:true,speed:1,...overrides});
const fakeFetch:typeof fetch=async()=>new Response(glb.slice(0),{headers:{'content-length':String(glb.byteLength)}});
function meshes(root:THREE.Object3D){const result:THREE.SkinnedMesh[]=[];root.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)result.push(o as THREE.SkinnedMesh);});return result;}

test('pending or missing assets produce no requests, placeholders, actors or audible agents',async()=>{
  let requests=0;const scene=new FaunaScene([{...spec(),status:'pending'}],{fetch:async()=>{requests++;throw Error('Must not fetch');}});
  await scene.load();scene.sync([agent()]);scene.update(.1,{x:0,z:0});
  assert.equal(requests,0);assert.equal(scene.root.children.length,0);assert.deepEqual(scene.visibleApprovedAgents(),[]);
  assert.equal(scene.diagnostics().instances,0);scene.dispose();
});

test('species cache loads serially once, checks integrity and passes the mobile/desktop texture limits',async()=>{
  for(const mobile of [true,false]){
    let downloads=0,fetching=0,parsing=0,maxFetch=0,maxParse=0;const limits:number[]=[];
    const scene=new FaunaScene([spec(),spec('donkey')],{mobile,fetch:async()=>{
      downloads++;fetching++;maxFetch=Math.max(maxFetch,fetching);await flush();fetching--;return new Response(glb.slice(0));
    },parseGLB:async(_bytes,context)=>{limits.push(context.textureLimit);parsing++;maxParse=Math.max(maxParse,parsing);await flush();parsing--;return fixture().gltf;}});
    await Promise.all([scene.load(),scene.load()]);await scene.load();
    assert.equal(downloads,2);assert.equal(maxFetch,1);assert.equal(maxParse,1);assert.deepEqual(limits,[mobile?512:2048,mobile?512:2048]);
    assert.equal(scene.diagnostics().loadedKinds.length,2);assert.equal(scene.diagnostics().receivedBytes,glb.byteLength*2);scene.dispose();
  }
});

test('whole-hierarchy wrappers normalise source feet and forward without touching shared skin geometry',async()=>{
  const source=fixture(),positions=Array.from(source.geometry.attributes.position.array),boneQuaternion=source.bone.quaternion.toArray();
  const scene=new FaunaScene([spec()],{fetch:fakeFetch,parseGLB:async()=>source.gltf});await scene.load();
  const a=agent('one',{heading:Math.PI/2,moving:false,speed:0}),b=agent('two',{x:10,moving:false,speed:0});
  scene.sync([a,b]);scene.update(.1,{x:0,z:0});scene.root.updateMatrixWorld(true);
  const [one,two]=meshes(scene.root);assert.notEqual(one.skeleton,two.skeleton);assert.notEqual(one.skeleton.bones[0],two.skeleton.bones[0]);
  assert.equal(one.geometry,source.geometry);assert.equal(two.material,source.material);assert.notEqual(one.skeleton,source.mesh.skeleton);
  const first=scene.root.children[0],box=new THREE.Box3().setFromObject(first,true);
  assert.ok(Math.abs(box.min.y-a.y)<1e-6);assert.ok(Math.abs(box.max.y-a.y-1)<1e-6);
  const forward=new THREE.Vector3(0,0,1).transformDirection(first.getObjectByName('metres-and-forward')!.matrixWorld);
  assert.ok(forward.distanceTo(new THREE.Vector3(1,0,0))<1e-6);
  assert.deepEqual(Array.from(source.geometry.attributes.position.array),positions);assert.deepEqual(source.bone.quaternion.toArray(),boneQuaternion);
  assert.equal(one.skeleton.bones[0].parent!.name,'Armature');scene.dispose();
});

test('near animation tracks actual speed and individual scale; pause and distant instances do not advance',async()=>{
  const source=fixture(),scene=new FaunaScene([spec()],{fetch:fakeFetch,parseGLB:async()=>source.gltf});await scene.load();
  const agents=[agent('half',{speed:.5}),agent('scaled',{x:2,scale:2,speed:1}),agent('far',{x:60}),agent('hidden',{x:100})];
  scene.sync(agents);scene.update(.1,{x:0,z:0});let stats=scene.diagnostics().actors;
  assert.equal(stats[0].rate,.5);assert.equal(stats[1].rate,.5);assert.ok(Math.abs(stats[0].clipTime-.05)<1e-8);
  assert.equal(stats[2].clipTime,0);assert.equal(stats[2].visible,true);assert.equal(stats[2].animated,false);assert.equal(stats[3].visible,false);
  assert.deepEqual(scene.visibleApprovedAgents().map(a=>a.id),['half','scaled','far']);
  const before=JSON.stringify(stats);scene.update(.1,{x:0,z:0},{paused:true});scene.update(0,{x:0,z:0});assert.equal(JSON.stringify(scene.diagnostics().actors),before);
  agents[0].speed=0;agents[0].moving=false;
  for(let i=0;i<40;i++)scene.update(.1,{x:0,z:0});stats=scene.diagnostics().actors;
  assert.ok(stats[0].weight<1e-8);assert.equal(stats[0].clipTime,.05);assert.equal(stats[0].rate,0);scene.dispose();
});

test('clone retirement releases only its skeleton; cache resources are disposed once with the scene',async()=>{
  const source=fixture();let geometries=0,materials=0,textures=0,boneTextures=0;
  source.geometry.addEventListener('dispose',()=>geometries++);source.material.addEventListener('dispose',()=>materials++);source.texture.addEventListener('dispose',()=>textures++);
  const scene=new FaunaScene([spec()],{fetch:fakeFetch,parseGLB:async()=>source.gltf});await scene.load();scene.sync([agent('a'),agent('b')]);
  const skin=meshes(scene.root)[0];skin.skeleton.computeBoneTexture();skin.skeleton.boneTexture!.addEventListener('dispose',()=>boneTextures++);
  scene.sync([agent('b')]);assert.equal(boneTextures,1);assert.equal(geometries,0);assert.equal(materials,0);assert.equal(textures,0);
  scene.dispose();scene.dispose();assert.equal(geometries,1);assert.equal(materials,1);assert.equal(textures,1);assert.equal(source.imageCloses(),1);
  assert.equal(scene.root.children.length,0);assert.equal(scene.diagnostics().loadedKinds.length,0);
});

test('instance count is capped at48 and fish normalization uses the supplied centre and swim profile',async()=>{
  const source=fixture(),scene=new FaunaScene([spec()],{fetch:fakeFetch,parseGLB:async()=>source.gltf});await scene.load();
  scene.sync(Array.from({length:80},(_,i)=>agent(String(i))));assert.equal(scene.diagnostics().instances,48);scene.dispose();
  const fishSource=fixture('swim'),fishSpec={...spec('fish'),origin:[3,2,4] as const};
  const fishScene=new FaunaScene([fishSpec],{fetch:fakeFetch,parseGLB:async()=>fishSource.gltf});await fishScene.load();
  fishScene.sync([agent('fish',{kind:'fish',y:-2,moving:false,speed:0})]);fishScene.update(.1,{x:0,z:0});
  fishScene.root.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(fishScene.root,true);assert.ok(Math.abs(box.getCenter(new THREE.Vector3()).y+2)<1e-6);fishScene.dispose();
});

test('wrong hash, unsupported dependencies and absent required clips fail optionally without actors',async()=>{
  let errors=0,parses=0;
  const bad=new FaunaScene([{...spec(),sha256:'0'.repeat(64)}],{fetch:fakeFetch,parseGLB:async()=>{parses++;return fixture().gltf;},onError:()=>{errors++;throw Error('Reporter failed');}});
  await bad.load();assert.equal(parses,0);assert.equal(errors,1);assert.deepEqual(bad.diagnostics().failedKinds,['chicken']);bad.dispose();
  const external=bytes({asset:{version:'2.0'},images:[{uri:'https://invalid.example/image.png'}]});
  const externalScene=new FaunaScene([{...spec(),sha256:undefined,expectedBytes:external.byteLength}],{fetch:async()=>new Response(external),parseGLB:async()=>{parses++;return fixture().gltf;}});
  await externalScene.load();assert.equal(parses,0);assert.match(externalScene.diagnostics().errors.chicken!,/URI/);externalScene.dispose();
  const noClip=new FaunaScene([spec()],{fetch:fakeFetch,parseGLB:async()=>fixture('different').gltf});await noClip.load();
  noClip.sync([agent()]);assert.equal(noClip.diagnostics().instances,0);assert.match(noClip.diagnostics().errors.chicken!,/Missing fauna clip/);noClip.dispose();
});

test('abort during parse releases late resources and does not begin a second species',async()=>{
  let resolve!:(gltf:GLTF)=>void,started=false,requests=0;
  const source=fixture();let disposed=0;source.geometry.addEventListener('dispose',()=>disposed++);
  const scene=new FaunaScene([spec(),spec('donkey')],{fetch:async()=>{requests++;return new Response(glb.slice(0));},parseGLB:async()=>{started=true;return new Promise(r=>resolve=r);}});
  const loading=scene.load();while(!started)await flush();scene.dispose();await loading;
  resolve(source.gltf);await flush();assert.equal(disposed,1);assert.equal(requests,1);assert.equal(scene.diagnostics().instances,0);assert.equal(scene.diagnostics().loadedKinds.length,0);
});

test('a timeout retains the native decode slot so the next GLB cannot overlap it',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let resolve!:(gltf:GLTF)=>void,started=false,requests=0;
  const source=fixture();
  const scene=new FaunaScene([spec(),spec('donkey')],{timeoutMs:10,fetch:async()=>{requests++;return new Response(glb.slice(0));},parseGLB:async()=>{started=true;return new Promise(r=>resolve=r);}});
  const loading=scene.load();while(!started)await flush();t.mock.timers.tick(11);await flush();
  assert.equal(requests,1);t.mock.timers.tick(11);await loading;assert.equal(requests,1);
  assert.equal(scene.diagnostics().failedKinds.length,2);scene.dispose();resolve(source.gltf);await flush();
});

test('the production GLTF parser runs CPU-only and rejects a skinless source instead of showing a placeholder',async()=>{
  const scene=new FaunaScene([spec()],{fetch:fakeFetch});await scene.load();scene.sync([agent()]);
  assert.equal(scene.diagnostics().instances,0);assert.match(scene.diagnostics().errors.chicken!,/skin and skeleton/);scene.dispose();
});
