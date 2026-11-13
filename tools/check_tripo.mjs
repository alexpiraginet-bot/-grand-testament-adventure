// Real-browser integration check; mobile mode is viewport/touch emulation on this PC.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const base = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'shots/tripo-r1';
mkdirSync(out,{recursive:true});
const reports=[];
for (const config of [
  {name:'pc',viewport:{width:1280,height:800},deviceScaleFactor:1,hasTouch:false,gl:false},
  {name:'mobile',viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,gl:false},
  {name:'webgl',viewport:{width:1280,height:800},deviceScaleFactor:1,hasTouch:false,gl:true},
]) {
  const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'});
  try {
    const ctx=await browser.newContext(config), page=await ctx.newPage();
    const errors=[], warnings=[], httpErrors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    page.on('console',m=>{if(m.type()==='warning'||m.type()==='error') warnings.push(m.text());});
    page.on('response',r=>{if(r.status()>=400) httpErrors.push({url:r.url(),status:r.status()});});
    const start=Date.now();
    await page.goto(`${base}?debug=1${config.gl?'&gl=1':''}`,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__gta?.actor(),null,{timeout:60000});
    const readyMs=Date.now()-start;
    await page.click('#go'); await page.waitForTimeout(1800);
    const first=await page.evaluate(()=>({actor:window.__gta.actor(),pos:{...window.__gta.player.pos},source:window.__gta.heroSource,assets:window.__gta.assets,backend:window.__gta.backend,quality:window.__gta.quality}));
    assert.equal(first.actor.bones,65); assert.equal(first.actor.skinnedMeshes,1);
    assert.equal(first.assets.length,14); assert.ok(first.source.includes('native-skeleton'));
    await page.screenshot({path:`${out}/${config.name}-idle.png`});
    const cdp=config.hasTouch?await ctx.newCDPSession(page):null;
    if(cdp) {
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:80,y:650}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:80,y:606}]});
    } else await page.keyboard.down('KeyW');
    await page.waitForTimeout(2000);
    const walking=await page.evaluate(()=>({actor:window.__gta.actor(),pos:{...window.__gta.player.pos},speed:window.__gta.player.speed}));
    await page.screenshot({path:`${out}/${config.name}-walk.png`});
    if(cdp) await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); else await page.keyboard.up('KeyW');
    assert.ok(Math.hypot(walking.pos.x-first.pos.x,walking.pos.z-first.pos.z)>1);
    assert.ok(walking.actor.walkWeight>.9); assert.notDeepEqual(walking.actor.skeleton,first.actor.skeleton);
    await page.waitForTimeout(1500);
    assert.ok((await page.evaluate(()=>window.__gta.actor().walkWeight))<.001);
    await page.locator('#hud [data-feedback-open]').click();
    const paused=await page.evaluate(()=>window.__gta.actor());
    await page.waitForTimeout(500);
    assert.deepEqual(await page.evaluate(()=>window.__gta.actor()),paused);
    await page.keyboard.press('Escape');
    // Exercise four facing directions with the same rig and with the camera behind it.
    for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]) {
      await page.evaluate(a=>{const g=window.__gta;g.teleport(g.player.pos.x,g.player.pos.z,a);},angle);
      await page.waitForTimeout(200);
      const a=await page.evaluate(()=>window.__gta.actor());
      assert.ok([...a.bounds.min,...a.bounds.max].every(Number.isFinite));
      assert.ok(a.bounds.max[1]-a.bounds.min[1]>1.5 && a.bounds.max[1]-a.bounds.min[1]<2.1);
    }
    await page.evaluate(()=>{const g=window.__gta,P=g.meta.points;g.teleport(...P.barco_margem,Math.atan2(P.barco[0]-P.barco_margem[0],-(P.barco[1]-P.barco_margem[1])));g.cam.dist=6;});
    await page.waitForTimeout(1500); await page.screenshot({path:`${out}/${config.name}-boat.png`});
    const final=await page.evaluate(()=>({fps:window.__gta.fpsLog.slice(-8),render:window.__gta.info(),
      resources:performance.getEntriesByType('resource').map(r=>({name:new URL(r.name).pathname,transfer:r.transferSize,decoded:r.decodedBodySize}))}));
    assert.deepEqual(errors,[]); assert.deepEqual(httpErrors,[]);
    reports.push({...config,readyMs,...first,actor:{...first.actor,skeleton:undefined},...final,errors,warnings,httpErrors});
    writeFileSync(`${out}/report.json`,JSON.stringify({reports,note:'Physical PC; mobile viewport/touch emulation only. Walking input and pause tested, teleport only for facing/scenery screenshots.'},null,2));
  } finally {await browser.close();}
}
console.log(JSON.stringify(reports.map(({name,backend,readyMs,assets,fps,render,errors,warnings})=>({name,backend,readyMs,assets:assets.length,fps,render,errors,warnings})),null,2));
