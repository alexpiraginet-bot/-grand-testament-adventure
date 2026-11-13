import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import * as THREE from 'three/webgpu';
import {requireHero,characterDiagnostics} from '../src/character-quality.ts';
import {StartupLifecycle} from '../src/startup-lifecycle.ts';
import {initialState,start,step,readingTime,restoreState,type EpisodeData} from '../src/missions.ts';
import {goals as makeGoals} from '../src/episode.ts';

function fixture(){
  const scene=new THREE.Group(),bone=new THREE.Bone();bone.name='hips';scene.add(bone);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.2,0,0,.2,0,0,0,1.76,0],3));
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(12),4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0],4));
  const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshBasicMaterial());scene.add(mesh);scene.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton([bone]));
  const walk=new THREE.AnimationClip('walk',1,[new THREE.VectorKeyframeTrack('hips.position',[0,1],[0,0,0,0,0,0])]);
  return {scene,animations:[walk]};
}
const read=(path:string)=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url),'utf8'));

test('the rendered human list contains only attached final actors, never narrative participants',()=>{
  const scene=new THREE.Scene(),asset=fixture(),actor=requireHero(asset);
  assert.equal(characterDiagnostics(scene).humans,0);
  scene.add(actor.root);actor.root.position.set(12,2,-3);
  const checked=characterDiagnostics(scene);
  assert.equal(checked.humans,1);assert.equal(checked.npcs,0);assert.equal(checked.primitiveHumanMeshes,0);
  assert.deepEqual(checked.rendered[0].position,{x:12,y:2,z:-3});
  assert.equal(checked.rendered[0].skinnedMeshes,1);assert.equal(checked.rendered[0].source,'tripo-r1/hero-native-skeleton');
  actor.root.visible=false;assert.equal(characterDiagnostics(scene).humans,0);
  actor.root.visible=true;actor.root.removeFromParent();assert.equal(characterDiagnostics(scene).humans,0);
});

test('missing, static or malformed heroes fail recoverably instead of producing another human',async()=>{
  for(const asset of [undefined,{scene:new THREE.Group(),animations:[]},
    {...fixture(),animations:[new THREE.AnimationClip('walk',0,[])]},
    {scene:new THREE.Group(),animations:fixture().animations}]){
    const startup=new StartupLifecycle();let released=0,sceneReady=false;
    await startup.track(Promise.resolve(asset),()=>released++);
    let failure:unknown;
    try{requireHero(asset);sceneReady=true;}catch(error){failure=error;startup.cancel(error);}
    assert.equal(sceneReady,false);assert.equal(startup.signal.aborted,true);assert.equal(released,1);
    assert.match(String(failure),/personagem principal/);assert.match(String(failure),/tente novamente|Tente novamente/);
  }
});

test('all missions and restored narrative progress work without instantiating NPC actors',()=>{
  const ep=read('src/data/mc-pescadores.json') as EpisodeData,goals=makeGoals(read('public/world/cafarnaum.json'));
  const scene=new THREE.Scene();scene.add(requireHero(fixture()).root);
  const state=initialState();start(state);
  for(let mission=0;mission<goals.length;mission++){
    const goal=goals[mission];
    step(state,ep,goals,{pos:goal.at,groundHeight:.2,action:true},.1);
    if(state.line){
      assert.deepEqual(state.line,ep.missoes[mission].fala);
      step(state,ep,goals,{pos:goal.at,groundHeight:.2,action:false},readingTime(state.line.texto)+.1);
    }
    assert.equal(characterDiagnostics(scene).npcs,0);
  }
  assert.equal(state.phase,'done');assert.equal(state.filled,ep.contador.prova.length);
  assert.deepEqual(state.followers,['simao','andre','tiago','joao']);
  assert.deepEqual(restoreState(ep,goals,2).followers,['simao','andre']);
  assert.equal(characterDiagnostics(scene).humans,1);
});

test('runtime module graph cannot import either historical procedural-human implementation',()=>{
  const pending=[fileURLToPath(new URL('../src/main.ts',import.meta.url))],visited=new Set<string>();
  while(pending.length){
    const file=pending.pop()!;if(visited.has(file))continue;visited.add(file);
    assert.ok(!['people.ts','rig.ts'].includes(basename(file)),`Rejected procedural human entered runtime: ${file}`);
    // Node strips type-only edges first. Match this project's static imports/re-exports and literal dynamic imports.
    const source=stripTypeScriptTypes(readFileSync(file,'utf8'));
    const imports=/\b(?:import|export)\s+(?:[^;]*?\sfrom\s*)?["'](\.[^"']+\.ts)["']|\bimport\s*\(\s*["'](\.[^"']+\.ts)["']/g;
    for(const match of source.matchAll(imports)){
      const next=resolve(dirname(file),match[1]??match[2]);assert.ok(existsSync(next));pending.push(next);
    }
  }
  assert.ok(visited.size>10,'check the transitive runtime graph, not a single import line');
});
