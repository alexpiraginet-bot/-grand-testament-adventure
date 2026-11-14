import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MountController,MountReservations,MOUNT_RULES,type MountWorld,type MountTarget,type MountPosition,type MountBodyQuery} from '../src/mount-controller.ts';
import {npcCrossesBox} from '../src/npc-navigation.ts';

const world=(overrides:Partial<MountWorld>={}):MountWorld=>({heightAt:()=>.5,inside:(x,z)=>Math.abs(x)<100&&Math.abs(z)<100,bodyClear:()=>true,...overrides});
const donkey=(overrides:Partial<MountTarget>={}):MountTarget=>({id:'fauna:donkey:1',kind:'donkey',x:0,y:.5,z:0,heading:0,radius:.7,halfHeight:.65,mountedHeight:2.6,approved:true,visualReady:true,...overrides});
const rider:MountPosition={x:1.2,y:.5,z:0};
function mounted(w=world(),target=donkey()){
  const controller=new MountController({walkSpeed:2.5});assert.equal(controller.tryMount(target,rider,w).ok,true);return controller;
}

test('physical approved nearby donkey with reviewed visual is required; failures never reserve',()=>{
  const controller=new MountController({walkSpeed:2.5});
  for(const [target,reason] of [
    [donkey({kind:'chicken'}),'invalid-target'],[donkey({approved:false}),'invalid-target'],
    [donkey({visualReady:false}),'visual-not-ready'],[donkey({x:10}),'too-far'],
    [donkey({y:2}),'too-far'],[donkey({radius:NaN}),'invalid-target'],
    [donkey({mountedHeight:1}),'invalid-target'],
  ] as const){assert.deepEqual(controller.tryMount(target,rider,world()),{ok:false,reason});assert.equal(controller.state,null);assert.equal(controller.isReserved(target.id),false);}
  assert.equal(controller.tryMount(donkey(),rider,world()).ok,true);
  assert.deepEqual(controller.tryMount(donkey({id:'other'}),rider,world()),{ok:false,reason:'already-mounted'});
  assert.equal(controller.state!.animalId,'fauna:donkey:1');
});

test('single ID has one owner and snapshots cannot mutate controller state',()=>{
  const reservations=new MountReservations(),a=new MountController({walkSpeed:2.5,reservations}),b=new MountController({walkSpeed:2.5,reservations});
  assert.equal(a.tryMount(donkey(),rider,world()).ok,true);
  assert.deepEqual(b.tryMount(donkey(),rider,world()),{ok:false,reason:'reserved'});
  const snapshot=a.state!;snapshot.x=99;snapshot.animalId='injected';assert.equal(a.state!.x,0);assert.equal(a.state!.animalId,donkey().id);
  assert.equal(reservations.release(donkey().id,Symbol('wrong-owner')),false);assert.equal(b.isReserved(donkey().id),true);
  assert.equal(a.tryDismount(world()).ok,true);assert.equal(b.isReserved(donkey().id),false);assert.equal(b.tryMount(donkey(),rider,world()).ok,true);
});

test('speed is exactly base walking times 1.6; diagonal and oversized inputs do not boost',()=>{
  const w=world();for(const [input,heading] of [[{x:0,z:-1},0],[{x:1,z:-1},Math.PI/4],[{x:0,z:-1000},0]] as const){
    const controller=mounted(w,donkey({heading})),before=controller.state!;const after=controller.update(.05,input,w)!;
    assert.equal(controller.speed,4);assert.ok(Math.abs(after.speed-4)<1e-12);assert.ok(Math.abs(Math.hypot(after.x-before.x,after.z-before.z)-.2)<1e-12);
  }
  const controller=new MountController({walkSpeed:3});assert.equal(controller.speed,3*1.6);
  const c=mounted();const extra={x:0,z:-1,run:true,boost:100};assert.equal(c.update(.05,extra,world())!.speed,4,'extraneous run/boost fields are ignored');
});

test('analogue magnitude is bounded and pause/nonfinite/lag never create a jump',()=>{
  const c=mounted(),w=world();assert.equal(c.update(.05,{x:0,z:-.5},w)!.speed,2);
  const before=c.state!;
  for(const [dt,input,paused] of [[0,{x:0,z:-1},false],[-2,{x:0,z:-1},false],[NaN,{x:0,z:-1},false],[Infinity,{x:0,z:-1},false],[.05,{x:NaN,z:0},false],[.05,{x:0,z:-1},true]] as const){
    const s=c.update(dt,input,w,{paused})!;assert.equal(s.x,before.x);assert.equal(s.z,before.z);assert.equal(s.speed,0);
  }
  const after=c.update(30,{x:0,z:-1},w)!;assert.ok(Math.abs(after.z-before.z)<=4*MOUNT_RULES.maxDt+1e-12);
});

test('turns are bounded and cannot instantly reverse or move sideways',()=>{
  const c=mounted(),before=c.state!,w=world(),s=c.update(.05,{x:0,z:1},w)!;
  assert.equal(s.x,before.x);assert.equal(s.z,before.z);assert.equal(s.speed,0);assert.ok(Math.abs(s.heading-before.heading)<=MOUNT_RULES.maxTurnRate*.05+1e-12);
  let previous=s;for(let i=0;i<30;i++){
    const next=c.update(.05,{x:0,z:1},w)!;const dx=next.x-previous.x,dz=next.z-previous.z;
    if(next.speed>0){assert.ok(Math.abs(dx-Math.sin(next.heading)*next.speed*.05)<1e-10);assert.ok(Math.abs(dz+Math.cos(next.heading)*next.speed*.05)<1e-10);}previous=next;
  }
  assert.ok(previous.z>0);
});

