import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { animatedActor, standingPose } from '../src/animated-actor.ts';

function fixture() {
  const scene = new THREE.Group(), ancestor = new THREE.Group();
  ancestor.name='normalization'; ancestor.scale.setScalar(1.76);
  scene.add(ancestor);
  const bone = new THREE.Bone(); bone.name='hips'; ancestor.add(bone);
  const geometry = new THREE.BoxGeometry(.4,1,.2);
  const count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4),4));
  const weights=new Float32Array(count*4); for(let i=0;i<count;i++) weights[i*4]=1;
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
  const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());
  ancestor.add(mesh); scene.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton([bone]));
  const walk = new THREE.AnimationClip('walk',2,[new THREE.VectorKeyframeTrack('hips.position',[0,.5,1,1.5,2],[0,0,0, 0,.05,0, 0,0,0, 0,-.05,0, 0,0,0])]);
  return {scene, ancestor, bone, mesh, walk};
}

test('native rig keeps the common mesh/bone ancestor and correct gameplay orientation',()=>{
  const f=fixture(), actor=animatedActor(f.scene,[f.walk]);
  actor.root.position.set(23,4,-7); actor.root.rotation.y=-Math.PI/2; actor.root.updateMatrixWorld(true);
  assert.equal(f.mesh.parent,f.ancestor); assert.equal(f.bone.parent,f.ancestor);
  const front=new THREE.Vector3(0,0,1).transformDirection(f.scene.matrixWorld);
  assert.ok(front.x>.99 && Math.abs(front.z)<1e-6);
  assert.equal(actor.diagnostics().skinnedMeshes,1);
  actor.update(2.5,.1); assert.ok(actor.diagnostics().walkTime>0);
  const before=actor.diagnostics(); actor.update(0,0);
  assert.deepEqual(actor.diagnostics(),before,'paused frame must not advance or change pose');
  for(let i=0;i<120;i++) actor.update(0,1/60);
  assert.ok(actor.diagnostics().walkWeight<1e-5);
  assert.ok(actor.diagnostics().bounds.min.every(Number.isFinite));
});

test('standing pose averages quaternions without invalidating rotation length',()=>{
  const walk=new THREE.AnimationClip('walk',2,[new THREE.QuaternionKeyframeTrack('hips.quaternion',[0,1,2],[0,0,0,1, 0,Math.SQRT1_2,0,Math.SQRT1_2, 0,0,0,1])]);
  const idle=standingPose(walk);
  const q=new THREE.Quaternion().fromArray(idle.tracks[0].values);
  assert.ok(Math.abs(q.length()-1)<1e-6);
  assert.equal(idle.name,'standing-derived-from-walk');
});

test('a static A-pose mesh cannot masquerade as an animated character',()=>{
  const f=fixture();
  assert.throws(()=>animatedActor(f.scene,[]),/walk clip/);
  assert.throws(()=>animatedActor(new THREE.Group(),[f.walk]),/no skin/);
});
