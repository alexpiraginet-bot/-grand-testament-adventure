import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Terrain,decodeHeights} from '../src/terrain.ts';
import {missionRoutes,settlementLayout,insideObstacle} from '../src/world-layout.ts';
import {DEFAULT_FAUNA_COUNTS,generateFauna,stepFauna,type FaunaAgent} from '../src/fauna-simulation.ts';
const read=(path:string)=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)).toString());
const terrain=new Terrain(read('public/world/cafarnaum.json'),decodeHeights(read('public/world/cafarnaum-heights.json')));
const routes=missionRoutes(terrain),houses=settlementLayout(terrain,routes);
const blocked=(x:number,z:number)=>houses.some(b=>insideObstacle(x,z,{...b,hx:b.w/2+.35,hz:b.d/2+.35},.25));
const checkHabitat=(agents:FaunaAgent[])=>{
  for(const a of agents){
    for(const value of [a.x,a.y,a.z,a.heading,a.homeX,a.homeZ,a.phase,a.time,a.speed])assert.ok(Number.isFinite(value));
    assert.ok(terrain.inside(a.x,a.z));
    const floor=terrain.heightAt(a.x,a.z);
    if(a.kind==='fish'){assert.ok(floor<-.65);assert.ok(a.y>floor&&a.y<0);}
    else {assert.ok(floor>=.25);assert.equal(blocked(a.x,a.z),false);assert.equal(a.y,floor);}
  }
};
const checkSeparation=(agents:FaunaAgent[])=>{
  for(let i=0;i<agents.length;i++)for(let j=i+1;j<agents.length;j++){
    const a=agents[i],b=agents[j];
    if((a.kind==='fish')!==(b.kind==='fish'))continue;
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=a.radius+b.radius+.03-1e-8,`${a.id} overlaps ${b.id}`);
  }
};

test('fauna placement is deterministic, bounded and separated between land and lake on the real map',()=>{
  const agents=generateFauna(terrain,routes,blocked);
  assert.deepEqual(agents,generateFauna(terrain,routes,blocked));
  assert.equal(new Set(agents.map(a=>a.id)).size,agents.length);
  for(const [kind,count] of Object.entries(DEFAULT_FAUNA_COUNTS))assert.equal(agents.filter(a=>a.kind===kind).length,count);
  checkHabitat(agents);
  checkSeparation(agents);
  assert.equal(new Set(agents.filter(a=>a.kind==='fish').map(a=>`${a.homeX},${a.homeZ}`)).size,6);
});

test('the first fish tick is continuous with its generated height, including an infinitesimal timestep',()=>{
  const agents=generateFauna(terrain,routes,blocked),before=structuredClone(agents),player={x:10000,z:10000};
  stepFauna(agents,terrain,blocked,player,1e-8);
  for(let i=0;i<agents.length;i++)if(agents[i].kind==='fish')assert.ok(Math.abs(agents[i].y-before[i].y)<1e-6);
  stepFauna(agents,terrain,blocked,player,1/60);
  for(let i=0;i<agents.length;i++)if(agents[i].kind==='fish')assert.ok(Math.abs(agents[i].y-before[i].y)<.02);
});

test('all scaled bodies retain separation throughout sixty seconds on the real map',()=>{
  const agents=generateFauna(terrain,routes,blocked),player={x:10000,z:10000};
  checkSeparation(agents);
  for(let frame=0;frame<1200;frame++){
    stepFauna(agents,terrain,blocked,player,.05);
    checkSeparation(agents);
    if(frame%100===0)checkHabitat(agents);
  }
  checkHabitat(agents);
  assert.equal(agents.filter(a=>a.kind==='goat').length,0);
  assert.equal(agents.filter(a=>a.kind==='sheep').length,12);
});

test('ambient motion remains finite and respects the real terrain and buildings',()=>{
  const agents=generateFauna(terrain,routes,blocked),before=structuredClone(agents),repeat=structuredClone(agents);
  const player={x:agents[0].x+.1,z:agents[0].z};
  for(let i=0;i<240;i++){
    stepFauna(agents,terrain,blocked,player,.05);stepFauna(repeat,terrain,blocked,player,.05);
    if(i%20===0)checkHabitat(agents);
  }
  checkHabitat(agents);assert.deepEqual(agents,repeat);
  assert.ok(agents.some((a,i)=>Math.hypot(a.x-before[i].x,a.z-before[i].z)>.5));
  assert.ok(Math.hypot(agents[0].x-player.x,agents[0].z-player.z)>.1,'the nearby chicken moves away from the player');
});

test('pause is exact and a long or invalid frame cannot jump through habitat boundaries',()=>{
  const agents=generateFauna(terrain,routes,blocked),before=structuredClone(agents),player={x:10000,z:10000};
  for(const dt of [0,-1,Number.NaN,Infinity])stepFauna(agents,terrain,blocked,player,dt);
  assert.deepEqual(agents,before);
  stepFauna(agents,terrain,blocked,player,1000);
  for(let i=0;i<agents.length;i++)assert.ok(Math.hypot(agents[i].x-before[i].x,agents[i].z-before[i].z)<.13);
  checkHabitat(agents);
});
