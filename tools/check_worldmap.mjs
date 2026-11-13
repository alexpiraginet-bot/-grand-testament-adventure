// Local built-game map QA. Endpoint teleport is only for phase gating, never route proof.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const base=new URL(process.argv[2]||'http://127.0.0.1:4173/');base.searchParams.set('debug','1');
const out=process.argv[3]||'shots/r6-worldmap';mkdirSync(out,{recursive:true});
const report={url:base.href,startedAt:new Date().toISOString(),tests:[],note:'Chrome on PC; 390/320 viewports emulate touch, not physical phones. Temporary contexts, writes blocked. Map tests use real DOM/mouse/keyboard/touch. Debug teleport is used only to place the character at mission endpoints for line/end gating; no claim of a continuous playthrough here.'};
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:320,height:740}]){
 const mobile=viewport.width!==1280,context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile}),page=await context.newPage();
 const result={viewport,passed:false,errors:[],writes:[]};report.tests.push(result);
 page.on('pageerror',e=>result.errors.push(String(e)));
 await context.route('**/*',async route=>{const q=route.request();if(!['GET','HEAD'].includes(q.method())){result.writes.push({method:q.method(),origin:new URL(q.url()).origin,path:new URL(q.url()).pathname});await route.abort();}else await route.continue();});
 await page.addInitScript(()=>{
   window.__mapDraw={labels:[],bounds:[],dash:[]};
   for(const name of ['fillText','strokeRect','setLineDash']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){if(this.canvas.id==='worldmap-canvas'){const key=name==='fillText'?'labels':name==='strokeRect'?'bounds':'dash';window.__mapDraw[key].push(args);if(window.__mapDraw[key].length>200)window.__mapDraw[key].shift();}return original.apply(this,args);};}
   window.open=()=>null;
 });
 const snapshot=()=>page.evaluate(()=>{const g=window.__gta;return{pos:{...g.player.pos},time:g.state.time,phase:g.state.phase,mission:g.state.mission,lineLeft:g.state.lineLeft};});
 const map=()=>page.locator('#worldmap').evaluate(el=>el.open);
 const view=()=>page.locator('#worldmap-canvas').evaluate(el=>({zoom:Number(el.dataset.zoom),x:Number(el.dataset.centerX),z:Number(el.dataset.centerZ),width:el.clientWidth,height:el.clientHeight}));
 const render=()=>page.waitForTimeout(100);
 const shot=name=>page.screenshot({path:`${out}/${viewport.width}-${name}.png`});
 try{
  await page.goto(base.href,{waitUntil:'networkidle',timeout:90000});await page.waitForFunction(()=>window.__gta?.actor()&&!document.getElementById('go').disabled,null,{timeout:90000});
  await page.keyboard.press('KeyM');assert.equal(await map(),false,'M must not open during intro');
  await page.click('#go');await page.waitForTimeout(450);
  await page.click('#mapbtn');await page.waitForFunction(()=>document.getElementById('worldmap-canvas').dataset.zoom);
  assert.equal(await map(),true);assert.equal(await page.evaluate(()=>document.activeElement.id),'worldmap-heading');
  const frozen=await snapshot(),fit=await view();assert.equal(fit.zoom,1);assert.equal(Math.abs(fit.x),0);assert.equal(Math.abs(fit.z),0);
  const size=await page.evaluate(()=>window.__gta.meta.size),n=await page.evaluate(()=>window.__gta.meta.n);
  assert.equal(size,3072);assert.match(await page.locator('#worldmap-intro').innerText(),/3\.072 × 3\.072 m/);
  assert.equal(await page.locator('.worldmap-missions li').count(),3);
  assert.equal(await page.locator('[data-map-mission="0"]').getAttribute('aria-current'),'step');
  assert.match(await page.locator('.worldmap-mission-status').first().innerText(),/Missão atual.*m em linha reta/);
  for(const expected of ['Sua posição','Caminhos das missões','sem travessia a nado','Limite atual de movimentação'])assert.ok((await page.locator('.worldmap-legend').innerText()).includes(expected));
  assert.match(await page.locator('.worldmap-note').innerText(),/horizonte distante é cenário/);
  const draw=await page.evaluate(()=>window.__mapDraw),ppm=(Math.min(fit.width,fit.height)-48)/size;
  assert.ok(draw.labels.some(([text])=>/^\d[\d.]* m$/.test(text)),'canvas shows a metric scale');
  const bar=draw.labels.filter(([text])=>/^\d[\d.]* m$/.test(text)).at(-1)[0],metres=Number(bar.replace(/[^\d]/g,''));
  assert.ok(metres*ppm>0&&metres*ppm<=Math.min(110,fit.width*.24)+.01,'scale derives from the actual metre projection');
  assert.ok(draw.dash.some(([dash])=>JSON.stringify(dash)==='[7,5]'),'movement bounds are dashed');
  assert.ok(draw.bounds.some(([, ,w,h])=>Math.abs(w-(size-120)*ppm)<.01&&Math.abs(h-(size-120)*ppm)<.01),'border represents the 60m movement margin');
  result.scale={terrainSizeMeters:size,grid:n,fit,metres,pixels:metres*ppm};await shot('map-fit');
  const layout=await page.locator('#worldmap').evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,viewportWidth:innerWidth,viewportHeight:innerHeight};});
  assert.ok(layout.x>=0&&layout.y>=0&&layout.x+layout.w<=layout.viewportWidth+1&&layout.y+layout.h<=layout.viewportHeight+1,'map fits viewport');assert.ok(layout.scrollWidth<=layout.clientWidth+1,'no horizontal dialog overflow');result.layout=layout;
  await page.click('#worldmap-zoom-in');await render();assert.ok((await view()).zoom>1);
  await page.click('#worldmap-zoom-out');await render();assert.equal((await view()).zoom,1);
  await page.locator('#worldmap-canvas').focus();await page.keyboard.press('+');await render();assert.ok((await view()).zoom>1);
  await page.keyboard.press('-');await render();assert.equal((await view()).zoom,1);
  await page.click('#worldmap-locate');await render();const located=await view();assert.equal(located.zoom,4);assert.ok(Math.abs(located.x-frozen.pos.x)<.01&&Math.abs(located.z-frozen.pos.z)<.01);
  await page.keyboard.press('ArrowRight');await render();const shifted=await view();assert.ok(shifted.x>located.x);
  await page.keyboard.press('ArrowUp');await render();assert.ok((await view()).z<shifted.z);
  await page.locator('#worldmap-canvas').hover();await page.mouse.wheel(0,-200);await render();assert.ok((await view()).zoom>4);
  const box=await page.locator('#worldmap-canvas').boundingBox(),beforePan=await view();
  if(mobile){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width*.5,y:box.y+box.height*.5}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width*.65,y:box.y+box.height*.55}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
  else{await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.55,{steps:6});await page.mouse.up();}
  await render();const afterPan=await view();assert.ok(Math.abs(afterPan.x-beforePan.x)>1||Math.abs(afterPan.z-beforePan.z)>1,'native drag pans map');
  const playerBefore=await snapshot();await page.click('[data-map-mission="2"]');await render();const focused=await view(),goal=await page.evaluate(()=>window.__gta.goals[2].at);
  assert.ok(Math.abs(focused.x-goal.x)<.01&&Math.abs(focused.z-goal.z)<.01,'mission button centers the goal');assert.deepEqual(await snapshot(),playerBefore,'mission marker never teleports or progresses play');
  const mapVisibility=await page.locator('#worldmap-canvas').evaluate(el=>{
    const canvas=el.getBoundingClientRect(),layout=el.closest('.worldmap-layout').getBoundingClientRect();
    return Math.min(canvas.bottom,layout.bottom,innerHeight)-Math.max(canvas.top,layout.top,0);
  });assert.ok(mapVisibility>180,'selected goal brings the map back into view on mobile');
  await shot('map-zoom');await page.locator('#worldmap-canvas').focus();await page.keyboard.press('Home');await render();assert.equal((await view()).zoom,1);assert.equal(Math.abs((await view()).x),0);
  await page.click('#worldmap-zoom-in');await page.click('#worldmap-reset');await render();assert.equal((await view()).zoom,1);
  await page.locator('#worldmap-canvas').focus();await page.keyboard.down('KeyW');await page.waitForTimeout(250);await page.keyboard.up('KeyW');assert.deepEqual(await snapshot(),frozen,'all map controls leave position and mission clock frozen');
  await page.keyboard.press('Escape');assert.equal(await map(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'mapbtn');await page.waitForTimeout(200);assert.ok((await snapshot()).time>frozen.time,'closing resumes game clock');
  await page.locator('#mapbtn').focus();await page.keyboard.press('KeyM');assert.equal(await map(),true);await page.keyboard.press('KeyM');assert.equal(await map(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'mapbtn');
  await page.click('#mapbtn');await page.click('#worldmap-close');assert.equal(await map(),false);assert.equal(await page.evaluate(()=>document.activeElement.id),'mapbtn');
  await page.click('#hud [data-feedback-open]');await page.keyboard.press('KeyM');assert.equal(await map(),false,'M cannot stack a map over feedback');
  await page.fill('#feedback-title','Teste de mapa');await page.locator('#feedback-title').press('KeyM');assert.equal(await map(),false);assert.ok((await page.inputValue('#feedback-title')).toLowerCase().includes('m'));
  await page.keyboard.press('Escape');await page.click('#credbtn');await page.keyboard.press('KeyM');assert.equal(await map(),false,'credits block map');await page.click('#credclose');
  if(!mobile){
    await page.evaluate(()=>{const g=window.__gta;g.teleport(...g.meta.points.beach,Math.PI);});await page.waitForFunction(()=>window.__gta.state.mission===1);
    await page.evaluate(()=>{const g=window.__gta;g.teleport(g.meta.points.simao[0]+3,g.meta.points.simao[1],Math.PI);});await page.waitForFunction(()=>window.__gta.state.promptVisible);await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__gta.state.phase==='line');
    await page.keyboard.press('KeyM');assert.equal(await map(),true,'map is allowed while a line is displayed');const line=await snapshot();await page.waitForTimeout(300);assert.deepEqual(await snapshot(),line,'subtitle timer pauses too');await page.keyboard.press('KeyM');
    await page.waitForFunction(()=>window.__gta.state.mission===2,null,{timeout:15000});await page.evaluate(()=>{const g=window.__gta;g.teleport(...g.meta.points.barco_margem,Math.PI);});await page.waitForFunction(()=>window.__gta.state.promptVisible);await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.press('KeyE');await page.waitForFunction(()=>window.__gta.state.phase==='done',null,{timeout:20000});
    await page.keyboard.press('KeyM');assert.equal(await map(),false,'episode end blocks map');result.lineAndEndGates=true;
  }
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.writes,[]);Object.assign(result,{passed:true,paused:true,zoomPan:true,missionFocusWithoutTeleport:true,phaseGuards:true,focusReturned:true});
 }catch(error){result.failure=String(error);await shot('failure').catch(()=>{});console.error(`${viewport.width} FAILED ${error}`);}
 finally{await context.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
}}
finally{await browser.close();report.finishedAt=new Date().toISOString();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));if(report.tests.some(t=>!t.passed))process.exitCode=1;
