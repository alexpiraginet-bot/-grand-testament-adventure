// Artistic surface treatment on the unchanged, measured terrain. The three
// photographed Rocky Gravel maps remain CC0; see textures/ground/LICENSE.json.
import * as THREE from 'three/webgpu';
import {texture,positionWorld,vec2,vec3,float,min,clamp,mix,smoothstep,sin,normalMap,attribute} from 'three/tsl';
import type {Segment} from './world-layout.ts';
import type {GroundMaterialMapsR13} from './ground-materials.ts';

export type GroundTextures = {albedo:THREE.Texture;normal:THREE.Texture;roughness:THREE.Texture}&Partial<GroundMaterialMapsR13>;

/** Metres and linear-light values. These are art direction, not surveyed soil data. */
export const GROUND_SURFACE_DEFAULTS=Object.freeze({
  revision:'ground-r10',detailTileMeters:3.6,macroTileMeters:27,
  pathCoreOffset:-.7,pathEdgeOffset:.25,
  edgeLongAmplitude:.16,edgeShortAmplitude:.095,edgeTextureAmplitude:.35,
  edgeLongX:.117,edgeLongZ:.083,edgeShortX:.47,edgeShortZ:-.31,edgeShortPhase:1.7,
  shoreFullHeight:.15,shoreEndHeight:1.25,shoreIrregularity:.12,
  wetFullHeight:-.08,wetEndHeight:.25,
  gravelNormal:.65,pathNormal:.16,sandNormal:.10,wetNormal:.06,
  pathContrast:.24,sandContrast:.18,
  gravelRoughnessMin:.8,gravelRoughnessRange:.2,
  pathRoughnessMin:.92,pathRoughnessRange:.04,
  sandRoughnessMin:.94,sandRoughnessRange:.04,
  wetRoughnessMin:.62,wetRoughnessRange:.06,
  macroMin:.94,macroRange:.12,wetAlbedoMultiplier:.72,
});
const P=GROUND_SURFACE_DEFAULTS;
export const GROUND_PBR_DEFAULTS=Object.freeze({revision:'ground-r13',tileMeters:2,pathNormal:.42,sandNormal:.22,wetNormal:.12,
  pathRoughnessMin:.68,sandRoughnessMin:.72,roughnessMax:.98,wetRoughness:.50,wetBlend:.55,
  soilCoreDistance:24,soilFadeDistance:42,soilEdgeIrregularity:3,soilNormal:.50,soilGravelNormalMix:.12,soilRoughnessMin:.78,soilAlbedoMultiplier:.90});
const R=GROUND_PBR_DEFAULTS;
const LUMA=[.2126,.7152,.0722] as const;

/** Freeze numerical route inputs into the graph; never mutate the shared layout. */
function validRoutes(routes:readonly Segment[]):Segment[]{
  return routes.filter(s=>[s.ax,s.az,s.bx,s.bz,s.r].every(Number.isFinite)&&s.r>0&&
    Number.isFinite((s.bx-s.ax)**2+(s.bz-s.az)**2)).map(s=>({...s}));
}

