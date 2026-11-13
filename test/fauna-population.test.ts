import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Terrain,decodeHeights} from '../src/terrain.ts';
import {missionRoutes,settlementLayout,insideObstacle,distanceToSegment,type Building} from '../src/world-layout.ts';
import {createFaunaPopulation,generateFaunaSector,faunaSectorAt,type FaunaPopulationOptions} from '../src/fauna-population.ts';
import {stepFauna,type FaunaAgent} from '../src/fauna-simulation.ts';
const read=(path:string)=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)).toString());
const terrain=new Terrain(read('public/world/cafarnaum.json'),decodeHeights(read('public/world/cafarnaum-heights.json')));
const routes=missionRoutes(terrain),buildings=settlementLayout(terrain,routes);
const blocked=(x:number,z:number)=>buildings.some(b=>insideObstacle(x,z,{...b,hx:b.w/2,hz:b.d/2},.3));
const options:FaunaPopulationOptions={terrain,routes,buildings,blocked};
const footprint=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const flat={size:3072,heightAt:()=>1,inside:(x:number,z:number,margin=0)=>Math.abs(x)<=1536-margin&&Math.abs(z)<=1536-margin};
const house:Building={x:40,z:40,y:1,w:8,d:8,h:3,foundation:.2,rot:0,variant:0};
const plain:FaunaPopulationOptions={terrain:flat,routes:[],buildings:[house],blocked:()=>false};
function checkBodies(agents:FaunaAgent[],config:FaunaPopulationOptions){
  const t=config.terrain;
  for(const a of agents){
    for(const [dx,dz] of footprint){
      const x=a.x+dx*a.radius,z=a.z+dz*a.radius;
      assert.ok(t.inside(x,z,config.playableMargin??60),`${a.id} outside playable bounds`);
      const floor=t.heightAt(x,z);
      if(a.kind==='fish'){
        assert.ok(floor<-.65);assert.ok(a.y-a.halfHeight>=floor+.04-1e-8);assert.ok(a.y+a.halfHeight<=-.04+1e-8);
      }else{assert.ok(floor>=.25);assert.equal(config.blocked(x,z),false);}
    }
    if(a.kind!=='fish'){
      assert.equal(a.y,t.heightAt(a.x,a.z));
      assert.ok(config.routes.every(r=>distanceToSegment(a.x,a.z,r)>=r.r+a.radius+.5));
      assert.ok(config.buildings.every(b=>!insideObstacle(a.x,a.z,{...b,hx:b.w/2,hz:b.d/2},a.radius+.3)));
    }
  }
  for(let i=0;i<agents.length;i++)for(let j=i+1;j<agents.length;j++){
    const a=agents[i],b=agents[j];
    if((a.kind==='fish')===(b.kind==='fish'))assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=a.radius+b.radius+.03-1e-8);
  }
}

test('sector identities and positions are deterministic for positive and negative coordinates',()=>{
  assert.deepEqual(faunaSectorAt(-.1,-128),{x:-1,z:-1});
  assert.deepEqual(faunaSectorAt(128,0),{x:1,z:0});
  const a=generateFaunaSector(plain,{x:0,z:0}),b=generateFaunaSector(plain,{x:0,z:0});
  assert.ok(a.length>0);assert.deepEqual(a,b);
  assert.equal(new Set(a.map(a=>a.id)).size,a.length);
  assert.ok(a.every(a=>a.id.startsWith('fauna:92471:0:0:')));
  assert.notDeepEqual(a,generateFaunaSector({...plain,seed:123},{x:0,z:0}));
  assert.deepEqual(generateFaunaSector({...plain,species:[]},{x:0,z:0}),[]);
});

test('real map sectors populate inland and lake beyond the mission corridor without crossing habitat or props',()=>{
  const agents:FaunaAgent[]=[];
  // Offline exhaustive coverage of the current map; runtime never builds this global list.
  for(let z=-12;z<12;z++)for(let x=-12;x<12;x++){
    const sector=generateFaunaSector(options,{x,z});
    checkBodies(sector,options);agents.push(...sector);
  }
  assert.ok(agents.some(a=>a.kind==='fish'&&Math.hypot(a.x,a.z)>700),'lake fauna beyond the original corridor');
  assert.ok(agents.some(a=>a.kind!=='fish'&&Math.hypot(a.x,a.z)>700),'inland fauna beyond the original corridor');
  assert.equal(new Set(agents.map(a=>a.id)).size,agents.length);
  assert.deepEqual(generateFaunaSector(options,{x:100,z:100}),[]);
});

test('household animals require known frontages or supplied courtyards, while the open terrain supports herds',()=>{
  const near=generateFaunaSector(plain,{x:0,z:0});
  const empty=generateFaunaSector({...plain,buildings:[]},{x:0,z:0});
  const yard=generateFaunaSector({...plain,buildings:[],courtyards:[{id:'known-yard',x:50,z:50,radius:5}]},{x:0,z:0});
  assert.ok(near.some(a=>a.kind==='chicken'));assert.ok(yard.some(a=>a.kind==='chicken'));
  assert.ok(empty.every(a=>a.kind!=='chicken'&&a.kind!=='donkey'));
  const wild=Array.from({length:8},(_,x)=>generateFaunaSector({...plain,buildings:[]},{x,z:-2})).flat();
  assert.ok(wild.some(a=>a.kind==='sheep'||a.kind==='goat'));
  assert.equal(generateFaunaSector({...plain,blocked:()=>true},{x:0,z:0}).length,0);
});

