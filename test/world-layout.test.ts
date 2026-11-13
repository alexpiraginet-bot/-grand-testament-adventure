import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Terrain, decodeHeights } from '../src/terrain.ts';
import { missionRoutes, settlementLayout, insideObstacle } from '../src/world-layout.ts';
const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url));
const t=new Terrain(JSON.parse(read('public/world/cafarnaum.json').toString()),decodeHeights(JSON.parse(read('public/world/cafarnaum-heights.json').toString())));

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

test('ground PBR maps match their separately credited CC0 manifest',()=>{
  const manifest=JSON.parse(read('public/textures/ground/LICENSE.json').toString());
  assert.equal(manifest.license,'CC0-1.0');
  for(const map of Object.values(manifest.maps) as {path:string;sha256:string;bytes:number}[]){
    const bytes=read(map.path);assert.equal(bytes.length,map.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),map.sha256);
  }
});
