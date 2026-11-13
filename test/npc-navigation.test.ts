import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {Terrain,decodeHeights} from '../src/terrain.ts';import {npcs} from '../src/episode.ts';
import {NpcNavigation,npcLocalPath,npcCanTraverse,npcSpawn,npcStandable,npcCrossesBox,NPC_MOTION,type NpcGround} from '../src/npc-navigation.ts';
const field=(overrides:Partial<NpcGround>={}):NpcGround=>({heightAt:()=>.4,inside:(x,z)=>Math.abs(x)<100&&Math.abs(z)<100,blocked:()=>false,...overrides});
const houseWorld=()=>field({blocked:(x,z)=>x>4&&x<7&&Math.abs(z)<2,segmentBlocked:(a,b,r)=>npcCrossesBox(a,b,{x:5.5,z:0,hx:1.5,hz:2,rot:0},r)});
test('the full body and swept segment avoid water, walls and abrupt steps',()=>{
 const world=field({blocked:(x,z)=>x>4&&x<7&&Math.abs(z)<2,heightAt:(x,z)=>z<-5?-.5:x>20?1:.4});
 assert.equal(npcCanTraverse(world,{x:0,z:0},{x:10,z:0}),false);
 assert.equal(npcCanTraverse(world,{x:0,z:0},{x:0,z:-8}),false);
 assert.equal(npcStandable(world,{x:3.8,z:0}),false,'body touches wall although centre is outside');
 assert.equal(npcStandable(world,{x:19.9,z:0}),false,'discontinuous support under body');
 assert.equal(npcCanTraverse(world,{x:0,z:3},{x:10,z:3}),true);
});
test('local repair goes around a house without diagonal corner cutting',()=>{
 const world=houseWorld();
 const start={x:0,z:0},end={x:12,z:0},path=npcLocalPath(world,start,end,800);
 assert.ok(path&&path.length>2);let previous=start;
 for(const point of path){assert.ok(npcCanTraverse(world,previous,point));previous=point;}
 assert.deepEqual(path.at(-1),end);
});
test('following advances on the repaired trail, pauses and never warps to a distant player',()=>{
 const world=houseWorld();
 const nav=new NpcNavigation(world,{x:0,z:0},0,800),target={x:12,z:0};
 for(let i=0;i<650;i++){
  const previous={...nav.pos};nav.update(.05,target,true);
  assert.ok(Math.hypot(nav.pos.x-previous.x,nav.pos.z-previous.z)<=NPC_MOTION.speed*.05+1e-9);
  assert.ok(npcCanTraverse(world,previous,nav.pos));
 }
 assert.ok(Math.hypot(nav.pos.x-target.x,nav.pos.z-target.z)<1.6);
 const before=nav.diagnostics();nav.update(.05,{x:-10,z:-10},true,true);assert.deepEqual(nav.pos,before.pos);assert.equal(nav.speed,0);
 nav.update(.05,{x:90,z:90},true);assert.ok(Math.hypot(nav.pos.x-before.pos.x,nav.pos.z-before.pos.z)<=.0351);
});
test('unsafe disconnected destinations wait instead of crossing the lake; searches have a node budget',()=>{
 let calls=0;const world=field({blocked:()=>{calls++;return false;},heightAt:(x)=>x>2&&x<9?-.5:.4});
 const nav=new NpcNavigation(world,{x:0,z:0},0,80);nav.update(.05,{x:12,z:0},true);
 assert.deepEqual(nav.pos,{x:0,z:0});assert.ok(calls<30000,'bounded search must not walk a map-sized grid');
 calls=0;for(let i=0;i<10;i++)nav.update(.05,{x:12,z:0},true);assert.ok(calls<2000,'no repeated A* during retry window');
 assert.equal(npcLocalPath(world,{x:0,z:0},{x:99,z:99}),null);
});
test('initial spawn checks dry support and the caller can exclude the hero; no spawn if all invalid',()=>{
 const world=field({heightAt:(x)=>x<0?-.5:.4,blocked:(x,z)=>Math.hypot(x,z)<1.6});
 const pos=npcSpawn(world,{x:-1,z:0});assert.ok(pos&&npcStandable(world,pos));assert.ok(Math.hypot(pos.x,pos.z)>1.6);
 assert.equal(npcSpawn(field({heightAt:()=>-.5}),{x:0,z:0}),null);
});
test('the real shoreline places Simão on dry support and follows the nearby bank without changing the DEM',()=>{
 const read=(file:string)=>JSON.parse(readFileSync(new URL(`../public/world/${file}`,import.meta.url),'utf8'));
 const terrain=new Terrain(read('cafarnaum.json'),decodeHeights(read('cafarnaum-heights.json'))),before=new Float32Array(terrain.h);
 const world=field({heightAt:(x,z)=>terrain.heightAt(x,z),inside:(x,z)=>terrain.inside(x,z,10)}),story=npcs(terrain.meta,{simao:'Simão'})[0];
 const start=npcSpawn(world,story.pos);assert.ok(start);assert.ok(npcStandable(world,start));
 const nav=new NpcNavigation(world,start,story.facing,800),target={x:terrain.meta.points.simao[0]-6,z:terrain.meta.points.simao[1]};
 for(let i=0;i<600;i++){const previous={...nav.pos};nav.update(.05,target,true);assert.ok(npcCanTraverse(world,previous,nav.pos));}
 assert.ok(Math.hypot(nav.pos.x-target.x,nav.pos.z-target.z)<1.6);assert.deepEqual(terrain.h,before);
});
test('a wading player leaves a dry parallel destination, not a path through water',()=>{
 const world=field({heightAt:(_x,z)=>z<0?-.1:.2}),nav=new NpcNavigation(world,{x:0,z:1},0);
 for(let i=0;i<600;i++){const previous={...nav.pos};nav.update(.05,{x:10,z:-.5},true);assert.ok(npcCanTraverse(world,previous,nav.pos));assert.ok(nav.pos.z>.38);}
 assert.ok(nav.pos.x>8,'follower can advance along dry bank');
});