test('sector streaming is incremental, capped, and performs zero terrain work during unchanged selections',()=>{
  let terrainQueries=0,blockerQueries=0;
  const population=createFaunaPopulation({...plain,
    terrain:{...flat,heightAt:()=>{terrainQueries++;return 1;}},blocked:()=>{blockerQueries++;return false;},
    maxAgents:8,maxLoadedSectors:9,maxCachedSectors:12,loadsPerUpdate:1
  });
  const player={x:64,z:64};let view=population.update(player);
  assert.equal(population.diagnostics().generatedSectors,1);
  for(let i=0;view.pendingSectors>0&&i<25;i++){
    const before=population.diagnostics().generatedSectors;view=population.update(player);
    assert.ok(population.diagnostics().generatedSectors-before<=1);
    assert.ok(view.agents.length<=8);assert.ok(view.loadedSectorIds.length<=9);
  }
  assert.equal(view.pendingSectors,0);checkBodies(view.agents,plain);
  const before={terrainQueries,blockerQueries,generated:population.diagnostics().generatedSectors},same=view.agents;
  for(let i=0;i<120;i++){
    view=population.update({x:65+i%3,z:65});
    assert.equal(view.agents,same);assert.equal(view.added.length,0);assert.equal(view.removed.length,0);
  }
  assert.deepEqual({terrainQueries,blockerQueries,generated:population.diagnostics().generatedSectors},before);
});

test('bounded cache preserves nearby motion, evicts distant sectors, and regenerates the same identities',()=>{
  const population=createFaunaPopulation({...plain,maxLoadedSectors:1,maxCachedSectors:2,maxAgents:48});
  const first=population.update({x:64,z:64});assert.ok(first.agents.length>0);
  const ids=first.agents.map(a=>a.id);first.agents[0].time=42;
  const move=population.update({x:192,z:64});assert.deepEqual(new Set(move.removed),new Set(ids));
  const back=population.update({x:64,z:64});assert.equal(back.agents[0].time,42);assert.equal(back.agents[0],first.agents[0]);
  for(const x of [320,448,576,704]){
    population.update({x,z:64});assert.ok(population.diagnostics().cachedSectors<=2);
  }
  const regenerated=population.update({x:64,z:64});assert.deepEqual(regenerated.agents.map(a=>a.id),ids);
  assert.ok(regenerated.agents.every(a=>a.time===0));
  const removed=population.clear();assert.deepEqual(removed,ids);assert.equal(population.diagnostics().cachedSectors,0);
});

test('stream order does not change sector identities and authored-body bounds apply to fish schools',()=>{
  const lake={...flat,heightAt:()=>-2};
  const config:FaunaPopulationOptions={...plain,terrain:lake,buildings:[],species:['fish'],bodies:{fish:{radius:.38,halfHeight:.27}},maxLoadedSectors:1,maxCachedSectors:2};
  const p=createFaunaPopulation(config),q=createFaunaPopulation(config);
  p.update({x:192,z:64});q.update({x:-192,z:-64});
  const a=p.update({x:64,z:64}),b=q.update({x:64,z:64});
  assert.ok(a.agents.length>0);assert.deepEqual(a.agents,b.agents);checkBodies(a.agents,config);
  for(const fish of a.agents){assert.equal(fish.radius,.38*fish.scale);assert.equal(fish.halfHeight,.27*fish.scale);}
  const none=generateFaunaSector({...config,waterBlocked:()=>true},{x:0,z:0});assert.deepEqual(none,[]);
});

test('wandering uses the population terrain wrapper to retain the playable margin',()=>{
  const population=createFaunaPopulation({...plain,buildings:[],species:['fish'],terrain:{...flat,heightAt:()=>-3}});
  assert.equal(population.habitatTerrain.inside(1477,0,.5),false);
  assert.equal(population.habitatTerrain.inside(1475,0,.5),true);
  const fish:FaunaAgent={id:'edge',kind:'fish',x:1475.7,z:0,y:-.42,heading:Math.PI/2,homeX:1475.7,homeZ:0,
    scale:1,radius:.12,halfHeight:.12,seed:30,time:0,phase:0,moving:false,speed:0};
  for(let i=0;i<120;i++)stepFauna([fish],population.habitatTerrain,()=>false,{x:0,z:0},.05);
  assert.ok(flat.inside(fish.x+fish.radius,fish.z,60));
});

test('invalid configuration is rejected before sector generation and an invalid player cannot mutate population',()=>{
  assert.throws(()=>createFaunaPopulation({...plain,maxAgents:NaN}),/Invalid fauna population/);
  assert.throws(()=>createFaunaPopulation({...plain,sectorSize:0}),/Invalid fauna population/);
  assert.throws(()=>createFaunaPopulation({...plain,loadRadius:100000}),/Invalid fauna population/);
  assert.throws(()=>generateFaunaSector(plain,{x:1.5,z:0}),/Invalid fauna sector/);
  const population=createFaunaPopulation(plain),before=population.diagnostics();
  assert.deepEqual(population.update({x:NaN,z:0}).agents,[]);assert.deepEqual(population.diagnostics(),before);
});
