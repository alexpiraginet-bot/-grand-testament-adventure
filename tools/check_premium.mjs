// Visual/interaction regression for the R6 community and entry menus. No external writes.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const base=new URL(process.argv[2]||'http://127.0.0.1:4173/');base.searchParams.set('debug','1');
const out=process.argv[3]||'shots/r6-premium';mkdirSync(out,{recursive:true});
const report={tests:[],note:'Chrome on PC. Narrow viewports and touch are emulated, not physical iOS/Android. No GitHub publication, payment or signup. Screenshots require visual review; layout checks do not certify global WCAG compliance.'};
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
try {
  for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:320,height:740}]) {
    const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:viewport.width<700,hasTouch:viewport.width<700});
    const page=await context.newPage(),errors=[],writes=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.route('**/*',route=>{
      const request=route.request();if(!['GET','HEAD'].includes(request.method())){writes.push(request.url());return route.abort();}return route.continue();
    });
    const result={viewport,passed:false,errors,writes,panels:[]};report.tests.push(result);
    try {
      await page.goto(base.href,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>window.__gta&&!document.getElementById('go').disabled,null,{timeout:60000});
      await page.waitForTimeout(2000); // let the initial shader compile settle before visual capture
      await page.screenshot({path:`${out}/${viewport.width}-entry.png`});
      const entry=await page.locator('#start').evaluate(el=>({scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}));
      assert.ok(entry.scrollWidth<=entry.clientWidth+1,'entry has no horizontal overflow');
      await page.locator('#start [data-feedback-open]').click();
      assert.equal(await page.evaluate(()=>document.activeElement.id),'feedback-heading');
      for(const name of ['ideas','support','volunteer']) {
        await page.locator(`#community-${name}-tab`).click();
        await page.locator('#feedback').evaluate(el=>el.scrollTop=0);
        const layout=await page.locator('#feedback').evaluate(el=>{
          const tabs=[...el.querySelectorAll('[role=tab]')].map(tab=>{
            const r=tab.getBoundingClientRect();return {id:tab.id,width:r.width,height:r.height,clientWidth:tab.clientWidth,scrollWidth:tab.scrollWidth};
          });
          const r=el.getBoundingClientRect(),close=el.querySelector('#feedback-close').getBoundingClientRect();
          const fields=[...el.querySelectorAll('input:not([type=checkbox]),textarea,select')].filter(field=>field.getClientRects().length).map(field=>({id:field.id,fontSize:parseFloat(getComputedStyle(field).fontSize)}));
          return {x:r.x,width:r.width,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,tabs,fields,closeVisible:close.top>=0&&close.bottom<=innerHeight};
        });
        assert.ok(layout.scrollWidth<=layout.clientWidth+1,`${name} horizontal overflow`);
        assert.ok(layout.x>=0&&layout.x+layout.width<=viewport.width+1);
        assert.ok(layout.closeVisible,'return to game visible at top');
        for(const tab of layout.tabs){assert.ok(tab.height>=44,'touch target');assert.ok(tab.scrollWidth<=tab.clientWidth+1,'tab label not clipped');}
        for(const field of layout.fields)assert.ok(field.fontSize>=16,'input text avoids mobile auto-zoom');
        result.panels.push({name,...layout});
        await page.screenshot({path:`${out}/${viewport.width}-${name}.png`});
      }
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#feedback').evaluate(el=>el.open),false);
      assert.equal(await page.locator('#start').isVisible(),true,'closing collaboration preserves intro');
      await page.click('#go');await page.waitForTimeout(500);
      await page.locator('#hud [data-feedback-open]').click();
      const before=await page.evaluate(()=>({time:window.__gta.state.time,pos:{...window.__gta.player.pos}}));
      await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');
      assert.deepEqual(await page.evaluate(()=>({time:window.__gta.state.time,pos:{...window.__gta.player.pos}})),before,'menu suspends movement and game time');
      await page.locator('#feedback-close').click();await page.waitForTimeout(300);
      assert.ok(await page.evaluate(t=>window.__gta.state.time>t,before.time),'game resumes');
      if(viewport.width===1280){
        await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});
        await page.locator('#hud [data-feedback-open]').click();
        await page.screenshot({path:`${out}/1280-forced-colors.png`});
        result.forcedColors=await page.evaluate(()=>matchMedia('(forced-colors:active)').matches);
        assert.equal(result.forcedColors,true);await page.keyboard.press('Escape');
      }
      assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);result.passed=true;
    }catch(error){result.failure=String(error);await page.screenshot({path:`${out}/${viewport.width}-failure.png`});throw error;}
    finally{await context.close();}
  }
}finally{await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report,null,2));