export function groundSurfaceDiagnostics(routes:readonly Segment[],maps:Partial<GroundTextures>={}){
  const accepted=validRoutes(routes);
  const dirt=!!(maps.dirtAlbedo&&maps.dirtNormalRoughness),sand=!!(maps.sandAlbedo&&maps.sandNormalRoughness);
  const additional=[...(dirt?[maps.dirtAlbedo!,maps.dirtNormalRoughness!]:[]),...(sand?[maps.sandAlbedo!,maps.sandNormalRoughness!]:[])];
  return {revision:dirt||sand?R.revision:P.revision,routeCount:accepted.length,ignoredRoutes:routes.length-accepted.length,
    textureCount:3+additional.length,textureSamples:4+additional.length,
    additionalTextureBytes:additional.reduce((sum,t)=>sum+(Number(t.userData.encodedBytes)||0),0),geometryDisplacement:false,
    vertexColors:true,detailTileMeters:P.detailTileMeters,macroTileMeters:P.macroTileMeters,
    vertexColorMode:dirt||sand?'distant biome gravel and legacy fallback only':'whole material',
    pbrMaterials:{dirt,sand},pbrTileMeters:dirt||sand?R.tileMeters:null,
    authoredSoil:dirt?{fullDistanceFromRouteEdge:R.soilCoreDistance,fadeDistanceFromRouteEdge:R.soilFadeDistance,gravelNormalMix:R.soilGravelNormalMix}:null,
    normalStrength:{gravel:P.gravelNormal,path:dirt?R.pathNormal:P.pathNormal,sand:sand?R.sandNormal:P.sandNormal,wet:sand?R.wetNormal:P.wetNormal},
    shorelineBasis:'world-y; lake surface is 0 m'} as const;
}

/**
 * Uses the existing UV basis (x / 3.6, -z / 3.6) for tangent-space normals.
 * Owns only this material: maps are borrowed and must remain owned by the loader.
 * No mesh, texture, displacement, shadow pass, clock or per-frame CPU work.
 */
