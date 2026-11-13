// Authored household dressing, not an archaeological inventory. All fittings follow the facade.
import * as THREE from 'three/webgpu';
import type {Terrain} from './terrain.ts';
import {buildingPoint,distanceToSegment,insideObstacle,rng,type Building,type Segment,type Obstacle} from './world-layout.ts';

export function settlementDetails(t:Terrain,plans:Building[],routes:Segment[],buildingBoxes:Obstacle[],wallModel?:THREE.Mesh|null){
 const group=new THREE.Group(),boxes:Obstacle[]=[],r=rng(417),o=new THREE.Object3D();
 type Placement={x:number;y:number;z:number;rot:number;sx:number;sy:number;sz:number};
 const jars:Placement[]=[],beams:Placement[]=[],shades:Placement[]=[],walls:Placement[]=[];
 const safe=(x:number,z:number,radius:number)=>t.heightAt(x,z)>.06&&routes.every(s=>distanceToSegment(x,z,s)>s.r+radius+.4)&&![...buildingBoxes,...boxes].some(b=>insideObstacle(x,z,b,radius));
 const put=(p:Building,lx:number,lz:number,y:number,sx:number,sy:number,sz:number):Placement=>({...buildingPoint(p,lx,lz),y,rot:p.rot,sx,sy,sz});
 for(let i=0;i<plans.length;i++){
  const p=plans[i],front=p.d/2;
  if(i%3!==1){
   const side=i%2?1:-1;
   for(let k=0;k<2+(i%2);k++){
    const at=buildingPoint(p,side*(p.w*.3+k*.34),front+.55+(k%2)*.48),scale=.65+r()*.6;
    if(!safe(at.x,at.z,.3*scale))continue;
    jars.push({...at,y:t.heightAt(at.x,at.z),rot:p.rot+r(),sx:scale,sy:scale,sz:scale});
    boxes.push({...at,hx:.25*scale,hz:.25*scale,rot:0,bottom:t.heightAt(at.x,at.z),top:t.heightAt(at.x,at.z)+.7*scale});
   }
  }
  if(i%3===1)continue;
  const width=Math.min(3.7,p.w*.57),depth=1.35,postZ=front+depth,backZ=front-.15;
  const corners=[buildingPoint(p,-width/2,postZ),buildingPoint(p,width/2,postZ)];
  if(!corners.every(at=>safe(at.x,at.z,.22)))continue;
  const y=p.y+Math.min(2.35,p.h-.32),cy=y-.06;
  corners.forEach(at=>{
   const floor=t.heightAt(at.x,at.z),height=y-floor;
   beams.push({...at,y:floor+height/2,rot:p.rot,sx:.10,sy:height,sz:.10});
   boxes.push({...at,hx:.09,hz:.09,rot:p.rot,bottom:floor,top:y+.1});
  });
  beams.push(put(p,0,postZ,y,width+.12,.12,.12));
  beams.push(put(p,0,backZ,y+.14,width+.12,.12,.12));
  for(const side of [-1,1])beams.push(put(p,side*width/2,(postZ+backZ)/2,y+.06,.10,.10,depth+.2));
  shades.push(put(p,0,(postZ+backZ)/2,cy+.13,width,1,depth+.15));
 }
 // Short low walls only in clear yard space; colliders use the actual scaled mesh bounds.
 if(wallModel){
  wallModel.geometry.computeBoundingBox();const bounds=wallModel.geometry.boundingBox!,size=bounds.getSize(new THREE.Vector3());
  for(let i=0;i<plans.length;i+=5){
   const radius=Math.hypot(size.x*.65,size.z*.8)/2;
   const p=plans[i],at=buildingPoint(p,p.w/2+radius+.7,p.d/2),rot=p.rot+Math.PI/2;
   if(!safe(at.x,at.z,radius+.15))continue;
   const y=t.heightAt(at.x,at.z);walls.push({...at,y,rot,sx:.65,sy:.55,sz:.8});
   boxes.push({...at,rot,hx:size.x*.65/2,hz:size.z*.8/2,bottom:y+Math.min(0,bounds.min.y*.55),top:y+bounds.max.y*.55});
  }
 }
 const batch=(geo:THREE.BufferGeometry,material:THREE.Material|THREE.Material[],list:Placement[],vary=false)=>{
  if(!list.length)return;
  const im=new THREE.InstancedMesh(geo,material,list.length);
  list.forEach((p,i)=>{o.position.set(p.x,p.y,p.z);o.rotation.set(0,p.rot,0);o.scale.set(p.sx,p.sy,p.sz);o.updateMatrix();im.setMatrixAt(i,o.matrix);if(vary)im.setColorAt(i,new THREE.Color().setHSL(.07+r()*.04,.12+r()*.14,.72+r()*.15));});
  im.castShadow=im.receiveShadow=true;group.add(im);
 };
 const clay=new THREE.MeshStandardMaterial({color:0xb88860,roughness:.92});
 const jarGeo=new THREE.LatheGeometry([new THREE.Vector2(.1,0),new THREE.Vector2(.19,.1),new THREE.Vector2(.25,.35),new THREE.Vector2(.18,.57),new THREE.Vector2(.08,.65),new THREE.Vector2(.1,.70),new THREE.Vector2(.072,.70),new THREE.Vector2(.06,.58)],16);
 batch(jarGeo,clay,jars,true);
 batch(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x72604a,roughness:.96}),beams);
 const canopy=new THREE.PlaneGeometry(1,1,12,6);canopy.rotateX(-Math.PI/2);
 const pos=canopy.attributes.position as THREE.BufferAttribute;
 for(let i=0;i<pos.count;i++)pos.setY(i,-.11*Math.cos(pos.getX(i)*Math.PI)*Math.cos(pos.getZ(i)*Math.PI)-pos.getZ(i)*.12);
 canopy.computeVertexNormals();
 batch(canopy,new THREE.MeshStandardMaterial({color:0xc4b58f,roughness:1,side:THREE.DoubleSide}),shades,true);
 if(wallModel)batch(wallModel.geometry,wallModel.material,walls);
 return {group,boxes,counts:{courtyards:walls.length,jars:jars.length,awnings:shades.length}};
}
