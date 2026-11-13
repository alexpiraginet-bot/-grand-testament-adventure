// R13: wind-directed ripples, shallow-water colour and a bounded detailed mesh.
// Artistic lake treatment, not a hydrodynamic or archaeological reconstruction.
import * as THREE from 'three/webgpu';
import {texture,positionWorld,positionLocal,vec2,vec3,mix,clamp,smoothstep,float,step,color,uniform,normalMap,cameraPosition,reflector} from 'three/tsl';
import type {Terrain} from './terrain.ts';

export type LakeOptions={mobile?:boolean;reflection?:boolean};
export const LAKE_STYLE=Object.freeze({revision:'lake-r13',maximumWaveHeight:.045,
  detailSpacingDesktop:3,detailSpacingMobile:6,reflectionResolution:.25});

/** Periodic gradient field. More energy along the wind, less across it. */
export function lakeNormalPixels(size=256){
  const data=new Uint8Array(size*size*4);
  const waves=[[2,1,.5,.1],[5,2,.25,1.8],[9,4,.12,2.6],[15,7,.06,.5],
    [7,-2,.14,4.1],[21,-4,.04,2.2],[35,14,.02,5.7]];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let nx=0,ny=0;
    for(const [kx,ky,a,phase] of waves){const v=Math.cos((x*kx+y*ky)*Math.PI*2/size+phase)*a*.065;nx-=v*kx;ny-=v*ky;}
    const l=Math.hypot(nx,ny,1),i=(y*size+x)*4;
    data[i]=Math.round((nx/l*.5+.5)*255);data[i+1]=Math.round((ny/l*.5+.5)*255);
    data[i+2]=Math.round((1/l*.5+.5)*255);data[i+3]=255;
  }
  return data;
}

