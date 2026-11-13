// Author a biped clip on the observed Tripo bird skeleton. Source bytes are never written.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';import sharp from 'sharp';
import {readSourceOptions} from './source-options.mjs';
const {output:root,input:file,source,sourceHash}=readSourceOptions('Reproduce the reviewed R8 chicken biped walk and texture variants.');
const n=source.readUInt32LE(12),jsonDoc=JSON.parse(source.subarray(20,20+n).toString()),bin=source.subarray(28+n);
delete jsonDoc.materials;delete jsonDoc.textures;delete jsonDoc.images;delete jsonDoc.samplers;for(const mesh of jsonDoc.meshes)for(const p of mesh.primitives)delete p.material;
const str=JSON.stringify(jsonDoc),json=Buffer.from(str+' '.repeat((4-Buffer.byteLength(str)%4)%4));const h=Buffer.alloc(20);h.write('glTF');h.writeUInt32LE(2,4);h.writeUInt32LE(28+json.length+bin.length,8);h.writeUInt32LE(json.length,12);h.write('JSON',16);const bh=Buffer.alloc(8);bh.writeUInt32LE(bin.length);bh.write('BIN\0',4);const input=Buffer.concat([h,json,bh,bin]);
const gltf=await new GLTFLoader().parseAsync(input.buffer.slice(input.byteOffset,input.byteOffset+input.length),'');
const model=gltf.scene;model.updateMatrixWorld(true);let mesh;model.traverse(o=>{if(o.isSkinnedMesh)mesh=o;});mesh.skeleton.update();
const restBounds=new THREE.Box3().setFromObject(model,true),sourceHeight=restBounds.max.y-restBounds.min.y,scale=.45/sourceHeight;
const wrapper=new THREE.Group();wrapper.add(model);wrapper.scale.setScalar(scale);wrapper.position.set(-(restBounds.min.x+restBounds.max.x)*.5*scale,-restBounds.min.y*scale,-(restBounds.min.z+restBounds.max.z)*.5*scale);wrapper.updateMatrixWorld(true);mesh.skeleton.update();
const bones=[...mesh.skeleton.bones];let base;
const byName=name=>{const b=bones.find(b=>b.name===name);if(!b)throw Error('Missing observed bone '+name);return b;};
const rootBone=byName('tripoRoot'),neck=byName('bone_3'),head=byName('tripoHead_0');
const p=mesh.geometry.attributes.position,indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight,vec=new THREE.Vector3();
const update=()=>{wrapper.updateMatrixWorld(true);mesh.skeleton.update();};
const legs=[['bone_1','bone_2',1],['bone_6','tripo0_Left_Limb_0',-1]].map(([upperName,lowerName,side])=>{
 const upper=byName(upperName),lower=byName(lowerName),mask=[];
 for(let i=0;i<p.count;i++)if(p.getY(i)<restBounds.min.y+sourceHeight*.18&&(p.getZ(i)<0?-1:1)===side)mask.push(i);
 const footPoints=mask.map(i=>mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld)),minY=Math.min(...footPoints.map(v=>v.y));
 const sole=footPoints.filter(v=>v.y<minY+.004),foot=new THREE.Vector3();for(const point of sole)foot.add(point);foot.divideScalar(sole.length);
 const hip=upper.getWorldPosition(new THREE.Vector3()),knee=lower.getWorldPosition(new THREE.Vector3());
 // Observed anatomical ankle band, above the spread toes. Only this leg's foot mask contributes.
 const band=footPoints.filter(v=>v.y>=.035&&v.y<=.055);if(band.length<3)throw Error('Cannot locate ankle band');
 const ankle=new THREE.Vector3();for(const v of band)ankle.add(v);ankle.divideScalar(band.length);ankle.y=.030;
 const marker=new THREE.Bone();marker.name=side===1?'foot_left_r8':'foot_right_r8';marker.position.copy(lower.worldToLocal(ankle.clone()));lower.add(marker);update();
 return{upper,lower,mask,marker,neutralFoot:ankle,neutralHip:hip,neutralMinY:minY,L1:hip.distanceTo(knee),L2:knee.distanceTo(ankle),pole:new THREE.Vector3(-1,0,0),side,neutralFootWorldQuaternion:marker.getWorldQuaternion(new THREE.Quaternion())};
});
const neutralVertices=Array.from({length:p.count},(_,i)=>mesh.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
const newInverses=mesh.skeleton.boneInverses.map(m=>m.clone());
for(const leg of legs){bones.push(leg.marker);newInverses.push(wrapper.matrixWorld.clone().invert().multiply(leg.marker.matrixWorld).invert());}
const jointData=new Uint16Array(p.count*4),weightData=new Float32Array(p.count*4);
for(let i=0;i<p.count;i++){
 const leg=legs[p.getZ(i)<0?1:0],upperIndex=bones.indexOf(leg.upper),lowerIndex=bones.indexOf(leg.lower),footIndex=bones.indexOf(leg.marker),y=neutralVertices[i].y;
 const u=THREE.MathUtils.clamp((y-.028)/(.058-.028),0,1),blend=1-u*u*(3-2*u);const influence=new Map();let toFoot=0;
 for(let c=0;c<4;c++){const joint=indices.getComponent(i,c),weight=weights.getComponent(i,c),transfer=joint===upperIndex||joint===lowerIndex?weight*blend:0;toFoot+=transfer;influence.set(joint,(influence.get(joint)??0)+weight-transfer);}
 if(toFoot>0)influence.set(footIndex,toFoot);
 const selected=[...influence].filter(([,w])=>w>0).sort((a,b)=>b[1]-a[1]).slice(0,4),total=selected.reduce((s,[,w])=>s+w,0);
 selected.forEach(([joint,w],c)=>{jointData[i*4+c]=joint;weightData[i*4+c]=w/total;});
}
mesh.geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(jointData,4));mesh.geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weightData,4));
mesh.skeleton=new THREE.Skeleton(bones,newInverses);update();
let maxNeutralDeviation=0;for(let i=0;i<p.count;i++)maxNeutralDeviation=Math.max(maxNeutralDeviation,mesh.getVertexPosition(i,vec).applyMatrix4(mesh.matrixWorld).distanceTo(neutralVertices[i]));
if(maxNeutralDeviation>1e-6)throw Error('Rest pose changed while adding feet: '+maxNeutralDeviation);
base=bones.map(b=>({p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()}));
const duration=.96,speed=.24,duty=.56,travel=speed*duration*duty,lift=.030,ground=.0005,frames=96,rootLowering=.025;
function reset(){for(let i=0;i<bones.length;i++){bones[i].position.copy(base[i].p);bones[i].quaternion.copy(base[i].q);bones[i].scale.copy(base[i].s);}update();}
function orient(bone,current,target){const delta=new THREE.Quaternion().setFromUnitVectors(current.clone().normalize(),target.clone().normalize()),world=bone.getWorldQuaternion(new THREE.Quaternion());world.premultiply(delta);const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(parent.multiply(world)).normalize();update();}
function rotateWorld(bone,axis,angle){const q=bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromAxisAngle(axis,angle));bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));update();}
function minimum(leg){let y=Infinity;for(const i of leg.mask){mesh.getVertexPosition(i,vec).applyMatrix4(mesh.matrixWorld);y=Math.min(y,vec.y);}return y;}
let clamped=0;
function solve(leg,target){
 const h=leg.upper.getWorldPosition(new THREE.Vector3()),k=leg.lower.getWorldPosition(new THREE.Vector3()),dir=target.clone().sub(h),distance=dir.length(),reach=Math.min(distance,leg.L1+leg.L2-.00001);if(distance>leg.L1+leg.L2-.00001)clamped++;dir.normalize();
 const along=(leg.L1**2-leg.L2**2+reach**2)/(2*reach),perp=leg.pole.clone().addScaledVector(dir,-leg.pole.dot(dir)).normalize();
 const desiredK=h.clone().addScaledVector(dir,along).addScaledVector(perp,Math.sqrt(Math.max(0,leg.L1**2-along**2)));
 orient(leg.upper,k.sub(h),desiredK.clone().sub(h));const actualK=leg.lower.getWorldPosition(new THREE.Vector3()),end=leg.marker.getWorldPosition(new THREE.Vector3());
 orient(leg.lower,end.sub(actualK),target.clone().sub(actualK));
}
function pose(phase){
 reset();rootBone.position.y+=(-rootLowering+.002*Math.cos(phase*Math.PI*4))/scale;update();
 rotateWorld(neck,new THREE.Vector3(0,0,1),.025*Math.sin(phase*Math.PI*2));rotateWorld(head,new THREE.Vector3(0,0,1),-.012*Math.sin(phase*Math.PI*2));
 const contacts=[];
 legs.forEach((leg,index)=>{const f=(phase+index*.5)%1,stance=f<duty,u=stance?0:(f-duty)/(1-duty),swing=stance?0:lift*Math.sin(Math.PI*u)**1.3;
  const offset=stance?travel*.5-speed*duration*f:-travel*.5+travel*(u*u*(3-2*u));
  const target=leg.neutralFoot.clone();target.x=leg.neutralHip.x+.008+offset;target.y=leg.neutralFoot.y-leg.neutralMinY+ground+swing;
  for(let attempt=0;attempt<12;attempt++){solve(leg,target);leg.marker.quaternion.copy(leg.marker.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(leg.neutralFootWorldQuaternion));update();const error=ground+swing-minimum(leg);if(Math.abs(error)<.00003)break;target.y+=error;}
  contacts.push({side:leg.side,phase:f,stance,desiredMin:ground+swing,actualMin:minimum(leg),marker:leg.marker.getWorldPosition(new THREE.Vector3()).toArray(),target:target.toArray()});
 });return contacts;
}
const animated=[rootBone,...legs.flatMap(l=>[l.upper,l.lower,l.marker]),neck,head],tracks=new Map(animated.map(b=>[b.name,{q:[],p:[]}])) ,samples=[];
for(let frame=0;frame<=frames;frame++){const phase=frame===frames?0:frame/frames,contacts=pose(phase);samples.push({t:duration*frame/frames,phase,contacts});for(const bone of animated){const t=tracks.get(bone.name);t.q.push(...bone.quaternion.toArray());t.p.push(...bone.position.toArray());}}
const errors=samples.flatMap(s=>s.contacts.filter(c=>c.stance).map(c=>Math.abs(c.actualMin-ground))),maxContactError=Math.max(...errors);
const qa={at:new Date().toISOString(),sourceHash,duration,speedMetersPerSecond:speed,strideMeters:duration*speed,stanceDuty:duty,swingLiftMeters:lift,rootLoweringMeters:rootLowering,groundOffsetMeters:ground,maxContactErrorMeters:maxContactError,clampedIKSolves:clamped,maxNeutralDeviationMeters:maxNeutralDeviation,legs:legs.map(l=>({upper:l.upper.name,lower:l.lower.name,foot:l.marker.name,L1:l.L1,L2:l.L2,footVertices:l.mask.length,neutralFoot:l.neutralFoot.toArray()})),samples};
fs.writeFileSync(path.join(root,'qa/galinha-r8-authored-r2-contact.json'),JSON.stringify(qa,null,2));
if(maxContactError>.0015)throw Error('Foot contact QA failed: '+maxContactError);
if(clamped>0)throw Error('Step reaches beyond observed leg lengths: '+clamped+' clamped IK solves');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read(file),r=doc.getRoot(),scene=r.getDefaultScene()??r.listScenes()[0];
const skin=r.listSkins()[0];
for(const leg of legs){const foot=doc.createNode(leg.marker.name).setTranslation(base[bones.indexOf(leg.marker)].p.toArray());const parent=r.listNodes().find(n=>THREE.PropertyBinding.sanitizeNodeName(n.getName())===leg.lower.name);parent.addChild(foot);skin.addJoint(foot);}
skin.getInverseBindMatrices().setArray(new Float32Array(newInverses.flatMap(m=>m.toArray())));
const primitive=r.listMeshes()[0].listPrimitives()[0];primitive.getAttribute('JOINTS_0').setArray(jointData);primitive.getAttribute('WEIGHTS_0').setArray(weightData);
for(const animation of [...r.listAnimations()]){
 const samplers=[...animation.listSamplers()];animation.dispose();for(const sampler of samplers)sampler.dispose();
}
for(const accessor of [...r.listAccessors()])if(accessor.listParents().every(parent=>parent===r))accessor.dispose();
const meters=doc.createNode('chicken-r8-meters').setScale([scale,scale,scale]).setTranslation(wrapper.position.toArray());
// Source faces +X; +90 degrees around Y makes gameplay heading zero face -Z.
meters.setRotation([0,Math.SQRT1_2,0,Math.SQRT1_2]);for(const child of [...scene.listChildren()])meters.addChild(child);scene.addChild(meters);
const anim=doc.createAnimation('bird-walk-inplace-r8-r2').setExtras({authoredBy:'BentoLabs code, observed bird chains and two measured foot pivots',duration,speedMetersPerSecond:speed,strideMeters:duration*speed,reviewStatus:'candidate'}),buffer=r.listBuffers()[0];
const time=doc.createAccessor('birdwalk-time').setType('SCALAR').setArray(new Float32Array(Array.from({length:frames+1},(_,i)=>duration*i/frames))).setBuffer(buffer);
for(const bone of animated){const node=r.listNodes().find(n=>THREE.PropertyBinding.sanitizeNodeName(n.getName())===bone.name);if(!node)throw Error('Export bone missing '+bone.name);const values=tracks.get(bone.name);
 for(const [path,type,array] of (bone===rootBone?[['translation','VEC3',values.p]]:[['rotation','VEC4',values.q]])){
  const output=doc.createAccessor(`${bone.name}-${path}`).setType(type).setArray(new Float32Array(array)).setBuffer(buffer);
  const sampler=doc.createAnimationSampler().setInput(time).setOutput(output).setInterpolation('LINEAR');const channel=doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler);anim.addSampler(sampler).addChannel(channel);
 }
}
const candidate=path.join(root,'candidates');fs.mkdirSync(candidate,{recursive:true});const baseBytes=await io.writeBinary(doc);fs.writeFileSync(path.join(candidate,'chicken-r8-birdwalk-r2-2k.glb'),baseBytes);const artifacts=[];
for(const limit of [1024,512]){const variant=await io.readBinary(baseBytes);for(const texture of variant.getRoot().listTextures()){
 const isNormal=texture.getName().includes('normal'),image=texture.getImage();const encoded=await sharp(Buffer.from(image)).resize(limit,limit,{fit:'inside',withoutEnlargement:true}).webp({lossless:isNormal,quality:92,effort:5}).toBuffer();texture.setImage(new Uint8Array(encoded)).setMimeType('image/webp');
 }variant.createExtension(EXTTextureWebP).setRequired(true);const bytes=await io.writeBinary(variant),name=`chicken-r8-birdwalk-r2-${limit}.glb`;fs.writeFileSync(path.join(candidate,name),bytes);artifacts.push({file:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),textureLimit:limit});}
fs.writeFileSync(path.join(candidate,'chicken-r8-birdwalk-r2-manifest.json'),JSON.stringify({source:file,sourceHash,status:'candidate_needs_rendered_walk_QA',heightMeters:.45,forward:'-Z',clip:'bird-walk-inplace-r8-r2',qa:{maxContactErrorMeters:maxContactError,clampedIKSolves:clamped,maxNeutralDeviationMeters:maxNeutralDeviation},artifacts},null,2));console.log(JSON.stringify({maxContactErrorMeters:maxContactError,clampedIKSolves:clamped,maxNeutralDeviationMeters:maxNeutralDeviation,legs:qa.legs,artifacts},null,2));
