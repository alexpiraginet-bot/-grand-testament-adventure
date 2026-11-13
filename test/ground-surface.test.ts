import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {createGroundSurface,groundSurfaceDiagnostics,probeGroundSurface} from '../src/ground-surface.ts';
import type {Segment} from '../src/world-layout.ts';

const road:Segment={ax:0,az:-100,bx:0,bz:100,r:1.35};

test('surface retains vertex colours and borrows exactly the three existing maps, without geometry displacement',()=>{
  const maps={albedo:new THREE.Texture(),normal:new THREE.Texture(),roughness:new THREE.Texture()};
  const before=Object.values(maps).map(t=>({version:t.version,wrapS:t.wrapS,colorSpace:t.colorSpace}));
  let textureDisposals=0;for(const t of Object.values(maps))t.addEventListener('dispose',()=>textureDisposals++);
  const route=Object.freeze({...road}),material=createGroundSurface(maps,Object.freeze([route]));
  const nodes=new Set<THREE.Node>();
  for(const root of [material.colorNode,material.normalNode,material.roughnessNode])root!.traverse(n=>nodes.add(n));
  const samplers=[...nodes].filter(n=>(n as THREE.Node&{isTextureNode?:boolean}).isTextureNode);
  assert.equal(samplers.length,4);
  const used=new Set(samplers.map(n=>(n as THREE.Node&{value:THREE.Texture}).value));
  assert.deepEqual(used,new Set(Object.values(maps)));
  assert.equal(material.vertexColors,true);assert.equal(material.metalness,0);
  assert.equal(material.positionNode,null);assert.equal(material.displacementMap,null);
  assert.equal(material.normalNode!.constructor.name,'NormalMapNode');
  assert.ok((material.normalNode as THREE.Node&{scaleNode:THREE.Node}).scaleNode);
  assert.deepEqual(Object.values(maps).map(t=>({version:t.version,wrapS:t.wrapS,colorSpace:t.colorSpace})),before);
  material.dispose();assert.equal(textureDisposals,0,'the loader, not the surface material, owns shared textures');
});

test('a compacted centre has less relief, natural uneven shoulders, and unchanged dry gravel away from the route',()=>{
  const centre=probeGroundSurface({x:0,y:4,z:0},[road]);
  const away=probeGroundSurface({x:8,y:4,z:0},[road]);
  assert.equal(centre.path,1);assert.equal(away.path,0);
  assert.ok(centre.normalStrength<away.normalStrength/3);
  const shoulders=Array.from({length:100},(_,i)=>probeGroundSurface({x:1.2,y:4,z:i-50},[road]).path);
  assert.ok(Math.max(...shoulders)-Math.min(...shoulders)>.2,'edges should not have one constant ruler-straight opacity');
  for(const z of [-99,-10,0,25,99])assert.equal(probeGroundSurface({x:0,y:4,z},[road]).path,1);
  const widest=probeGroundSurface({x:1.6,y:4,z:0},[{...road,r:2.5}]);
  assert.ok(widest.path>probeGroundSurface({x:1.6,y:4,z:0},[road]).path,'authored route radii are respected');
});

test('shore material is continuous by lake elevation, smoother and darker when wet, without imposing a route underwater',()=>{
  const dry=probeGroundSurface({x:8,y:4,z:0},[]);
  const beach=probeGroundSurface({x:8,y:.3,z:0},[]);
  const wet=probeGroundSurface({x:8,y:-.2,z:0},[]);
  assert.equal(dry.sand,0);assert.equal(dry.wet,0);assert.equal(dry.path,0);
  assert.ok(beach.sand>.9);assert.equal(beach.wet,0);
  assert.equal(wet.wet,1);assert.equal(wet.path,0);
  assert.ok(wet.normalStrength<beach.normalStrength&&beach.normalStrength<dry.normalStrength);
  assert.ok(wet.wetAlbedoMultiplier<dry.wetAlbedoMultiplier);
  assert.ok(wet.roughness<beach.roughness&&wet.roughness>.5,'wet earth is not a mirror');
  let previous=probeGroundSurface({x:8,y:-.3,z:0},[]);
  for(let y=-.299;y<1.5;y+=.001){
    const now=probeGroundSurface({x:8,y,z:0},[]);
    assert.ok(Math.abs(now.normalStrength-previous.normalStrength)<.003);
    assert.ok(Math.abs(now.roughness-previous.roughness)<.003);previous=now;
  }
});

test('junctions and zero-length routes stay finite; invalid routes cannot poison a shader and an empty map has no path',()=>{
  const routes:Segment[]=[road,{...road,ax:-100,az:0,bx:100,bz:0},{ax:3,az:3,bx:3,bz:3,r:1},
    {...road,ax:NaN},{...road,r:-1},{...road,bx:Infinity}];
  assert.equal(groundSurfaceDiagnostics(routes).ignoredRoutes,3);
  assert.equal(probeGroundSurface({x:3,y:5,z:3},routes).path,1);
  assert.equal(probeGroundSurface({x:0,y:5,z:0},[]).path,0);
  for(let i=0;i<300;i++){
    const x=Math.sin(i*13.2)*20,z=Math.cos(i*9.7)*20,y=Math.sin(i)*4;
    const probe=probeGroundSurface({x,y,z},routes,{macro:(i%13)/12,roughness:(i%7)/6});
    for(const [key,value] of Object.entries(probe)){
      assert.ok(Number.isFinite(value),key);assert.ok(value>=0&&value<=1.06,key);
    }
  }
  assert.throws(()=>probeGroundSurface({x:NaN,y:0,z:0},routes),/finite world coordinates/);
});
