import {test} from 'node:test';
import assert from 'node:assert/strict';
import {constrainMap,mapScaleBar,projectMap,zoomMap,type MapView} from '../src/worldmap.ts';

const view:MapView={width:800,height:600,size:3072,zoom:1,center:{x:0,z:0}};
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('world map keeps the radar orientation, real extent and reversible metre projection',()=>{
  const p=projectMap(view);
  assert.deepEqual(p.screen({x:0,z:0}),{x:400,y:300});
  assert.ok(p.screen({x:100,z:0}).x>400);assert.ok(p.screen({x:0,z:-100}).y<300);
  for(const point of [{x:-1536,z:-1536},{x:1536,z:1536},{x:-204.5,z:433.8}]){
    const round=p.world(p.screen(point));close(round.x,point.x);close(round.z,point.z);
  }
  close(p.screen({x:1536,z:0}).x-p.screen({x:-1536,z:0}).x,552);
});

test('fit resets centre and zoomed pan cannot lose the region beyond its bounds',()=>{
  const fitted=constrainMap({...view,center:{x:99999,z:-99999},zoom:.1});
  assert.equal(fitted.zoom,1);assert.equal(Math.abs(fitted.center.x),0);assert.equal(Math.abs(fitted.center.z),0);
  const bounded=constrainMap({...view,center:{x:99999,z:-99999},zoom:99});assert.equal(bounded.zoom,8);
  const p=projectMap(bounded),topLeft=p.world({x:24,y:24}),bottomRight=p.world({x:776,y:576});
  assert.ok(topLeft.x>=-1536&&topLeft.z>=-1536);assert.ok(bottomRight.x<=1536&&bottomRight.z<=1536);
});

test('zoom preserves the cursor world point while panning and zooming remain purely view state',()=>{
  const original={...view,zoom:3,center:{x:-100,z:200}},before=JSON.stringify(original),anchor={x:430,y:250};
  const at=projectMap(original).world(anchor),next=zoomMap(original,4.5,anchor),after=projectMap(next).world(anchor);
  close(at.x,after.x);close(at.z,after.z);assert.equal(JSON.stringify(original),before);
  assert.equal(zoomMap(original,100).zoom,8);assert.equal(zoomMap(original,.1).zoom,1);
});

test('scale bar derives its metric length from the actual projection at every zoom',()=>{
  for(const zoom of [1,1.5,4,8]){
    const ppm=projectMap({...view,zoom}).pixelsPerMetre,bar=mapScaleBar(ppm);
    close(bar.pixels,bar.metres*ppm);assert.ok(bar.pixels>0&&bar.pixels<=110);assert.ok(bar.metres>0);
  }
  assert.throws(()=>mapScaleBar(0));assert.throws(()=>mapScaleBar(Number.NaN));
});
