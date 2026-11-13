import * as THREE from 'three/webgpu';
import type {Terrain} from './terrain.ts';
import {sceneryMesh,type AssetLibrary} from './tripo-assets.ts';
import {distanceToSegment,insideObstacle,rng,type Obstacle,type Segment} from './world-layout.ts';
import {renderedGroundHeight} from './village-house-placement.ts';

/** Small basalt clusters interrupt the otherwise straight edge near two encounters.
 * They use Alex's reviewed rock mesh and do not add colliders or change the DEM. */
export function shoreDetails(t:Terrain,routes:Segment[],assets:AssetLibrary,obstacles:Obstacle[],low=false){
  const group=new THREE.Group();group.name='shore-contact-r13';
  const source=sceneryMesh(assets['pedras-basalto']);if(!source)return group;
  const anchors=[t.meta.points.beach,t.meta.points.simao],random=rng(131313);
  const segments=low?192:256,target=low?40:90;
  const spots:{x:number;y:number;z:number;k:number;turn:number}[]=[];
  const shore=t.meta.shoreline.filter(([x,z])=>anchors.some(([ax,az])=>Math.hypot(ax-x,az-z)<60));
  for(let attempt=0;attempt<target*80&&spots.length<target&&shore.length;attempt++){
    const [sx,sz]=shore[Math.floor(random()*shore.length)],x=sx+(random()-.5)*12,z=sz+(random()-.5)*12;
    const h=renderedGroundHeight(t,x,z,segments);
    if(h<-.18||h>.34||routes.some(s=>distanceToSegment(x,z,s)<s.r+.4)||obstacles.some(o=>insideObstacle(x,z,o,.3)))continue;
    if(spots.some(s=>Math.hypot(s.x-x,s.z-z)<.45))continue;
    spots.push({x,y:h-.018,z,k:.055+random()*.16,turn:random()*Math.PI*2});
  }
  const batch=new THREE.InstancedMesh(source.geometry,source.material,spots.length),transform=new THREE.Object3D();
  batch.name='shore-basalt-small';batch.receiveShadow=true;batch.castShadow=false;
  for(let i=0;i<spots.length;i++){const p=spots[i];transform.position.set(p.x,p.y,p.z);transform.rotation.y=p.turn;
    transform.scale.setScalar(p.k);transform.updateMatrix();batch.setMatrixAt(i,transform.matrix);}
  batch.computeBoundingBox();batch.computeBoundingSphere();group.add(batch);
  group.userData.shoreDetails={revision:'shore-contact-r13',clusters:spots.length,trianglesPerCluster:source.geometry.index!.count/3,collidersAdded:0,terrainModified:false};
  group.userData.update=(x:number,z:number)=>{group.visible=anchors.some(([ax,az])=>Math.hypot(ax-x,az-z)<150);};
  return group;
}