export function createGroundSurface(maps:Readonly<GroundTextures>,routes:readonly Segment[]):THREE.MeshStandardNodeMaterial{
  const hasDirt=!!(maps.dirtAlbedo&&maps.dirtNormalRoughness),hasSand=!!(maps.sandAlbedo&&maps.sandNormalRoughness);
  const pbr=hasDirt||hasSand;
  const material=new THREE.MeshStandardNodeMaterial({vertexColors:!pbr,roughness:.96,metalness:0});
  material.name=pbr?R.revision:P.revision;
  const xz=positionWorld.xz;
  const detailUV=vec2(positionWorld.x,positionWorld.z.negate()).div(P.detailTileMeters);
  // A second sample of the existing albedo replaces the previous allocated grain
  // texture. Low-frequency colour and edge breakup are stable in world space.
  const macro=clamp(texture(maps.albedo,xz.div(P.macroTileMeters)).rgb.dot(vec3(...LUMA)).mul(2.2),0,1);
  const irregularity=sin(xz.dot(vec2(P.edgeLongX,P.edgeLongZ))).mul(P.edgeLongAmplitude)
    .add(sin(xz.dot(vec2(P.edgeShortX,P.edgeShortZ)).add(P.edgeShortPhase)).mul(P.edgeShortAmplitude))
    .add(macro.sub(.5).mul(P.edgeTextureAmplitude));
  let signedDistance=min(float(10000),float(10000));
  for(const s of validRoutes(routes)){
    const dx=s.bx-s.ax,dz=s.bz-s.az,p=xz.sub(vec2(s.ax,s.az)),d=vec2(dx,dz);
    // A zero-length route safely becomes a round patch, never a division by zero.
    const u=clamp(p.dot(d).div(Math.max(dx*dx+dz*dz,1e-6)),0,1);
    signedDistance=min(signedDistance,p.sub(d.mul(u)).length().sub(s.r));
  }
  const path=smoothstep(P.pathCoreOffset,P.pathEdgeOffset,signedDistance.add(irregularity)).oneMinus();
  // The authored village floor shares real soil with the lane; only distant land
  // retains the legacy golden gravel. Reuse the route distance and existing maps.
  const authoredSoil=hasDirt?smoothstep(R.soilCoreDistance,R.soilFadeDistance,
    signedDistance.add(irregularity.mul(R.soilEdgeIrregularity))).oneMinus():float(0);
  const shoreHeight=positionWorld.y.add(irregularity.mul(P.shoreIrregularity));
  const sand=smoothstep(P.shoreFullHeight,P.shoreEndHeight,shoreHeight).oneMinus();
  const wet=smoothstep(P.wetFullHeight,P.wetEndHeight,shoreHeight).oneMinus();
  // Same world-X/-Z tangent orientation as the geometry UVs. Source patches measure 2 x 2 m.
  const pbrUV=vec2(positionWorld.x,positionWorld.z.negate()).div(R.tileMeters);
  const dirtData=hasDirt?texture(maps.dirtNormalRoughness!,pbrUV):null;
  const sandData=hasSand?texture(maps.sandNormalRoughness!,pbrUV):null;
  const photographed=texture(maps.albedo,detailUV).rgb;
  const gravel=mix(vec3(photographed.dot(vec3(...LUMA))),photographed,.38);
  const undisturbed=gravel.mul(vec3(1.45,1.42,1.37));
  // Keep photographed detail but compress its contrast, so stone-shaped albedo
  // does not remain as strong as gravel after the normal has been softened.
  const compacted=vec3(.46,.42,.34).add(gravel.sub(vec3(.35)).mul(P.pathContrast));
  const sandy=vec3(.56,.52,.43).add(gravel.sub(vec3(.35)).mul(P.sandContrast));
  // Keep biome colour on distant gravel, without tinting photographic soil a second time.
  const biome=pbr?attribute('color','vec3'):vec3(1);
  const dirtColor=hasDirt?texture(maps.dirtAlbedo!,pbrUV).rgb:compacted.mul(biome);
  const sandColor=hasSand?texture(maps.sandAlbedo!,pbrUV).rgb:sandy.mul(biome);
  const dryBase=mix(undisturbed.mul(biome),dirtColor.mul(R.soilAlbedoMultiplier),authoredSoil);
  material.colorNode=mix(mix(dryBase,dirtColor,path),sandColor,sand)
    .mul(mix(float(1),float(P.wetAlbedoMultiplier),wet)).mul(macro.mul(P.macroRange).add(P.macroMin));
  const baseStrength=mix(float(P.gravelNormal),float(R.soilNormal),authoredSoil);
  const normalStrength=mix(mix(mix(baseStrength,float(hasDirt?R.pathNormal:P.pathNormal),path),float(hasSand?R.sandNormal:P.sandNormal),sand),float(hasSand?R.wetNormal:P.wetNormal),wet);
  const gravelNormal=texture(maps.normal,detailUV).rgb;
  const dryNormal=mix(gravelNormal,dirtData?.rgb??gravelNormal,authoredSoil.mul(1-R.soilGravelNormalMix));
  // Independent normal fields; NormalMapNode normalizes the final tangent-space blend.
  material.normalNode=normalMap(mix(mix(dryNormal,dirtData?.rgb??gravelNormal,path),sandData?.rgb??gravelNormal,sand),vec2(normalStrength));
  const roughness=texture(maps.roughness,detailUV).r;
  const dirtRoughness=dirtData?clamp(dirtData.a,R.pathRoughnessMin,R.roughnessMax):roughness.mul(P.pathRoughnessRange).add(P.pathRoughnessMin);
  const sandRoughness=sandData?clamp(sandData.a,R.sandRoughnessMin,R.roughnessMax):roughness.mul(P.sandRoughnessRange).add(P.sandRoughnessMin);
  const wetRoughness=sandData?mix(sandRoughness,float(R.wetRoughness),float(R.wetBlend)):roughness.mul(P.wetRoughnessRange).add(P.wetRoughnessMin);
  const dryRoughness=mix(roughness.mul(P.gravelRoughnessRange).add(P.gravelRoughnessMin),
    dirtData?clamp(dirtData.a,R.soilRoughnessMin,R.roughnessMax):dirtRoughness,authoredSoil);
  material.roughnessNode=mix(mix(mix(
    dryRoughness,
    dirtRoughness,path),sandRoughness,sand),wetRoughness,wet);
  material.userData.groundSurface=groundSurfaceDiagnostics(routes,maps);
  return material;
}

