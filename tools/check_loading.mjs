// Loading/recovery browser QA. This file does not install browsers or alter the application.
// node tools/check_loading.mjs [url] [outdir] [--webkit] [--case=slow-mobile]
import {createRequire} from 'node:module';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const playwright=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const args=process.argv.slice(2),positionals=args.filter(x=>!x.startsWith('--'));
const webkit=args.includes('--webkit'),caseFilter=args.find(x=>x.startsWith('--case='))?.slice(7);
const base=new URL(positionals[0]||'http://127.0.0.1:4187/');base.searchParams.set('debug','1');
const out=positionals[1]||`shots/r7-loading-${webkit?'webkit':'chrome'}`;mkdirSync(out,{recursive:true});
const roster=JSON.parse(readFileSync(new URL('../src/data/tripo-assets.json',import.meta.url),'utf8'));
const runtimeCount=Object.values(roster.assets).filter(a=>a.status==='runtime').length;
const type=webkit?playwright.webkit:playwright.chromium;
const cases=[
 {name:'slow-desktop',width:1280,height:800,slow:true},
 {name:'slow-mobile',width:390,height:844,mobile:true,slow:true,reducedMotion:true},
 {name:'fail-retry',width:1280,height:800,fail:'world',recover:'retry'},
 {name:'asset-retry',width:390,height:844,mobile:true,fail:'asset',recover:'retry'},
 {name:'fail-safe',width:390,height:844,mobile:true,fail:'world',recover:'safe'},
 {name:'context-loss-loading',width:390,height:844,mobile:true,contextLoss:'loading'},
 {name:'context-loss-ready',width:1280,height:800,contextLoss:'ready'},
].filter(c=>!caseFilter||c.name===caseFilter);
assert.ok(cases.length,'Unknown --case filter');
if(webkit&&!existsSync(type.executablePath()))throw Error(`WebKit not installed: ${type.executablePath()}. No automatic download is allowed by this harness.`);
const report={startedAt:new Date().toISOString(),url:base.href,engine:webkit?'Playwright WebKit on Windows':'Chrome on Windows',runtimeCount,tests:[],notes:[
 '390×844 uses the iPhone user-agent/touch emulation. This is not Safari on an actual iPhone and does not reproduce iOS memory/process-kill limits.',
 'WebKit availability and functional execution are separate. Browser binaries are never installed automatically.',
 'Network fixtures hold a real GLB response or return one explicit HTTP 500; successful retries use the actual local server and models.',
 'Displayed completed/total describe GLB tasks. Percentage also includes real renderer/world preparation, so it is not asserted equal to completed/total.',
 'Context-loss cases force WebGL2 and use WEBGL_lose_context on the actual renderer context. Only if that extension is absent is a synthetic event used, explicitly marked as application-handler coverage rather than real GPU-context-loss evidence.',
 'FPS is a short two-second renderer-counter sample after entering the game, not a sustained benchmark. Resource Timing summaries cover the current document; a retry starts a new timing buffer.',
 'GET/HEAD only. No feedback, donation, cloud data or issue is submitted.'
]};
const browser=await type.launch(webkit?{headless:true}:{headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});

