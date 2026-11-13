import * as THREE from 'three/webgpu';

/** A held neutral pose derived from the complete supplied walk cycle.
 * This is explicitly not a separately authored idle animation. */
export function standingPose(walk: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = walk.tracks.map(track => {
    const sample = (track as THREE.KeyframeTrack & { createInterpolant(result: Float32Array): THREE.Interpolant })
      .createInterpolant(new Float32Array(track.getValueSize()));
    let value = Array.from(sample.evaluate(0));
    for (let i=1;i<24;i++) {
      const next = Array.from(sample.evaluate(walk.duration*i/24));
      if (track.ValueTypeName === 'quaternion') {
        value = new THREE.Quaternion().fromArray(value).slerp(new THREE.Quaternion().fromArray(next),1/(i+1)).toArray();
      } else value=value.map((v,k)=>(v*i+next[k])/(i+1));
    }
    const result = track.clone();
    result.times = new Float32Array([0, 1]);
    result.values = new Float32Array([...value, ...value]);
    return result;
  });
  return new THREE.AnimationClip('standing-derived-from-walk', 1, tracks);
}

export function animatedActor(scene: THREE.Group, clips: THREE.AnimationClip[]) {
  const walk = clips.find(c => c.name.toLowerCase() === 'walk');
  if (!walk) throw new Error('Animated actor requires the reviewed walk clip');
  let bones = 0, skinnedMeshes = 0;
  scene.traverse(o => {
    if ((o as THREE.Bone).isBone) bones++;
    if ((o as THREE.Mesh).isMesh) {
      const mesh = o as THREE.Mesh;
      mesh.castShadow = mesh.receiveShadow = true;
    }
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
      skinnedMeshes++;
      // The only hero is always near the camera. Rest-pose bounds must not cull moving limbs.
      o.frustumCulled = false;
    }
  });
  if (!skinnedMeshes || !bones) throw new Error('Animated actor has no skin/skeleton');
  const root = new THREE.Group();
  const visual = new THREE.Group();
  visual.rotation.y = Math.PI; // delivered +Z -> gameplay -Z; bones and mesh turn together
  root.add(visual); visual.add(scene);
  const mixer = new THREE.AnimationMixer(scene);
  const walkAction = mixer.clipAction(walk).play();
  const idleAction = mixer.clipAction(standingPose(walk)).play();
  let weight = 0;
  walkAction.setEffectiveWeight(0);
  idleAction.setEffectiveWeight(1);
  mixer.update(0);
  root.updateMatrixWorld(true);
  const standingOffset=-new THREE.Box3().setFromObject(root,true).min.y;
  visual.position.y=standingOffset;
  return {
    root,
    update(speed: number, dt: number) {
      if (dt <= 0) return;
      weight = THREE.MathUtils.damp(weight, speed > 0.06 ? 1 : 0, 12, dt);
      walkAction.setEffectiveWeight(weight);
      idleAction.setEffectiveWeight(1 - weight);
      visual.position.y=standingOffset*(1-weight);
      walkAction.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / 2.5, 0.55, 2.1));
      mixer.update(dt);
    },
    diagnostics() {
      const box = new THREE.Box3().setFromObject(root, true);
      const skeleton: number[] = [];
      scene.traverse(o => { if ((o as THREE.Bone).isBone) skeleton.push(...o.quaternion.toArray()); });
      return { bones, skinnedMeshes, clips: clips.map(c => c.name), walkTime: walkAction.time,
        walkWeight: weight, idle: 'derived-standing-pose', bounds: { min: box.min.toArray(), max: box.max.toArray() }, skeleton };
    },
  };
}
