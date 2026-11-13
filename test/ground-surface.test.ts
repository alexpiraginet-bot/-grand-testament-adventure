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

test('R13 uses independent photographic colour, normal and roughness fields, while borrowing every texture',()=>{
  const maps={albedo:new THREE.Texture(),normal:new THREE.Texture(),roughness:new THREE.Texture(),
    dirtAlbedo:new THREE.Texture(),dirtNormalRoughness:new THREE.Texture(),sandAlbedo:new THREE.Texture(),sandNormalRoughness:new THREE.Texture()};
  const before=Object.values(maps).map(t=>({version:t.version,repeat:t.repeat.toArray(),wrapS:t.wrapS}));
  let disposed=0;Object.values(maps).forEach(t=>t.addEventListener('dispose',()=>disposed++));
  const material=createGroundSurface(maps,[road]);
  const sampled=(root:THREE.Node)=>{const values=new Set<THREE.Texture>();root.traverse(n=>{
    const node=n as THREE.Node&{isTextureNode?:boolean;value:THREE.Texture};if(node.isTextureNode)values.add(node.value);
  });return values;};
  assert.ok(sampled(material.colorNode!).has(maps.dirtAlbedo));assert.ok(sampled(material.colorNode!).has(maps.sandAlbedo));
  for(const root of [material.normalNode!,material.roughnessNode!]){
    assert.ok(sampled(root).has(maps.dirtNormalRoughness));assert.ok(sampled(root).has(maps.sandNormalRoughness));
  }
  assert.deepEqual(material.userData.groundSurface.pbrMaterials,{dirt:true,sand:true});
  assert.equal(material.userData.groundSurface.textureCount,7);
  assert.equal(material.vertexColors,false,'the shader applies biome vertex tint only to gravel, not twice to photographic albedo');
  assert.equal(material.positionNode,null);
  material.dispose();assert.equal(disposed,0);
  assert.deepEqual(Object.values(maps).map(t=>({version:t.version,repeat:t.repeat.toArray(),wrapS:t.wrapS})),before);
});

test('incomplete optional material pairs use the existing fallback rather than an albedo-only fake PBR',()=>{
  const maps={albedo:new THREE.Texture(),normal:new THREE.Texture(),roughness:new THREE.Texture(),dirtAlbedo:new THREE.Texture()};
  const material=createGroundSurface(maps,[road]);
  assert.equal(material.name,'ground-r10');assert.equal(material.vertexColors,true);
  assert.deepEqual(material.userData.groundSurface.pbrMaterials,{dirt:false,sand:false});material.dispose();
});

test('PBR route and shoreline masks remain continuous and material-specific roughness survives the blend',()=>{
  const dry={x:0,y:4,z:0},shore={x:0,y:.05,z:0},gravel={x:80,y:4,z:0};
  const low={pbr:true,dirtRoughness:.7,sandRoughness:.75},high={pbr:true,dirtRoughness:.96,sandRoughness:.95};
  assert.ok(probeGroundSurface(dry,[road],high).roughness-probeGroundSurface(dry,[road],low).roughness>.2);
  assert.equal(probeGroundSurface(gravel,[road],high).roughness,probeGroundSurface(gravel,[road],low).roughness);
  assert.equal(probeGroundSurface(shore,[road],low).dirtWeight,0,'sand wins at the waterline even where a route continues');
  for(let i=0;i<300;i++){
    const point={x:(i%17)/4,y:(i%23)/10-.3,z:i/7};
    const value=probeGroundSurface(point,[road],low),next=probeGroundSurface({...point,y:point.y+.001},[road],low);
    assert.ok(Math.abs(value.gravelWeight+value.dirtWeight+value.sandWeight-1)<1e-12);
    assert.ok(Math.abs(next.roughness-value.roughness)<.004);
    assert.ok(value.roughness>.5&&value.roughness<=1);
  }
});

test('authored dry ground extends real dirt into village shoulders without changing shore or route masks',()=>{
  const options={pbr:true,dirtRoughness:.86};
  for(const x of [0,2,8,20]){
    const p=probeGroundSurface({x,y:4,z:0},[road],options);
    assert.equal(p.authoredSoil,1);assert.equal(p.dirtWeight,1);assert.equal(p.gravelWeight,0);
    assert.equal(p.path,probeGroundSurface({x,y:4,z:0},[road]).path);
  }
  const far=probeGroundSurface({x:80,y:4,z:0},[road],options);
  assert.equal(far.authoredSoil,0);assert.equal(far.gravelWeight,1);
  assert.equal(probeGroundSurface({x:0,y:4,z:0},[],options).authoredSoil,0);
  for(let x=20;x<48;x+=.05){
    const a=probeGroundSurface({x,y:4,z:7},[road],options),b=probeGroundSurface({x:x+.05,y:4,z:7},[road],options);
    assert.ok(Math.abs(a.authoredSoil-b.authoredSoil)<.02,'wide soil-to-distant-gravel blend has no hard edge');
  }
  const beach=probeGroundSurface({x:8,y:.05,z:0},[road],options);
  assert.equal(beach.sandWeight,1);assert.equal(beach.dirtWeight,0);
});
