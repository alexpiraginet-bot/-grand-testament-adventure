import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Terrain,decodeHeights} from '../src/terrain.ts';
import {lakeGeometry,lakeNormalPixels,water,LAKE_STYLE} from '../src/lake-surface.ts';

const meta=JSON.parse(readFileSync(new URL('../public/world/cafarnaum.json',import.meta.url),'utf8'));
const heights=JSON.parse(readFileSync(new URL('../public/world/cafarnaum-heights.json',import.meta.url),'utf8'));
const terrain=new Terrain(meta,decodeHeights(heights));

test('detailed lake mesh covers the far shore, faces upward and has a smaller mobile budget',()=>{
  let desktopCount=0;
  for(const mobile of [false,true]){
    const geometry=lakeGeometry(meta.far.size,terrain,mobile),p=geometry.attributes.position,n=geometry.attributes.normal;
    assert.equal(geometry.boundingBox!.min.x,-meta.far.size/2);assert.equal(geometry.boundingBox!.max.z,meta.far.size/2);
    assert.equal(geometry.boundingBox!.max.y,LAKE_STYLE.maximumWaveHeight);
    for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getX(i))&&Number.isFinite(p.getZ(i)));assert.ok(n.getY(i)>.999);}
    const [x0,x1,z0,z1]=geometry.userData.detailBounds;
    for(const [x,z] of [meta.points.beach,meta.points.simao,meta.points.barco])assert.ok(x>x0+24&&x<x1-24&&z>z0+24&&z<z1-24);
    if(!mobile)desktopCount=p.count;else assert.ok(p.count<desktopCount*.3);
    assert.ok(geometry.index!.count/3<50000);geometry.dispose();
  }
});

test('lake ripple field is deterministic and normalized with no image download',()=>{
  const data=lakeNormalPixels(64);assert.deepEqual(data,lakeNormalPixels(64));
  let variation=0;
  for(let i=0;i<data.length;i+=4){const xyz=[data[i],data[i+1],data[i+2]].map(x=>x/255*2-1);
    assert.ok(Math.abs(Math.hypot(...xyz)-1)<.012);assert.ok(xyz[2]>.6);assert.equal(data[i+3],255);variation+=Math.abs(xyz[0]);}
  assert.ok(variation>20);
});

test('mobile cannot allocate a reflection and paused game time does not advance the water',()=>{
  const lake=water(meta.far.size,terrain,{mobile:true,reflection:true});
  assert.equal(lake.mesh.userData.lakeSurface.reflection,false);assert.equal(lake.mesh.children.length,0);
  lake.update(10);assert.equal(lake.mesh.userData.lakeSurface.clock,10);
  lake.update(NaN);assert.equal(lake.mesh.userData.lakeSurface.clock,10);
  lake.update(10);assert.equal(lake.mesh.userData.lakeSurface.clock,10);
  lake.mesh.geometry.dispose();lake.mesh.material.dispose();
});
