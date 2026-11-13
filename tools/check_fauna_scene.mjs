// Runtime QA only when a reviewer grants the single-browser/GPU slot.
// Teleports are acoustic/visual staging, never a claim of a completed walking route.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {faunaAssetsManifest} from '../src/fauna-assets-manifest.ts';
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const base=new URL(process.argv[2]||'http://127.0.0.1:4191/');base.searchParams.set('debug','1');
const out=process.argv[3]||'shots/fauna-r8-scene',filter=process.argv.find(a=>a.startsWith('--case='))?.slice(7);
mkdirSync(out,{recursive:true});
const report={startedAt:new Date().toISOString(),url:base.href,tests:[],limits:[
 'Windows Chrome/WebKit with mobile viewport/UA. No physical iPhone, Safari recovery, thermal or sustained memory claim.',
 'Debug teleport stages a real generated animal; motion afterwards comes from the game simulation, not assigned animal coordinates.',
 'Root support height and obstacle diagnostics do not prove every animated foot/contact polygon; screenshots and model visual QA remain necessary.',
 'Scene-visible means within the renderer distance, not occlusion-tested pixel visibility.',
 'Visibility is a synthetic DOM event, not background suspension by an operating system.',
 'Five-second FPS window is a short measurement on this PC. GET/HEAD only; no publication or form submission.',
]};
const cases=[{name:'chrome-desktop',width:1280,height:800},{name:'chrome-mobile',width:390,height:844,mobile:true},{name:'webkit-mobile',width:390,height:844,mobile:true,webkit:true},{name:'chrome-fauna-404',width:390,height:844,mobile:true,failFauna:true},{name:'chrome-fauna-partial-404',width:390,height:844,mobile:true,failFauna:'donkey'}].filter(c=>!filter||c.name===filter);
assert.ok(cases.length,'unknown case');
const save=()=>writeFileSync(`${out}/report${filter?`-${filter}`:''}.json`,JSON.stringify(report,null,2));
const isFauna=url=>/\/models\/fauna-r8\/[^/]+\.glb(?:\?|$)/.test(url);
for(const c of cases){
 const expected=faunaAssetsManifest(!!c.mobile);assert.ok(expected.length,'No approved fauna profile for this case; do not invent a passing empty scene');
 if(typeof c.failFauna==='string')assert.ok(expected.some(a=>a.kind===c.failFauna),'partial failure case requires the targeted approved species');
 const engine=c.webkit?pw.webkit:pw.chromium;
 if(c.webkit)assert.ok(existsSync(engine.executablePath()),'existing WebKit binary required');
 const browser=await engine.launch(c.webkit?{headless:true}:{channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:c.width,height:c.height},deviceScaleFactor:1,isMobile:!!c.mobile,hasTouch:!!c.mobile,...(c.mobile?{userAgent:pw.devices['iPhone 13'].userAgent}:{})});
 const page=await context.newPage(),r={name:c.name,passed:false,expected,checks:[],samples:[],screenshots:[],pageErrors:[],consoleErrors:[],warnings:[],httpErrors:[],requests:[],requestFailures:[],responses:[],crashes:[],blockedWrites:[]};report.tests.push(r);
 const responseTasks=[];
 const failsModel=url=>!!c.failFauna&&isFauna(url)&&(c.failFauna===true||new URL(url).pathname.split('/').at(-1).startsWith(`${c.failFauna}-`));
 page.on('pageerror',e=>r.pageErrors.push(String(e)));page.on('crash',()=>r.crashes.push(new Date().toISOString()));
 page.on('console',m=>{if(m.type()==='error')r.consoleErrors.push({text:m.text(),location:m.location()});if(m.type()==='warning')r.warnings.push(m.text());});
 page.on('request',q=>r.requests.push({url:q.url(),type:q.resourceType(),at:Date.now()}));
 page.on('requestfailed',q=>r.requestFailures.push({url:q.url(),failure:q.failure()}));
 page.on('response',res=>{if(res.status()>=400)r.httpErrors.push({url:res.url(),status:res.status(),intentional:failsModel(res.url())});responseTasks.push(res.allHeaders().then(h=>r.responses.push({url:res.url(),status:res.status(),contentLength:Number(h['content-length'])||0})).catch(e=>r.warnings.push(`response capture: ${e}`)));});
 await context.route('**/*',route=>{
  if(!['GET','HEAD'].includes(route.request().method())){r.blockedWrites.push(route.request().url());return route.abort();}
  if(failsModel(route.request().url()))return route.fulfill({status:404,contentType:'text/plain',body:'Intentional optional fauna failure'});
  return route.continue();
 });
 const check=(ok,label)=>{assert.ok(ok,label);r.checks.push(label);};
 const shot=async label=>{const path=`${c.name}-${label}.png`;await page.screenshot({path:`${out}/${path}`});r.screenshots.push(path);};
 const snapshot=async label=>{const value=await page.evaluate(()=>({time:window.__gta.state.time,phase:window.__gta.state.phase,fauna:window.__gta.fauna(),audio:window.__gta.audio()}));r.samples.push({label,...value});return value;};
 const pose=s=>JSON.stringify({visible:s.fauna.visible,actors:s.fauna.renderer?.actors});
 function validSample(s){
  assert.equal(s.fauna.status,'ready');const f=s.fauna;
  assert.ok(f.renderer.instances<=(c.mobile?24:48));assert.ok(f.population.activeAgents<=(c.mobile?24:48));assert.ok(f.population.cachedSectors<=24);
  assert.ok(f.visible.every(a=>expected.some(p=>p.kind===a.kind)),'only approved species');
  assert.equal(s.audio.visibleAnimalEmitters,f.visible.filter(a=>a.kind!=='fish').length);
  for(const a of f.visible){
   assert.ok([a.x,a.y,a.z,a.speed,a.heading,a.scale,a.radius,a.halfHeight,a.groundHeight].every(Number.isFinite),'finite agent state');
   assert.ok(a.scale>0&&a.radius>0&&a.halfHeight>0&&a.speed>=0,'positive body dimensions');
   if(a.kind!=='fish'){assert.ok(Math.abs(a.y-a.groundHeight)<.001,'land animal root on measured terrain');assert.equal(a.blockedStatic,false,'no animal centre inside static obstacle');}
   else assert.ok(a.y+a.halfHeight<=.001&&a.y-a.halfHeight>=a.groundHeight-.001,'fish body remains between bed and surface');
  }
  for(let i=0;i<f.visible.length;i++)for(let j=i+1;j<f.visible.length;j++){
   const a=f.visible[i],b=f.visible[j];if((a.kind==='fish')!==(b.kind==='fish'))continue;
   assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=a.radius+b.radius-.02,'animal body discs do not overlap');
  }
 }
 try{
  const start=Date.now();await page.goto(base.href,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__gta?.loading().state==='ready'&&!document.getElementById('go').disabled,null,{timeout:120000});
  r.readyMs=Date.now()-start;r.loading=await page.evaluate(()=>window.__gta.loading());r.backend=await page.evaluate(()=>window.__gta.backend);
  check(r.loading.completed===14&&r.loading.total===14&&r.loading.failed===0,'opening still loads all 14 core assets');
  check((await snapshot('intro')).fauna.status==='not-started','optional fauna is not started before Go');
  check(!r.requests.some(q=>isFauna(q.url)),'no fauna GLB network before Go');await shot('intro');
  await page.locator('#go').click();await page.waitForFunction(()=>window.__gta.state.phase==='play',null,{timeout:10000});
  await page.waitForFunction(()=>['ready','unavailable'].includes(window.__gta.fauna().status),null,{timeout:75000});
  if(c.failFauna){
   const survivors=expected.filter(a=>c.failFauna!==true&&a.kind!==c.failFauna);
   if(survivors.length)await page.waitForFunction(()=>window.__gta.fauna().visible.length>0,null,{timeout:15000});
   const fail=await snapshot('fauna-failed');
   if(!survivors.length){check(fail.fauna.status==='unavailable'&&fail.fauna.renderer.instances===0,'failed optional GLBs create no placeholder animals');check(fail.audio.visibleAnimalEmitters===0,'failed animal meshes have no animal emitters');}
   else{
    check(fail.fauna.status==='ready'&&fail.fauna.renderer.instances>0,'a failed species does not disable the remaining approved fauna');
    check(fail.fauna.renderer.failedKinds.includes(c.failFauna)&&survivors.every(a=>fail.fauna.renderer.loadedKinds.includes(a.kind)),'failure is isolated to its species');
    check(fail.fauna.visible.every(a=>survivors.some(s=>s.kind===a.kind))&&fail.audio.visibleAnimalEmitters===fail.fauna.visible.filter(a=>a.kind!=='fish').length,'no placeholder or emitter for the failed species');
   }
   const count=r.requests.filter(q=>isFauna(q.url)).length;await page.waitForTimeout(5000);
   check(count===expected.length&&r.requests.filter(q=>isFauna(q.url)).length===count,'one attempt per failed species, no frame retry loop');
   check(await page.evaluate(t=>window.__gta.state.time>t+1,fail.time),'journey keeps advancing after optional fauna failure');await shot('failure-tolerated');
  }else{
   await page.waitForFunction(()=>window.__gta.fauna().visible.length>0,null,{timeout:15000});
   const loaded=await snapshot('loaded');validSample(loaded);
   check(expected.every(a=>loaded.fauna.renderer.loadedKinds.includes(a.kind)),'all selected approved species loaded');
   check(loaded.fauna.renderer.failedKinds.length===0&&loaded.fauna.renderer.pending===0,'no fauna decode failure or pending load');
   check(loaded.fauna.renderer.textureLimit===(c.mobile?512:2048),'renderer uses mobile/desktop texture cap');
   check(loaded.fauna.renderer.receivedBytes===expected.reduce((sum,a)=>sum+a.expectedBytes,0),'measured model bytes equal selected profile');
   const stage=await page.evaluate(()=>{
    const g=window.__gta,a=g.fauna().visible.filter(a=>a.kind!=='fish').sort((a,b)=>Math.hypot(a.x-g.player.pos.x,a.z-g.player.pos.z)-Math.hypot(b.x-g.player.pos.x,b.z-g.player.pos.z))[0]??g.fauna().visible[0];
    for(let i=0;i<12;i++){const angle=i*Math.PI/6,x=a.x+Math.sin(angle)*3,z=a.z+Math.cos(angle)*3;
     if(!g.blocked(x,z,false)){g.teleport(x,z,Math.atan2(a.x-x,-(a.z-z)));return{id:a.id,x,z};}}
    return{id:a.id,x:g.player.pos.x,z:g.player.pos.z,stagingSkipped:'No clear candidate'};
   });r.staging=stage;await page.waitForTimeout(400);await shot('near-animal');
   let moved=false,animated=false,prior=await snapshot('motion-start');const movingIds=new Set(),movingKinds=new Set(),animatedKinds=new Set();
   for(let i=0;i<64&&(i<36||expected.some(a=>!movingKinds.has(a.kind)||!animatedKinds.has(a.kind)));i++){
    await page.waitForTimeout(220);const now=await snapshot(`motion-${i}`);validSample(now);
    for(const a of now.fauna.visible){const old=prior.fauna.visible.find(b=>b.id===a.id);if(old&&Math.hypot(a.x-old.x,a.z-old.z)>.0001){moved=true;movingIds.add(a.id);movingKinds.add(a.kind);assert.ok(Math.hypot(a.x-old.x,a.z-old.z)<=Math.max(.05,(now.time-prior.time)*2),'bounded displacement between intermediate samples');}}
    for(const a of now.fauna.renderer.actors){const old=prior.fauna.renderer.actors.find(b=>b.id===a.id);if(old&&a.animated&&a.weight>.05&&Math.abs(a.clipTime-old.clipTime)>.0001){animated=true;const visible=now.fauna.visible.find(b=>b.id===a.id);if(visible)animatedKinds.add(visible.kind);}}
    prior=now;if(i===12||i===25)await shot(`motion-${i}`);
   }
   check(moved,'real generated animals move during intermediate samples');check(animated,'AnimationMixer clip time advances while locomotion has weight');r.movingIds=[...movingIds];r.movingKinds=[...movingKinds];r.animatedKinds=[...animatedKinds];
   check(expected.every(a=>movingKinds.has(a.kind)&&animatedKinds.has(a.kind)),'each approved species shows displacement and weighted clip advancement');
   check(true,'all intermediate samples keep body budgets, support, static clearance and finite state');
   for(const panel of [{name:'credits',open:'#credbtn',close:'#credclose',dialog:'#credits'},{name:'map',open:'#mapbtn',close:'#worldmap-close',dialog:'#worldmap'},{name:'feedback',open:'#hud [data-feedback-open]',close:'#feedback-close',dialog:'#feedback'}]){
    await page.locator(panel.open).click();await page.locator(panel.dialog).waitFor({state:'visible'});await page.waitForTimeout(100);
    const before=await snapshot(`${panel.name}-paused`);await page.waitForTimeout(500);const after=await snapshot(`${panel.name}-still-paused`);
    check(pose(before)===pose(after),`${panel.name} freezes animal transforms and mixer`);
    // Credits silence/freeze optional fauna while the existing global clock may advance.
    // Map/feedback own the global pause gate; do not invent the same contract for credits.
    if(panel.name!=='credits')check(before.time===after.time,`${panel.name} freezes the global game clock`);
    else r.creditsClockDelta=after.time-before.time;
    await page.locator(panel.close).click();await page.locator(panel.dialog).waitFor({state:'hidden'});
   }
   if(await page.evaluate(()=>window.__gta.audio().available)){
    await page.locator('#soundbtn').click();const a=await snapshot('muted');await page.waitForTimeout(1200);const b=await snapshot('muted-moving');
    check(b.audio.muted&&b.audio.nature.voices===0,'mute silences active sources');
    check(b.time>a.time&&pose(a)!==pose(b),'mute does not freeze animal simulation');await shot('muted');await page.locator('#soundbtn').click();
   }else check(await page.locator('#soundbtn').isDisabled(),'no Web Audio is honestly disabled, not reported as audio proof');
   r.performance=await page.evaluate(async()=>{const g=window.__gta,first=g.fpsLog.length,start=performance.now();let frames=0;await new Promise(resolve=>{function next(now){frames++;if(now-start>=5000)resolve();else requestAnimationFrame(next);}requestAnimationFrame(next);});return{elapsedMs:performance.now()-start,rafFrames:frames,rendererFPSSamples:g.fpsLog.slice(first),renderer:g.info(),fauna:g.fauna(),audio:g.audio()};});
   await shot('final');
  }
  await Promise.all(responseTasks);r.resourceTiming=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>({name:e.name,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,duration:e.duration})));
  r.bytes={responseHeaderBytes:r.responses.reduce((sum,e)=>sum+e.contentLength,0),faunaHeaderBytes:r.responses.filter(e=>isFauna(e.url)&&e.status<400).reduce((sum,e)=>sum+e.contentLength,0),resourceEncodedBytes:r.resourceTiming.reduce((sum,e)=>sum+e.encodedBodySize,0)};
  check(r.pageErrors.length===0&&r.crashes.length===0,'no captured page exception or crash');check(r.httpErrors.every(e=>e.intentional),'no unexpected HTTP errors');check(r.blockedWrites.length===0,'no writes attempted');
  check(r.consoleErrors.every(e=>c.failFauna&&/404/.test(e.text)),'no unexpected console error');r.passed=true;
 }catch(error){r.failure=String(error.stack||error);try{await snapshot('failure');await shot('failure');}catch{}}
 finally{await context.close();await browser.close();r.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({name:r.name,passed:r.passed,checks:r.checks.length,failure:r.failure,bytes:r.bytes}));}
}
report.finishedAt=new Date().toISOString();report.passed=report.tests.every(t=>t.passed);save();if(!report.passed)process.exitCode=1;