test('terrain checks cover body perimeter, map edge, shallow water and local gradient',()=>{
  for(const w of [world({heightAt:(x)=>x<-.6?-.1:.5}),world({inside:(x)=>x>-.6}),world({heightAt:(x)=>.5+x}),world({heightAt:(x,z)=>x<-.45&&z<-.45?NaN:.5})]){
    const c=new MountController({walkSpeed:2.5});assert.equal(c.tryMount(donkey(),rider,w).ok,false);assert.equal(c.state,null);
  }
});

test('swept callback sees complete combined height/radius and forbids low ceiling or wall approach',()=>{
  const seen:MountBodyQuery[]=[];const c=new MountController({walkSpeed:2.5});
  const ceiling=world({bodyClear:q=>{seen.push(q);return q.height<2;}});
  assert.deepEqual(c.tryMount(donkey(),rider,ceiling),{ok:false,reason:'unsafe-body'});
  const mountedQuery=seen.find(q=>q.phase==='ride')!;assert.equal(mountedQuery.radius,.7);assert.equal(mountedQuery.height,2.6);assert.equal(mountedQuery.animalId,donkey().id);
  const wall=world({bodyClear:q=>!npcCrossesBox(q.from,q.to,{x:.65,z:0,hx:.015,hz:2,rot:0},q.radius)});
  assert.deepEqual(c.tryMount(donkey(),rider,wall),{ok:false,reason:'unsafe-approach'});
});

test('a thin intervening obstacle rejects whole move even if endpoint point is clear',()=>{
  const c=mounted(),before=c.state!;
  const blocked=world({bodyClear:q=>q.phase!=='ride'||!npcCrossesBox(q.from,q.to,{x:0,z:-.8,hx:5,hz:.005,rot:0},q.radius)});
  const after=c.update(.05,{x:0,z:-1},blocked)!;assert.equal(after.x,before.x);assert.equal(after.z,before.z);assert.equal(after.speed,0);
});

test('water ahead, high step or unknown ground stops movement without relocation',()=>{
  for(const heightAt of [(x:number,z:number)=>z<-.8?-.1:.5,(x:number,z:number)=>z<-.8?2:.5,(x:number,z:number)=>z<-.8?NaN:.5]){
    const c=mounted(),before=c.state!,after=c.update(.05,{x:0,z:-1},world({heightAt}))!;
    assert.equal(after.x,before.x);assert.equal(after.y,before.y);assert.equal(after.z,before.z);assert.equal(after.speed,0);assert.equal(c.isReserved(donkey().id),true);
  }
});

test('dismount preview is side-local, no mutation, and chooses another side if the first is blocked',()=>{
  const c=mounted(),before=c.state!,w=world({bodyClear:q=>q.phase!=='dismount'||q.to.x<0});
  const exit=c.previewDismount(w)!;assert.ok(exit.position.x<0);assert.ok(Math.hypot(exit.position.x-before.x,exit.position.z-before.z)<1.5);
  assert.deepEqual(c.state,before);assert.equal(c.isReserved(donkey().id),true);
  exit.position.x=500;assert.ok(c.previewDismount(w)!.position.x<0);
  const done=c.tryDismount(w);assert.equal(done.ok,true);if(done.ok){assert.ok(done.position.x<0);assert.deepEqual(done.from,{x:0,y:.5,z:0});}
  assert.equal(c.state,null);assert.equal(c.isReserved(donkey().id),false);assert.deepEqual(c.tryDismount(w),{ok:false,reason:'not-mounted'});
});

test('blocked departure path rejects a free endpoint; all blocked exits keep rider reserved in place',()=>{
  const c=mounted(),before=c.state!;const blocked=world({bodyClear:q=>q.phase!=='dismount'});
  assert.equal(c.previewDismount(blocked),null);assert.deepEqual(c.tryDismount(blocked),{ok:false,reason:'no-safe-exit'});assert.deepEqual(c.state,before);assert.equal(c.isReserved(donkey().id),true);
  assert.equal(c.update(.05,{x:0,z:-1},blocked)!.z,before.z,'do not travel into a place with no reachable exit');
  const fresh=new MountController({walkSpeed:2.5});assert.deepEqual(fresh.tryMount(donkey(),rider,blocked),{ok:false,reason:'no-safe-exit'});assert.equal(fresh.isReserved(donkey().id),false);
});

test('dismount revalidates after HUD preview, including water under the full rider body',()=>{
  const c=mounted(),preview=c.previewDismount(world());assert.ok(preview);
  const flooded=world({heightAt:(x)=>Math.abs(x)>.85?-.2:.5});
  assert.equal(c.previewDismount(flooded),null);assert.deepEqual(c.tryDismount(flooded),{ok:false,reason:'no-safe-exit'});assert.equal(c.isReserved(donkey().id),true);
});

test('collision callbacks cannot change actual state by mutating query positions',()=>{
  const c=mounted(),before=c.state!;
  c.update(.05,{x:0,z:-1},world({bodyClear:q=>{q.from.x=1234;q.to.x=9999;return false;}}));
  assert.equal(c.state!.x,before.x);assert.equal(c.state!.z,before.z);
});

test('invalid walking speed is rejected instead of introducing unbounded acceleration',()=>{
  for(const walkSpeed of [0,-1,NaN,Infinity,100])assert.throws(()=>new MountController({walkSpeed}),/walking speed/);
});
