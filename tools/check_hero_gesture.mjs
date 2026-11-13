// Focused real-rig check. Teleport stages the two mission points, then the real E action triggers the literal line.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const base=new URL(process.argv[2]||'http://127.0.0.1:4173/');base.searchParams.set('debug','1');
const out=process.argv[3]||'shots/r6-gesture';mkdirSync(out,{recursive:true});
const report={tests:[],note:'Actual GLB/skeleton rendered by Chrome on PC. Mobile is viewport emulation. Debug teleport stages mission locations and debug camera angles stage screenshots; the E key triggers the actual mission line. This is not evidence of a continuous walked route. Procedural pose, no new Tripo clip.'};
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:viewport.width<700}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(String(error)));
  await page.route('**/*',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
  const result={viewport,passed:false,errors};report.tests.push(result);
  try{
    await page.goto(base.href,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__gta?.actor()&&!document.getElementById('go').disabled,null,{timeout:60000});
    await page.click('#go');await page.waitForTimeout(1700);
    await page.evaluate(()=>{const g=window.__gta;g.teleport(...g.meta.points.beach,Math.PI);});await page.waitForFunction(()=>window.__gta.state.mission===1);
    await page.evaluate(()=>{const g=window.__gta;g.teleport(g.meta.points.simao[0]+3,g.meta.points.simao[1]-2,Math.PI);g.cam.dist=3.4;g.cam.pitch=.1;g.cam.yaw=g.player.heading+Math.PI*.65;document.activeElement?.blur();});
    await page.waitForFunction(()=>window.__gta.state.promptVisible);await page.waitForTimeout(600);
    await page.screenshot({path:`${out}/${viewport.width}-standing.png`});
    const before=await page.evaluate(()=>window.__gta.actor());
    const listeners=await page.evaluate(()=>window.__gta.npcPositions().filter(n=>['simao','andre'].includes(n.id)).map(n=>({id:n.id,pos:n.pos})));
    assert.equal(before.posture.available,true);assert.equal(before.gestureBones.length,8);
    await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__gta.state.line?.ref==='Marcos 1:17'&&window.__gta.actor().gestureWeight>.98);
    const inviting=await page.evaluate(()=>window.__gta.actor());
    assert.deepEqual(await page.evaluate(()=>window.__gta.npcPositions().filter(n=>['simao','andre'].includes(n.id)).map(n=>({id:n.id,pos:n.pos}))),listeners,'disciples listen in place during the invitation');
    assert.notDeepEqual(inviting.skeleton,before.skeleton);assert.equal(inviting.bones,65);assert.equal(inviting.skinnedMeshes,1);
    assert.ok([...inviting.bounds.min,...inviting.bounds.max].every(Number.isFinite));
    for(const [name,offset] of [['front',Math.PI],['side',Math.PI/2],['gameplay',0]]){
      await page.evaluate(offset=>{const g=window.__gta;g.cam.yaw=g.player.heading+offset;g.cam.idle=0;},offset);
      await page.waitForTimeout(230);assert.equal(await page.evaluate(()=>window.__gta.state.line?.ref),'Marcos 1:17');
      await page.screenshot({path:`${out}/${viewport.width}-invitation-${name}.png`});
    }
    await page.locator('#hud [data-feedback-open]').click();const paused=await page.evaluate(()=>window.__gta.actor());
    await page.waitForTimeout(350);assert.deepEqual(await page.evaluate(()=>window.__gta.actor()),paused,'paused pose is stable');await page.keyboard.press('Escape');
    await page.waitForFunction(()=>window.__gta.state.mission===2&&window.__gta.actor().gestureWeight<.001,null,{timeout:15000});
    await page.evaluate(()=>{const g=window.__gta;g.teleport(...g.meta.points.barco_margem,Math.PI);document.activeElement?.blur();});
    await page.waitForFunction(()=>window.__gta.state.promptVisible);await page.keyboard.press('KeyE');
    await page.waitForFunction(()=>window.__gta.state.line?.ref==='Marcos 1:20');await page.waitForTimeout(500);
    assert.ok(await page.evaluate(()=>window.__gta.actor().gestureWeight<.001),'narration is not performed as Jesus speaking');
    assert.deepEqual(errors,[]);Object.assign(result,{passed:true,bones:inviting.bones,skin:inviting.skinnedMeshes,gestureWeight:inviting.gestureWeight,gestureBones:inviting.gestureBones,paused:true,returnsToIdle:true,narrationExcluded:true});
  }catch(error){result.failure=String(error);await page.screenshot({path:`${out}/${viewport.width}-failure.png`});throw error;}
  finally{await context.close();}
 }
}finally{await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
