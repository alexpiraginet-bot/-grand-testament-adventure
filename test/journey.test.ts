import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildJourneyHint,journeyNarrative,journeyRoute} from '../src/journey.ts';
import {initialState,start,step,distanceToGoal,readingTime,type EpisodeData} from '../src/missions.ts';
import {goals as makeGoals} from '../src/episode.ts';
import {Terrain,decodeHeights} from '../src/terrain.ts';
import {missionRoutes,type Segment} from '../src/world-layout.ts';
const read=(path:string)=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)).toString());
const ep=read('src/data/mc-pescadores.json') as EpisodeData,goals=makeGoals(read('public/world/cafarnaum.json'));

test('guidance follows the actual episode through both encounters without changing scripture',()=>{
  const s=initialState(),before=JSON.stringify(ep);
  assert.equal(buildJourneyHint(s,null,false),'');start(s);
  assert.match(buildJourneyHint(s,300,false),/trilha/);
  const reach=(index:number,action=false,dt=.1)=>step(s,ep,goals,{pos:goals[index].at,groundHeight:.2,action},dt);
  reach(0);assert.equal(s.mission,1);
  assert.match(buildJourneyHint(s,distanceToGoal(s,goals,goals[0].at),false),/Simão e André/);
  reach(1);assert.equal(s.promptVisible,true);
  assert.match(buildJourneyHint(s,0,false),/Aperte E/);
  assert.match(buildJourneyHint(s,0,true),/Toque em Chamar/);
  reach(1,true);assert.equal(s.phase,'line');
  assert.equal(buildJourneyHint(s,0,false),'','editorial help yields to the literal subtitle');
  assert.deepEqual(s.line,ep.missoes[1].fala);
  reach(1,false,readingTime(s.line!.texto)+.1);assert.equal(s.mission,2);
  assert.match(buildJourneyHint(s,200,false),/barco de Tiago e João/);
  reach(2);assert.match(buildJourneyHint(s,0,true),/margem/);
  reach(2,true);assert.deepEqual(s.line,ep.missoes[2].fala);
  reach(2,false,readingTime(s.line!.texto)+.1);assert.equal(s.phase,'done');
  assert.equal(buildJourneyHint(s,null,true),'');assert.equal(JSON.stringify(ep),before);
});

test('distance alone never advertises an unavailable action and narration is separate from quotations',()=>{
  const state={phase:'play' as const,mission:1,promptVisible:false};
  assert.doesNotMatch(buildJourneyHint(state,0,false),/Aperte E/);
  assert.doesNotMatch(buildJourneyHint(state,Number.NaN,true),/Toque/);
  assert.equal(buildJourneyHint({...state,mission:99},10,false),'');
  assert.equal(journeyNarrative(99),'');
  for(let i=0;i<ep.missoes.length;i++){
    assert.ok(journeyNarrative(i).length>0);
    assert.ok(!Object.values(ep.versiculos).includes(journeyNarrative(i)));
  }
});

test('radar route starts on the active path and never projects beyond its current goal',()=>{
  const routes:Segment[]=[{ax:0,az:0,bx:0,bz:20,r:1},{ax:0,az:20,bx:20,bz:20,r:1},
    {ax:20,az:20,bx:20,bz:0,r:1},{ax:20,az:0,bx:40,bz:0,r:1}];
  const before=JSON.stringify(routes);
  assert.deepEqual(journeyRoute(routes,{x:1,z:7},{x:20,z:0}),[{x:0,z:7},{x:0,z:20},{x:20,z:20},{x:20,z:0}]);
  assert.deepEqual(journeyRoute(routes,{x:30,z:0},{x:20,z:0}),[{x:20,z:0}]);
  assert.deepEqual(journeyRoute(routes,{x:0,z:0},{x:200,z:200}),[]);
  assert.equal(JSON.stringify(routes),before);
});

test('real radar path preserves the village bends and walks around the inlet instead of across water',()=>{
  const terrain=new Terrain(read('public/world/cafarnaum.json'),decodeHeights(read('public/world/cafarnaum-heights.json')));
  const routes=missionRoutes(terrain),p=terrain.meta.points,point=([x,z]:[number,number])=>({x,z});
  const village=journeyRoute(routes,point(p.start),point(p.beach));
  assert.ok(village.length>2);assert.deepEqual(village.at(-1),point(p.beach));
  const coast=journeyRoute(routes,point(p.beach),point(p.simao));
  assert.ok(coast.length>2,'the inlet requires intermediate shore points');assert.deepEqual(coast.at(-1),point(p.simao));
  for(let i=1;i<coast.length;i++)for(let u=0;u<=1;u+=.01){
    const a=coast[i-1],b=coast[i];assert.ok(terrain.heightAt(a.x+(b.x-a.x)*u,a.z+(b.z-a.z)*u)>-.55);
  }
  const midpoint={x:(p.beach[0]+p.simao[0])/2,z:(p.beach[1]+p.simao[1])/2};
  assert.ok(terrain.heightAt(midpoint.x,midpoint.z)<-.55,'the discarded straight shortcut crosses deep water');
});
