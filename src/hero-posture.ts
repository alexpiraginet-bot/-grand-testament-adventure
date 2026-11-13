import * as THREE from 'three/webgpu';

// Reviewed against heroi-2fe504810710.glb. GLTFLoader removes ':' from these Mixamo names.
// Each arm segment points down its local +Y. Gameplay forward is root-local -Z.
const NAMES=['Spine2','Neck','Head','LeftShoulder','RightShoulder','RightArm','RightForeArm','RightHand'] as const;
type Joint=typeof NAMES[number];

/** A procedural acting layer on the delivered skeleton, not a new Tripo animation clip.
 * Only rotations change. Skin weights, bind matrices, translations and the left arm remain intact.
 */
export function createHeroPosture(root:THREE.Group,scene:THREE.Group) {
  const bones=new Map<Joint,THREE.Bone>();
  for(const name of NAMES){
    const node=scene.getObjectByName(`mixamorig${name}`)??scene.getObjectByName(`mixamorig:${name}`);
    if((node as THREE.Bone|undefined)?.isBone)bones.set(name,node as THREE.Bone);
  }
  const valid=bones.size===NAMES.length && bones.get('RightForeArm')!.parent===bones.get('RightArm')
    && bones.get('RightHand')!.parent===bones.get('RightForeArm') && bones.get('Head')!.parent===bones.get('Neck');
  if(!valid)return {restore(){},apply(_speed:number,_dt:number,_idle:number,_invite:boolean){},diagnostics:()=>({available:false,kind:'procedural-invitation',weight:0,bones:[] as string[]})};
  const originals=new Map(NAMES.map(name=>[name,bones.get(name)!.quaternion.clone()]));
  const mixerBase=new Map(NAMES.map(name=>[name,originals.get(name)!.clone()]));
  const identity=new THREE.Quaternion(),rootRotation=root.getWorldQuaternion(new THREE.Quaternion());
  const parentRotation=new THREE.Quaternion(),rotation=new THREE.Quaternion(),axis=new THREE.Vector3();
  function rotate(name:Joint,rootAxis:THREE.Vector3,degrees:number){
    const bone=bones.get(name)!;root.updateMatrixWorld(true);
    bone.parent!.getWorldQuaternion(parentRotation).invert();
    axis.copy(rootAxis).applyQuaternion(rootRotation).applyQuaternion(parentRotation).normalize();
    bone.quaternion.premultiply(rotation.setFromAxisAngle(axis,THREE.MathUtils.degToRad(degrees))).normalize();
  }
  function aim(name:Joint,rootDirection:THREE.Vector3,maxDegrees:number){
    const bone=bones.get(name)!;root.updateMatrixWorld(true);
    const current=new THREE.Vector3(0,1,0).applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()));
    const target=rootDirection.clone().normalize().applyQuaternion(rootRotation);
    const delta=new THREE.Quaternion().setFromUnitVectors(current,target);
    const angle=identity.angleTo(delta),limit=THREE.MathUtils.degToRad(maxDegrees);
    if(angle>limit)delta.slerpQuaternions(identity,delta,limit/angle);
    const parent=bone.parent!.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent)).normalize();
  }
  const capture=()=>new Map(NAMES.map(name=>[name,bones.get(name)!.quaternion.clone()]));
  const reset=()=>{for(const name of NAMES)bones.get(name)!.quaternion.copy(originals.get(name)!);root.updateMatrixWorld(true);};

  // Small chest/shoulder corrections, with no leg/hip edits or artificial height offset.
  rotate('Spine2',new THREE.Vector3(1,0,0),1.8);
  aim('LeftShoulder',new THREE.Vector3(-.95,-.29,.06),4.8);
  aim('RightShoulder',new THREE.Vector3(.95,-.29,-.045),4.8);
  rotate('Neck',new THREE.Vector3(1,0,0),3.5);
  aim('Head',new THREE.Vector3(0,1,0),7.5);
  const standing=capture();

  // One open invitation in front of the body. No overhead salute, pointed finger or repeated wave.
  // The left sleeve and cloak receive only the small shared chest/shoulder correction above.
  aim('RightArm',new THREE.Vector3(.25,-.78,-.57),38);
  aim('RightForeArm',new THREE.Vector3(.12,.15,-.98),64);
  aim('RightHand',new THREE.Vector3(.08,.20,-.976),16);
  const inviting=capture();reset();
  let weight=0,appliedWeight=0;
  return {
    // AnimationMixer can skip unchanged values. Restore its last base before evaluating it,
    // otherwise a procedural rotation would accumulate across held idle frames.
    restore(){for(const name of NAMES)bones.get(name)!.quaternion.copy(mixerBase.get(name)!);},
    apply(speed:number,dt:number,idle:number,invite:boolean){
      weight=THREE.MathUtils.damp(weight,invite&&speed<=.06?1:0,invite?7:10,dt);
      const standingWeight=THREE.MathUtils.clamp(idle,0,1);
      // Blend out rapidly with locomotion; never start a speaking gesture while walking.
      const gestureWeight=weight*standingWeight*standingWeight;
      appliedWeight=gestureWeight;
      for(const name of NAMES){
        const bone=bones.get(name)!;mixerBase.get(name)!.copy(bone.quaternion);
        bone.quaternion.slerp(standing.get(name)!,standingWeight);
        bone.quaternion.slerp(inviting.get(name)!,gestureWeight);
      }
    },
    diagnostics:()=>({available:true,kind:'procedural-invitation',weight:appliedWeight,bones:NAMES.map(name=>bones.get(name)!.name)}),
  };
}