async function run(config){
 const options={viewport:{width:config.width,height:config.height},deviceScaleFactor:1,hasTouch:!!config.mobile,isMobile:!!config.mobile,reducedMotion:config.reducedMotion?'reduce':'no-preference'};
 if(config.mobile)options.userAgent=playwright.devices['iPhone 13'].userAgent;
 const context=await browser.newContext(options),page=await context.newPage();
 const result={name:config.name,options,passed:false,errors:[],consoleErrors:[],warnings:[],crashes:[],httpErrors:[],blockedWrites:[],screenshots:[],observations:[],requests:[],navigations:[],routeContinueErrors:[],completedGlbRequests:0,maxConcurrentGlbRequests:0};
 report.tests.push(result);
 let injected=false,held=false,releaseFirst,contextLossInjected=false;
 const firstGate=new Promise(resolve=>{releaseFirst=resolve;});
 let firstAssetResolve;
 const firstAssetSeen=new Promise(resolve=>{firstAssetResolve=resolve;});
 const activeGlbs=new Set();
 const isGlb=url=>new URL(url).pathname.toLowerCase().endsWith('.glb');
 page.on('pageerror',e=>result.errors.push(String(e)));
 page.on('crash',()=>result.crashes.push({at:new Date().toISOString(),url:page.url()}));
 page.on('framenavigated',frame=>{if(frame===page.mainFrame())result.navigations.push({url:frame.url(),at:new Date().toISOString()});});
 page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text());else if(m.type()==='warning')result.warnings.push(m.text());});
 page.on('response',r=>{if(r.status()>=400)result.httpErrors.push({url:r.url(),status:r.status()});});
 page.on('request',r=>{if(isGlb(r.url())){activeGlbs.add(r);result.maxConcurrentGlbRequests=Math.max(result.maxConcurrentGlbRequests,activeGlbs.size);result.requests.push({url:r.url(),at:new Date().toISOString()});}});
 page.on('requestfinished',r=>{if(activeGlbs.delete(r))result.completedGlbRequests++;});
 page.on('requestfailed',r=>{activeGlbs.delete(r);});
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(!['GET','HEAD'].includes(request.method())){result.blockedWrites.push({url:request.url(),method:request.method()});return route.abort();}
  const matchFailure=config.fail==='world'?url.pathname.endsWith('/world/cafarnaum.json'):config.fail==='asset'&&isGlb(url.href);
  if(config.fail&&!injected&&matchFailure){
   injected=true;result.injectedFailure={url:url.href,status:500,at:new Date().toISOString()};
   return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'intentional-loading-QA-once'})});
  }
  if((config.slow||config.contextLoss==='loading')&&isGlb(url.href)&&!held){held=true;firstAssetResolve(url.href);await firstGate;}
  try{return await route.continue();}catch(error){
   // An application may correctly abort the held fetch when the renderer is lost.
   // Preserve that fact without turning the deliberately cancelled request into an unhandled harness rejection.
   if(contextLossInjected){result.routeContinueErrors.push(String(error));return;}
   if(!page.isClosed())throw error;
  }
 });
 await page.addInitScript(()=>{
  window.__loadingQaTrace=[];
  window.__loadingQaDocumentId=typeof crypto.randomUUID==='function'?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
  const capture=()=>{
   const screen=document.getElementById('loading-screen'),bar=document.getElementById('loading-progress'),stage=document.getElementById('loading-stage'),go=document.getElementById('go');
   if(!screen||!bar)return;
   const value=Number(bar.getAttribute('aria-valuenow')),max=Number(bar.getAttribute('aria-valuemax'));
   const item={at:performance.now(),state:screen.dataset.state,value,max,completed:Number(bar.dataset.completed),total:Number(bar.dataset.total),stage:stage?.textContent?.trim()||'',goDisabled:go?.disabled??null};
   const list=window.__loadingQaTrace,last=list.at(-1);
   if(!last||['state','value','max','completed','total','stage','goDisabled'].some(k=>last[k]!==item[k]))list.push(item);
  };
  document.addEventListener('DOMContentLoaded',()=>{
   capture();new MutationObserver(capture).observe(document.documentElement,{subtree:true,childList:true,attributes:true,characterData:true});
  },{once:true});
 });
 const shot=async label=>{const file=`${config.name}-${label}.png`;await page.screenshot({path:`${out}/${file}`});result.screenshots.push(file);};
 const snapshot=()=>page.evaluate(()=>{
  const s=document.getElementById('loading-screen'),p=document.getElementById('loading-progress'),t=document.getElementById('loading-stage');
  return{state:s?.dataset.state,role:p?.getAttribute('role'),min:Number(p?.getAttribute('aria-valuemin')),max:Number(p?.getAttribute('aria-valuemax')),value:Number(p?.getAttribute('aria-valuenow')),completed:Number(p?.dataset.completed),total:Number(p?.dataset.total),stage:t?.textContent?.trim(),stageRole:t?.getAttribute('role'),goDisabled:document.getElementById('go')?.disabled,trace:window.__loadingQaTrace||[]};
 });
 const layout=async label=>{
  const size=await page.locator('#loading-screen').evaluate(el=>{
   const r=el.getBoundingClientRect();
   return{x:r.x,y:r.y,width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth};
  });
  assert.ok(size.x>=-1&&size.y>=-1&&size.x+size.width<=size.viewportWidth+1&&size.y+size.height<=size.viewportHeight+1,`${label}: loading fits viewport`);
  assert.ok(size.scrollWidth<=size.clientWidth+1,`${label}: no horizontal overflow`);
  result.observations.push({label,layout:size});
 };
 const ready=async()=>{
  await page.waitForFunction(()=>window.__gta?.loading&&document.getElementById('loading-screen')?.dataset.state==='ready'&&!document.getElementById('go')?.disabled,null,{timeout:120000});
  const ui=await snapshot(),diagnostics=await page.evaluate(()=>window.__gta.loading());
  assert.equal(ui.role,'progressbar');assert.equal(ui.min,0);assert.equal(ui.max,100);assert.equal(ui.value,100);
  assert.equal(ui.total,runtimeCount);assert.equal(ui.completed,runtimeCount);assert.equal(ui.goDisabled,false);
  assert.equal(diagnostics.total,runtimeCount);assert.equal(diagnostics.completed,runtimeCount);
  const failures=Array.isArray(diagnostics.failed)?diagnostics.failed.length:Number(diagnostics.failed);
  assert.equal(failures,0,'all selected models loaded, no silent fallback success');
  assert.equal(await page.evaluate(()=>window.__gta.assets.length),runtimeCount);
  assert.ok(await page.locator('#go').isVisible(),'real start CTA becomes available');
  assert.equal(ui.stageRole,'status');assert.ok(ui.stage?.length>0);
  assert.ok(diagnostics.profile&&Number.isFinite(diagnostics.profile.textureLimit)&&Number.isFinite(diagnostics.profile.concurrency));
  if(config.mobile){
   assert.equal(diagnostics.profile.mobile,true,'iPhone profile detection');
   assert.ok(diagnostics.maxTextureDimension<=1024,'actual decoded mobile textures respect the cap');
   for(const asset of diagnostics.assetProfiles){const limit=asset.id==='heroi'?1024:512;assert.ok(asset.images.every(image=>image.width<=limit&&image.height<=limit),`${asset.id}: image dimensions within budget`);}
  }
  result.renderer=await page.evaluate(()=>window.__gta.info());
  if(config.recover==='safe'){
   assert.equal(new URL(page.url()).searchParams.get('compat'),'1');assert.equal(new URL(page.url()).searchParams.get('gl'),'1');
   assert.equal(diagnostics.profile.compat,true);assert.equal(diagnostics.profile.concurrency,1);assert.ok(diagnostics.profile.textureLimit<=1024);
   assert.equal(await page.evaluate(()=>window.__gta.backend),'WebGL2');
  }
  result.observations.push({label:'ready',ui,diagnostics});await shot('ready');
  await page.click('#go');await page.waitForFunction(()=>window.__gta.state.phase!=='intro',null,{timeout:15000});
  assert.equal(await page.locator('#start').isVisible(),false);assert.equal(await page.locator('#hud').isVisible(),true);
  await shot('game-started');result.startedGame=true;
  const sampleStarted=Date.now();await page.waitForTimeout(2000);
  result.performance=await page.evaluate(()=>{
   const entries=[...performance.getEntriesByType('navigation'),...performance.getEntriesByType('resource')];
   return{backend:window.__gta.backend,fpsSamples:window.__gta.fpsLog.slice(-2),render:window.__gta.info(),network:{resources:entries.length,transferBytes:entries.reduce((s,e)=>s+(e.transferSize||0),0),encodedBodyBytes:entries.reduce((s,e)=>s+(e.encodedBodySize||0),0),decodedBodyBytes:entries.reduce((s,e)=>s+(e.decodedBodySize||0),0)}};
  });
  result.performance.sampleWindowMs=Date.now()-sampleStarted;
 };
 const heldAsset=async()=>{
  let timer;
  try{return await Promise.race([firstAssetSeen,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('No GLB requested within 60 seconds')),60000);})]);}
  finally{clearTimeout(timer);}
 };
 const loseContext=async()=>{
  const navigationsBefore=result.navigations.length,documentId=await page.evaluate(()=>window.__loadingQaDocumentId);
  contextLossInjected=true;
  result.contextLoss=await page.evaluate(()=>{
   const canvas=document.getElementById('c'),gl=canvas?.getContext('webgl2');
   if(!gl)throw Error('No existing WebGL2 renderer context to lose');
   if(gl.isContextLost())throw Error('Context was already lost before the fixture');
   const extension=gl.getExtension('WEBGL_lose_context');
   window.__loadingQaContextLoss={requestedAt:performance.now(),events:[],extensionAvailable:!!extension};
   canvas.addEventListener('webglcontextlost',event=>window.__loadingQaContextLoss.events.push({at:performance.now(),trusted:event.isTrusted,cancelable:event.cancelable}),{once:true});
   if(extension){extension.loseContext();return{method:'WEBGL_lose_context',actualContextLoss:true,limitation:null};}
   canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));
   return{method:'synthetic-event-fallback',actualContextLoss:false,limitation:'WEBGL_lose_context is unavailable in this engine. This only checks the application recovery handler; it does not demonstrate a real GPU context loss.'};
  });
  await page.waitForFunction(()=>window.__loadingQaContextLoss?.events.length>0&&document.getElementById('loading-screen')?.dataset.state==='error',null,{timeout:15000});
  if(result.contextLoss.actualContextLoss){
   assert.equal(await page.evaluate(()=>document.getElementById('c').getContext('webgl2').isContextLost()),true,'the real renderer context was lost');
  }
  const failed=await snapshot();assert.equal(failed.state,'error');assert.equal(failed.goDisabled,true);assert.ok(failed.value<100);assert.ok(failed.stage?.length>0);
  assert.ok(await page.locator('#start').isVisible());assert.equal(await page.locator('#hud').isVisible(),false);
  for(const button of ['#loading-retry','#loading-safe']){assert.ok(await page.locator(button).isVisible());assert.equal(await page.locator(button).getAttribute('type'),'button');}
  await layout('context-lost');await shot('context-lost');
  const completedBefore=result.completedGlbRequests;
  if(config.contextLoss==='loading')releaseFirst();
  // Allow outstanding real downloads to finish or be cancelled, then leave an additional
  // window for late parsing/renderer continuations. No test code calls ready() or changes UI.
  const drainStarted=Date.now();
  while(activeGlbs.size>0&&Date.now()-drainStarted<15000)await page.waitForTimeout(100);
  assert.equal(activeGlbs.size,0,'outstanding model requests finish or cancel after context loss');
  await page.waitForTimeout(config.contextLoss==='loading'?3000:1200);
  const later=await snapshot();assert.equal(later.state,'error','late work cannot turn a terminal renderer error into ready');assert.equal(later.goDisabled,true);
  const firstError=later.trace.findIndex(item=>item.state==='error');assert.ok(firstError>=0);
  assert.ok(later.trace.slice(firstError).every(item=>item.state==='error'&&item.goDisabled&&item.value<100),'the complete observed post-error trace stays terminal');
  assert.equal(result.navigations.length,navigationsBefore,'context loss must not automatically reload or redirect');
  assert.equal(await page.evaluate(()=>window.__loadingQaDocumentId),documentId,'the same document presents recovery controls');
  result.contextLoss.events=await page.evaluate(()=>window.__loadingQaContextLoss.events);
  result.contextLoss.completedGlbRequestsAfterLoss=result.completedGlbRequests-completedBefore;
  result.contextLoss.outstandingRequests=activeGlbs.size;
  result.contextLoss.noAutomaticReload=true;result.contextLoss.terminalErrorPreserved=true;
  result.observations.push({label:'context-loss-error',beforeLateWork:failed,afterLateWork:later});await shot('context-loss-stable');
  assert.deepEqual(result.httpErrors,[]);
 };
 try{
  const url=new URL(base);if(config.contextLoss)url.searchParams.set('gl','1');
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:90000});
  if(config.contextLoss){
   assert.equal(new URL(page.url()).searchParams.get('gl'),'1');
   if(config.contextLoss==='loading'){
    result.heldAsset=await heldAsset();await page.waitForSelector('#loading-screen',{state:'visible',timeout:10000});
    const before=await snapshot();assert.equal(before.state,'loading');assert.equal(before.goDisabled,true);assert.ok(before.value<100);
    result.observations.push({label:'before-context-loss-loading',ui:before});await shot('before-context-loss');
   }else{
    await ready();assert.equal(await page.evaluate(()=>window.__gta.backend),'WebGL2');
   }
   await loseContext();
  }else if(config.slow){
   // The held response remains an actual unfinished asset; no fabricated percentage/timer.
   result.heldAsset=await heldAsset();
   await page.waitForSelector('#loading-screen',{state:'visible',timeout:10000});
   await page.waitForTimeout(450);const a=await snapshot();
   assert.equal(a.state,'loading');assert.equal(a.role,'progressbar');assert.equal(a.goDisabled,true);assert.ok(a.value>=0&&a.value<100);
   assert.equal(await page.locator('#loading-cross').count(),1);assert.ok(await page.locator('#loading-cross').isVisible());
   assert.ok(await page.locator('.loading-art-label').isVisible(),'concept illustration is identified visibly');
   await page.waitForFunction(()=>{const image=document.querySelector('.loading-art img');return image?.complete&&image.naturalWidth>0;},null,{timeout:15000});
   const art=await page.locator('.loading-art img').evaluate(image=>({loaded:image.complete&&image.naturalWidth>0,width:image.getBoundingClientRect().width,height:image.getBoundingClientRect().height}));
   assert.ok(art.loaded&&art.width>=200&&art.height>=200,'concept artwork has real visible dimensions');
   await layout('initial');await shot('loading');
   const alternate={width:config.width===390?1280:390,height:config.width===390?800:844};
   await page.setViewportSize(alternate);await page.waitForTimeout(120);await layout('resized');await shot('loading-resized');
   await page.setViewportSize({width:config.width,height:config.height});await page.waitForTimeout(900);
   const b=await snapshot();
   assert.equal(b.state,'loading');assert.equal(b.goDisabled,true);assert.ok(b.value<100,'unfinished real GLB cannot be reported as complete');
   assert.ok(Number.isInteger(b.completed)&&b.completed>=0&&b.completed<runtimeCount);
   assert.equal(b.total,runtimeCount);assert.ok(b.completed<=result.completedGlbRequests,'completed parsed resources cannot exceed finished GLB downloads');
   for(const item of b.trace){assert.ok(item.value>=0&&item.value<=100);assert.ok(item.completed>=0&&item.completed<=item.total);if(item.value===100)assert.equal(item.state,'ready');}
   if(config.reducedMotion){
    const animations=await page.evaluate(()=>document.getAnimations().filter(a=>document.getElementById('loading-screen')?.contains(a.effect?.target)).map(a=>({state:a.playState,duration:a.effect?.getComputedTiming().duration,iterations:a.effect?.getComputedTiming().iterations})));
    assert.ok(animations.every(a=>a.state!=='running'||Number(a.duration)<=50),'reduced motion avoids prolonged decorative animation');result.reducedMotion={verified:true,animations};
   }
   result.observations.push({label:'held-resource',before:a,after:b,downloadsCompleted:result.completedGlbRequests});releaseFirst();await ready();
   const profile=result.observations.find(o=>o.label==='ready').diagnostics.profile;
   if(profile.concurrency===1)assert.equal(result.maxConcurrentGlbRequests,1,'sequential profile never starts another GLB while one is outstanding');
   assert.deepEqual(result.httpErrors,[]);assert.deepEqual(result.consoleErrors,[]);
  }else{
   await page.waitForFunction(()=>document.getElementById('loading-screen')?.dataset.state==='error',null,{timeout:120000});
   assert.equal(injected,true,'failure fixture was exercised');const failed=await snapshot();
   assert.ok(failed.value<100);assert.equal(failed.goDisabled,true);assert.ok(failed.stage?.length>0);
   assert.ok(await page.locator('#loading-retry').isVisible());assert.ok(await page.locator('#loading-safe').isVisible());
   assert.equal(await page.locator('#loading-retry').getAttribute('type'),'button');assert.equal(await page.locator('#loading-safe').getAttribute('type'),'button');
   await layout('error');await shot('error');await page.waitForTimeout(600);
   assert.equal((await snapshot()).state,'error','a late asset result cannot erase the terminal error');
   result.observations.push({label:'failed',ui:failed});
   const consoleBefore=result.consoleErrors.length,httpBefore=result.httpErrors.length;
   const button=config.recover==='safe'?'#loading-safe':'#loading-retry';
   await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded',timeout:90000}),page.click(button)]);
   await ready();assert.deepEqual(result.consoleErrors.slice(consoleBefore),[],'retry has no new console errors');assert.deepEqual(result.httpErrors.slice(httpBefore),[],'retry has no new HTTP errors');
   assert.ok(result.httpErrors.some(r=>r.url===result.injectedFailure.url&&r.status===500));result.recoveryVerified=config.recover;
  }
  assert.deepEqual(result.errors,[]);assert.deepEqual(result.crashes,[]);assert.deepEqual(result.blockedWrites,[]);
  result.passed=true;
 }catch(error){result.failure=String(error);await shot('failure').catch(()=>{});result.lastObservation=await snapshot().catch(()=>null);console.error(`${config.name}: ${error}`);}
 finally{releaseFirst();await context.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');}
}
try{for(const config of cases)await run(config);}
finally{await browser.close();report.finishedAt=new Date().toISOString();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({engine:report.engine,out,tests:report.tests.map(({name,passed,failure,recoveryVerified,maxConcurrentGlbRequests,contextLoss})=>({name,passed,failure,recoveryVerified,maxConcurrentGlbRequests,contextLoss}))}));
if(report.tests.some(t=>!t.passed))process.exitCode=1;
