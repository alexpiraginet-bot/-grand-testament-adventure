import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Terrain, decodeHeights } from '../src/terrain.ts';
import { missionRoutes, settlementLayout, insideObstacle } from '../src/world-layout.ts';
const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url));
const t=new Terrain(JSON.parse(read('public/world/cafarnaum.json').toString()),decodeHeights(JSON.parse(read('public/world/cafarnaum-heights.json').toString())));

test('the bent route remains continuous and visits the unchanged mission endpoints in order',()=>{
  const routes=missionRoutes(t),points=t.meta.points;
  assert.ok(routes.length<=12,'keep the per-fragment path-mask budget bounded');
  assert.deepEqual([routes[0].ax,routes[0].az],points.start);
  for(let i=1;i<routes.length;i++)assert.deepEqual([routes[i].ax,routes[i].az],[routes[i-1].bx,routes[i-1].bz]);
  let after=-1;
  for(const endpoint of [points.beach,points.simao,points.barco_margem]){
    const next=routes.findIndex((s,i)=>i>after&&Math.hypot(s.bx-endpoint[0],s.bz-endpoint[1])<1e-6);
    assert.ok(next>after,'each goal stays on the continuous route in episode order');after=next;
  }
  assert.deepEqual([routes.at(-1)!.bx,routes.at(-1)!.bz],points.barco_margem);
});

test('settlement leaves the entire mission corridor walkable on measured land',()=>{
  const routes=missionRoutes(t),plans=settlementLayout(t,routes);
  assert.ok(plans.length>=60,'a substantial village, not isolated huts');
  for(const s of routes) for(let i=0;i<=300;i++) for(const side of [-1,0,1]) {
    const dx=s.bx-s.ax,dz=s.bz-s.az,l=Math.hypot(dx,dz),x=s.ax+dx*i/300+dz/l*side,z=s.az+dz*i/300-dx/l*side;
    for(const p of plans)assert.equal(insideObstacle(x,z,{...p,hx:p.w/2+.35,hz:p.d/2+.35},.3),false,`blocked at ${x}, ${z}`);
    assert.ok(t.heightAt(x,z)>-.55,`deep water at ${x}, ${z}`);
  }
});

test('village walls meet the terrain and geometry generation does not modify the DEM',()=>{
  const before=new Float32Array(t.h),plans=settlementLayout(t,missionRoutes(t));
  for(const p of plans) {
    const c=Math.cos(p.rot),s=Math.sin(p.rot);
    for(const sx of [-1,1])for(const sz of [-1,1]){
      const floor=t.heightAt(p.x+c*sx*p.w/2+s*sz*p.d/2,p.z-s*sx*p.w/2+c*sz*p.d/2);
      assert.ok(p.y>=floor&&p.y-p.foundation<floor,'foundation touches all corners');
    }
  }
  assert.deepEqual(t.h,before);
});

test('ground and sky maps match their separately credited CC0 manifests',()=>{
 for(const directory of ['ground','sky']){
  const manifest=JSON.parse(read(`public/textures/${directory}/LICENSE.json`).toString());
  assert.equal(manifest.license,'CC0-1.0');
  for(const map of Object.values(manifest.maps) as {path:string;sha256:string;bytes:number}[]){
    const bytes=read(map.path);assert.equal(bytes.length,map.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),map.sha256);
  }
 }
});
