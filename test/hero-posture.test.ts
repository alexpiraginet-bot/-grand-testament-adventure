import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import * as THREE from 'three/webgpu';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {animatedActor} from '../src/animated-actor.ts';

const file=new URL('../public/models/tripo-r1/heroi-2fe504810710.glb',import.meta.url);

/** CPU-only loading of the real geometry/skeleton/clip. Material images are omitted in memory;
 * no original GLB is modified, no network renderer is involved and pixels are not validated here. */
async function hero(){
  const bytes=readFileSync(file),jsonLength=bytes.readUInt32LE(12);
  const gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
  gltf.buffers[0].uri=`data:application/octet-stream;base64,${bytes.subarray(28+jsonLength).toString('base64')}`;
  delete gltf.images;delete gltf.textures;gltf.materials=[{}];
  for(const mesh of gltf.meshes)for(const primitive of mesh.primitives)primitive.material=0;
  if(typeof globalThis.ProgressEvent==='undefined')Object.defineProperty(globalThis,'ProgressEvent',{
    configurable:true,value:class extends Event{constructor(type:string,init:Record<string,unknown>){super(type);Object.assign(this,init);}},
  });
  const asset=await new GLTFLoader().parseAsync(JSON.stringify(gltf),'');
  return {...asset,actor:animatedActor(asset.scene,asset.animations)};
}

test('real hero gives a bounded one-handed invitation without altering the native skeleton or walk',{
  skip:!existsSync(file)?'Licensed runtime hero absent: run assets preparation before the real-rig check.':false,
},async()=>{
  const {scene,animations,actor}=await hero();
  const bone=(name:string)=>scene.getObjectByName(`mixamorig${name}`) as THREE.Bone;
  const position=(name:string)=>{actor.root.updateMatrixWorld(true);return bone(name).getWorldPosition(new THREE.Vector3());};
  const invariant: {bone:THREE.Bone;parent:THREE.Object3D|null;position:number[];scale:number[]}[]=[];
  scene.traverse(object=>{if((object as THREE.Bone).isBone)invariant.push({bone:object as THREE.Bone,parent:object.parent,position:object.position.toArray(),scale:object.scale.toArray()});});
  const animationBytes=JSON.stringify(animations.map(c=>THREE.AnimationClip.toJSON(c)));
  for(let i=0;i<120;i++)actor.update(0,1/60);
  const rightRest=position('RightHand'),leftRest=position('LeftHand');
  const idleBones=Object.fromEntries(invariant.map(({bone})=>[bone.name,bone.quaternion.clone()]));
  actor.update(0,1/60,true);
  assert.ok(position('RightHand').distanceTo(rightRest)<.08,'entry must blend rather than snap to the held pose');
  for(let i=0;i<150;i++)actor.update(0,1/60,true);
  const invited=position('RightHand');
  assert.ok(invited.y-rightRest.y>.20&&invited.y<position('RightArm').y,'invitation stays below shoulder height');
  assert.ok(invited.z<rightRest.z-.25,'the hand reaches forward in the verified gameplay -Z direction');
  assert.ok(position('LeftHand').distanceTo(leftRest)<.001,'the cloak-side arm keeps its relaxed standing pose');
  const headUp=new THREE.Vector3(0,1,0).applyQuaternion(bone('Head').getWorldQuaternion(new THREE.Quaternion()));
  assert.ok(headUp.y>.995,'head stays level');
  assert.ok(actor.diagnostics().posture.available);
  for(let i=0;i<300;i++)actor.update(0,1/60,true);
  assert.ok(position('RightHand').distanceTo(invited)<1e-4,'held offsets must not accumulate between mixer frames');
  const paused=actor.diagnostics();actor.update(0,0,false);assert.deepEqual(actor.diagnostics(),paused);
  for(let i=0;i<180;i++)actor.update(0,1/60,false);
  for(const {bone} of invariant){
    // Native float32 tracks are close to unit length; angleTo assumes normalized inputs.
    const angle=bone.quaternion.clone().normalize().angleTo(idleBones[bone.name].clone().normalize());
    assert.ok(angle<1e-6,`${bone.name}: return to standing changed by ${angle} radians`);
  }
  for(let i=0;i<120;i++)actor.update(2.5,1/60,true);
  const walking=actor.diagnostics();assert.ok(walking.walkWeight>.999&&walking.posture.weight<1e-6,'walking suppresses the invitation');
  assert.equal(JSON.stringify(animations.map(c=>THREE.AnimationClip.toJSON(c))),animationBytes,'animation clips are immutable');
  for(const record of invariant){
    assert.equal(record.bone.parent,record.parent);
    assert.ok(record.bone.quaternion.toArray().every(Number.isFinite));
    assert.ok(Math.abs(record.bone.quaternion.length()-1)<1e-5);
  }
  assert.ok(walking.bounds.min.every(Number.isFinite)&&walking.bounds.max.every(Number.isFinite));
});
