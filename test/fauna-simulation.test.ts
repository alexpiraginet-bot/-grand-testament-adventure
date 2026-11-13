import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Terrain,decodeHeights} from '../src/terrain.ts';
import {missionRoutes,settlementLayout,insideObstacle} from '../src/world-layout.ts';
import {DEFAULT_FAUNA_COUNTS,generateFauna,stepFauna,type FaunaAgent,type FaunaTerrain} from '../src/fauna-simulation.ts';
const read=(path:string)=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url)).toString());
const terrain=new Terrain(read('public/world/cafarnaum.json'),decodeHeights(read('public/world/cafarnaum-heights.json')));
const routes=missionRoutes(terrain),houses=settlementLayout(terrain,routes);
const blocked=(x:number,z:number)=>houses.some(b=>insideObstacle(x,z,{...b,hx:b.w/2+.35,hz:b.d/2+.35},.25));
const wrapped=(angle:number)=>Math.atan2(Math.sin(angle),Math.cos(angle));
const footprint=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const checkFishBody=(a:FaunaAgent,t:FaunaTerrain)=>{
  for(const [dx,dz] of footprint){
    const x=a.x+dx*a.radius,z=a.z+dz*a.radius;
    assert.ok(t.inside(x,z,.5),`${a.id} body crosses map boundary`);
    assert.ok(a.y-a.halfHeight>=t.heightAt(x,z)+.04-1e-8,`${a.id} body intersects bed`);
  }
  assert.ok(a.y+a.halfHeight<=-.04+1e-8,`${a.id} body crosses water surface`);
};
const checkHabitat=(agents:FaunaAgent[])=>{
  for(const a of agents){
    for(const value of [a.x,a.y,a.z,a.heading,a.homeX,a.homeZ,a.phase,a.time,a.speed])assert.ok(Number.isFinite(value));
    assert.ok(terrain.inside(a.x,a.z));
    const floor=terrain.heightAt(a.x,a.z);
    if(a.kind==='fish'){assert.ok(floor<-.65);checkFishBody(a,terrain);}
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

test('moving animals face their actual displacement with a bounded turn rate',()=>{
  const agents=generateFauna(terrain,routes,blocked),player={x:agents[0].x+.1,z:agents[0].z},dt=.05;
  let moves=0,turns=0;
  for(let frame=0;frame<240;frame++){
    const before=agents.map(a=>({x:a.x,z:a.z,heading:a.heading}));
    stepFauna(agents,terrain,blocked,player,dt);
    for(let i=0;i<agents.length;i++){
      const a=agents[i],b=before[i],dx=a.x-b.x,dz=a.z-b.z,distance=Math.hypot(dx,dz);
      const turn=Math.abs(wrapped(a.heading-b.heading));
      assert.ok(turn<=dt*3.5+1e-8,`${a.id} snapped its heading`);
      if(turn>1e-5)turns++;
      if(distance>1e-7){
        moves++;
        assert.ok(Math.abs(wrapped(a.heading-Math.atan2(dx,-dz)))<1e-7,`${a.id} moved sideways`);
        assert.ok(a.moving);
        assert.ok(Math.abs(a.speed-distance/dt)<1e-7);
      }
    }
  }
  assert.ok(moves>100&&turns>100,'exercise moving and turning agents, not just stationary ones');
});

test('fish body clears the sloping bed beside its centre and retains scaled asset bounds',()=>{
  const slope:FaunaTerrain={inside:()=>true,heightAt:(x)=>x>.10?-.66:-2};
  const fish:FaunaAgent={id:'slope-fish',kind:'fish',x:0,y:-.55,z:0,heading:Math.PI,
    homeX:0,homeZ:0,phase:0,scale:1.15,radius:.14,halfHeight:.14,seed:646,time:0,moving:false,speed:0};
  stepFauna([fish],slope,()=>false,{x:100,z:100},.1);
  checkFishBody(fish,slope);
  const agents=generateFauna(terrain,routes,blocked,{
    counts:{chicken:0,donkey:0,goat:0,sheep:0,fish:20},bodies:{fish:{radius:.35,halfHeight:.22}}
  });
  assert.equal(agents.length,20);
  for(const a of agents){assert.equal(a.radius,.35*a.scale);assert.equal(a.halfHeight,.22*a.scale);checkFishBody(a,terrain);}
  for(let frame=0;frame<240;frame++){
    stepFauna(agents,terrain,blocked,{x:10000,z:10000},.05);
    for(const a of agents)checkFishBody(a,terrain);
  }
  assert.throws(()=>generateFauna(terrain,routes,blocked,{bodies:{fish:{radius:0,halfHeight:.2}}}),/Invalid fauna body bounds/);
});

test('active radius freezes distant agents and avoids their terrain queries',()=>{
  const agents=generateFauna(terrain,routes,blocked),before=structuredClone(agents),all=structuredClone(agents);
  const player={x:agents[0].x,z:agents[0].z},activeRadius=20;
  let calls=0;
  const measured:FaunaTerrain={heightAt:(x,z)=>{calls++;return terrain.heightAt(x,z);},inside:(x,z,m)=>terrain.inside(x,z,m)};
  stepFauna(agents,measured,blocked,player,.05,{activeRadius});
  const nearCalls=calls;calls=0;
  stepFauna(all,measured,blocked,player,.05);
  assert.ok(nearCalls<calls/2,`near terrain work ${nearCalls} should be less than half of full work ${calls}`);
  assert.ok(agents[0].time>0);
  let frozen=0;
  for(let i=0;i<agents.length;i++)if(Math.hypot(before[i].x-player.x,before[i].z-player.z)>activeRadius){
    frozen++;assert.deepEqual(agents[i],before[i]);
  }
  assert.ok(frozen>agents.length/2);
  const paused=structuredClone(agents);
  for(const invalid of [-1,NaN])stepFauna(agents,measured,blocked,player,.05,{activeRadius:invalid});
  assert.deepEqual(agents,paused);
});

test('a frozen neighbour outside the active radius still reserves its body space',()=>{
  const lake:FaunaTerrain={heightAt:()=>-3,inside:()=>true};
  const fish:FaunaAgent={id:'active',kind:'fish',x:0,y:-.42,z:0,heading:Math.PI/2,
    homeX:0,homeZ:0,phase:0,scale:1,radius:.12,halfHeight:.12,seed:30,time:0,moving:false,speed:0};
  const neighbour={...fish,id:'frozen',x:.30,homeX:.30};
  const before=structuredClone(neighbour),agents=[fish,neighbour];
  for(let i=0;i<20;i++){
    stepFauna(agents,lake,()=>false,{x:-.1,z:0},.1,{activeRadius:.2});
    checkSeparation(agents);
    assert.deepEqual(neighbour,before);
  }
  assert.ok(fish.time>0,'the near fish was simulated');
});

test('reviewed chicken and donkey walk at their authored paces, with only nearby avoidance accelerating',()=>{
  const flat:FaunaTerrain={heightAt:()=>1,inside:()=>true};
  for(const [kind,nominal,radius,halfHeight] of [['chicken',.24,.28,.23],['donkey',.38,.91,.70]] as const){
    const agent:FaunaAgent={id:`reviewed-${kind}`,kind,x:0,y:1,z:0,heading:Math.PI,
      homeX:0,homeZ:0,phase:0,scale:1,radius,halfHeight,seed:500,time:0,moving:false,speed:0};
    let topSpeed=0;
    for(let i=0;i<600;i++){stepFauna([agent],flat,()=>false,{x:100,z:100},.05);topSpeed=Math.max(topSpeed,agent.speed);}
    assert.ok(topSpeed>nominal*.8&&topSpeed<=nominal+1e-8,`${kind} normal walk ${topSpeed} must match the reviewed gait`);
    let avoidanceSpeed=0;
    for(let i=0;i<80;i++){
      const player={x:agent.x-Math.sin(agent.heading)*.5,z:agent.z+Math.cos(agent.heading)*.5};
      stepFauna([agent],flat,()=>false,player,.05);avoidanceSpeed=Math.max(avoidanceSpeed,agent.speed);
    }
    assert.ok(avoidanceSpeed>nominal&&avoidanceSpeed<=nominal*1.65+1e-8);
  }
});