const bounded=(x:number)=>Math.max(0,Math.min(1,x));
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(a:number,b:number,x:number)=>{const t=bounded((x-a)/(b-a));return t*t*(3-2*t);};

/**
 * CPU probe for map QA, not a rendered-pixel or performance measurement.
 * Supply the shader's normalized macro and roughness samples for an exact mask
 * comparison; defaults .5 model their middle values. Do not call per fragment.
 */
export function probeGroundSurface(point:{x:number;y:number;z:number},routes:readonly Segment[],samples:{macro?:number;roughness?:number;pbr?:boolean;dirtRoughness?:number;sandRoughness?:number}={}){
  const {x,y,z}=point;
  if(![x,y,z].every(Number.isFinite))throw new RangeError('Ground surface probe requires finite world coordinates');
  const macro=Number.isFinite(samples.macro)?bounded(samples.macro!):.5;
  const roughness=Number.isFinite(samples.roughness)?bounded(samples.roughness!):.5;
  const irregularity=Math.sin(x*P.edgeLongX+z*P.edgeLongZ)*P.edgeLongAmplitude+
    Math.sin(x*P.edgeShortX+z*P.edgeShortZ+P.edgeShortPhase)*P.edgeShortAmplitude+(macro-.5)*P.edgeTextureAmplitude;
  let signedDistance=10000;
  for(const s of validRoutes(routes)){
    const dx=s.bx-s.ax,dz=s.bz-s.az,px=x-s.ax,pz=z-s.az;
    const u=bounded((px*dx+pz*dz)/Math.max(dx*dx+dz*dz,1e-6));
    signedDistance=Math.min(signedDistance,Math.hypot(px-dx*u,pz-dz*u)-s.r);
  }
  const path=1-smooth(P.pathCoreOffset,P.pathEdgeOffset,signedDistance+irregularity);
  const authoredSoil=samples.pbr?1-smooth(R.soilCoreDistance,R.soilFadeDistance,signedDistance+irregularity*R.soilEdgeIrregularity):0;
  const shoreHeight=y+irregularity*P.shoreIrregularity;
  const sand=1-smooth(P.shoreFullHeight,P.shoreEndHeight,shoreHeight);
  const wet=1-smooth(P.wetFullHeight,P.wetEndHeight,shoreHeight);
  const dirtR=samples.pbr?Math.max(R.pathRoughnessMin,Math.min(R.roughnessMax,samples.dirtRoughness??roughness)):P.pathRoughnessMin+roughness*P.pathRoughnessRange;
  const sandR=samples.pbr?Math.max(R.sandRoughnessMin,Math.min(R.roughnessMax,samples.sandRoughness??roughness)):P.sandRoughnessMin+roughness*P.sandRoughnessRange;
  const dryR=lerp(P.gravelRoughnessMin+roughness*P.gravelRoughnessRange,
    Math.max(R.soilRoughnessMin,Math.min(R.roughnessMax,samples.dirtRoughness??roughness)),authoredSoil);
  return {path,sand,wet,authoredSoil,gravelWeight:(1-path)*(1-sand)*(1-authoredSoil),dirtWeight:(path+(1-path)*authoredSoil)*(1-sand),sandWeight:sand,
    normalStrength:lerp(lerp(lerp(lerp(P.gravelNormal,R.soilNormal,authoredSoil),samples.pbr?R.pathNormal:P.pathNormal,path),samples.pbr?R.sandNormal:P.sandNormal,sand),samples.pbr?R.wetNormal:P.wetNormal,wet),
    roughness:lerp(lerp(lerp(dryR,
      dirtR,path),sandR,sand),samples.pbr?lerp(sandR,R.wetRoughness,R.wetBlend):P.wetRoughnessMin+roughness*P.wetRoughnessRange,wet),
    macroMultiplier:P.macroMin+macro*P.macroRange,wetAlbedoMultiplier:lerp(1,P.wetAlbedoMultiplier,wet)};
}