/** Dense only around the authored shore. The outer bands still cover the far lake. */
export function lakeGeometry(size:number,terrain:Terrain,mobile=false){
  const points=[terrain.meta.points.beach,terrain.meta.points.simao,terrain.meta.points.barco];
  const spacing=mobile?LAKE_STYLE.detailSpacingMobile:LAKE_STYLE.detailSpacingDesktop;
  const axis=(index:number)=>{
    const lower=Math.max(-size/2+1,Math.min(...points.map(p=>p[index]))-72);
    const upper=Math.min(size/2-1,Math.max(...points.map(p=>p[index]))+72);
    const n=Math.max(1,Math.ceil((upper-lower)/spacing));
    return [-size/2,...Array.from({length:n+1},(_,i)=>lower+(upper-lower)*i/n),size/2];
  };
  const xs=axis(0),zs=axis(1),position=new Float32Array(xs.length*zs.length*3),uv=new Float32Array(xs.length*zs.length*2),indices:number[]=[];
  for(let iz=0;iz<zs.length;iz++)for(let ix=0;ix<xs.length;ix++){
    const i=iz*xs.length+ix;position.set([xs[ix],0,zs[iz]],i*3);uv.set([xs[ix]/18,-zs[iz]/18],i*2);
    if(iz<zs.length-1&&ix<xs.length-1){const b=i+xs.length;indices.push(i,b,i+1,i+1,b,b+1);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(position,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  geometry.userData.detailBounds=[xs[1],xs[xs.length-2],zs[1],zs[zs.length-2]];
  geometry.computeBoundingBox();geometry.boundingBox!.min.y=-LAKE_STYLE.maximumWaveHeight;geometry.boundingBox!.max.y=LAKE_STYLE.maximumWaveHeight;
  geometry.computeBoundingSphere();
  return geometry;
}

export function water(size:number,terrain:Terrain,options:LakeOptions={}){
  const clock=uniform(0),nrm=new THREE.DataTexture(lakeNormalPixels(),256,256);
  nrm.wrapS=nrm.wrapT=THREE.RepeatWrapping;nrm.magFilter=THREE.LinearFilter;nrm.minFilter=THREE.LinearMipmapLinearFilter;
  nrm.generateMipmaps=true;nrm.anisotropy=options.mobile?2:8;nrm.needsUpdate=true;
  const pixels=new Uint8Array(terrain.h.length*4);
  for(let i=0;i<terrain.h.length;i++){const v=Math.round(Math.max(0,Math.min(9,-terrain.h[i]))/9*255);pixels.set([v,v,v,255],i*4);}
  const depthMap=new THREE.DataTexture(pixels,terrain.n,terrain.n);
  depthMap.minFilter=depthMap.magFilter=THREE.LinearFilter;depthMap.needsUpdate=true;
  const near=step(positionWorld.x.abs(),float(terrain.size/2)).mul(step(positionWorld.z.abs(),float(terrain.size/2)));
  const depthUV=positionWorld.xz.add(terrain.size/2).div(terrain.step).add(.5).div(terrain.n);
  const depth=mix(float(9),texture(depthMap,depthUV).r.mul(9),near);
  const m=new THREE.MeshPhysicalNodeMaterial({roughness:.15,metalness:0,ior:1.333,envMapIntensity:.85,transparent:true,depthWrite:false});
  m.name=LAKE_STYLE.revision;

  const uv=vec2(positionWorld.x,positionWorld.z.negate());
  const a=texture(nrm,uv.div(18).add(vec2(clock.mul(.005),clock.mul(.0018)))).xyz.mul(2).sub(1);
  const fineUV=vec2(uv.x.mul(.61).add(uv.y.mul(.7924)),uv.y.mul(.61).sub(uv.x.mul(.7924)));
  const b=texture(nrm,fineUV.div(4.6).add(vec2(clock.mul(-.008),clock.mul(.0031)))).xyz.mul(2).sub(1);
  const crossNormal=vec2(b.x.mul(.61).sub(b.y.mul(.7924)),b.x.mul(.7924).add(b.y.mul(.61)));
  const normal=vec3(a.xy.mul(.60).add(crossNormal.mul(.36)),float(1)).normalize();
  m.normalNode=normalMap(normal.mul(.5).add(.5));
  m.roughnessNode=mix(.11,.23,b.x.abs());
  const angle=clamp(cameraPosition.sub(positionWorld).normalize().y,0,1);
  const fresnel=angle.oneMinus().pow(5).mul(.96).add(.04);
  const shallow=mix(color(0x58938b),color(0x286479),smoothstep(.1,2.8,depth));
  const body=mix(shallow,color(0x16465f),smoothstep(2.8,8,depth));
  const lap=depth.mul(15).sub(clock.mul(.85)).add(a.x.mul(2)).sin().smoothstep(.84,.99)
    .mul(smoothstep(.025,.1,depth)).mul(smoothstep(.18,.4,depth).oneMinus());
  m.colorNode=mix(body,color(0xbac7b5),lap.mul(.16));
  m.opacityNode=mix(mix(.20,.96,smoothstep(.02,2.6,depth)),float(.985),fresnel);

  // Small vertex undulation in the detailed shore mesh. Its outer edge is flat,
  // so enormous far-field triangles never interpolate waves across the map.
  const geometry=lakeGeometry(size,terrain,options.mobile);
  const [x0,x1,z0,z1]=geometry.userData.detailBounds as number[];
  const window=smoothstep(x0,x0+24,positionLocal.x).mul(smoothstep(x1-24,x1,positionLocal.x).oneMinus())
    .mul(smoothstep(z0,z0+24,positionLocal.z)).mul(smoothstep(z1-24,z1,positionLocal.z).oneMinus());
  const vUV=positionLocal.xz.add(terrain.size/2).div(terrain.step).add(.5).div(terrain.n);
  const vDepth=texture(depthMap,vUV).r.mul(9);
  const wave=positionLocal.x.mul(.54).add(positionLocal.z.mul(.21)).sub(clock.mul(1.1)).sin().mul(.028)
    .add(positionLocal.x.mul(-.29).add(positionLocal.z.mul(.41)).sub(clock.mul(.77)).sin().mul(.017))
    .mul(window).mul(smoothstep(.12,.8,vDepth));
  m.positionNode=positionLocal.add(vec3(0,wave,0));

  const mesh=new THREE.Mesh(geometry,m);mesh.name=LAKE_STYLE.revision;
  mesh.receiveShadow=true;mesh.renderOrder=2;
  // Native Three reflector, one quarter of viewport dimensions; explicitly absent
  // on mobile/compatible profiles. Not DLSS, ray tracing or screen-space refraction.
  const reflection=options.reflection&&!options.mobile?reflector({resolutionScale:LAKE_STYLE.reflectionResolution,bounces:false,samples:0,generateMipmaps:true}):null;
  if(reflection){
    reflection.target.rotation.x=-Math.PI/2;mesh.add(reflection.target);
    reflection.uvNode=reflection.uvNode!.add(normal.xy.mul(.009).div(cameraPosition.sub(positionWorld).length().mul(.02).add(1)));
    reflection.levelNode=float(1.5);
    const amount=fresnel.mul(.28);
    m.colorNode=m.colorNode.mul(amount.oneMinus());m.emissiveNode=reflection.rgb.mul(vec3(.75,.9,1)).mul(amount);
  }
  const diagnostics={revision:LAKE_STYLE.revision,triangles:mesh.geometry.index!.count/3,
    maxWaveHeight:LAKE_STYLE.maximumWaveHeight,reflection:!!reflection,reflectionResolution:reflection?LAKE_STYLE.reflectionResolution:0,
    textureBytes:256*256*4+pixels.byteLength,clock:0};
  mesh.userData.lakeSurface=diagnostics;
  m.addEventListener('dispose',()=>{nrm.dispose();depthMap.dispose();reflection?.dispose();});
  return {mesh,update:(t:number)=>{if(Number.isFinite(t)){clock.value=t;diagnostics.clock=t;}}};
}
