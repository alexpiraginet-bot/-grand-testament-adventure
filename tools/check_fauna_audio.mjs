// Serial, real-browser QA. Never posts feedback, changes accounts, or publishes.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const out=process.argv[3]||'shots/fauna-r8-current',base=new URL(process.argv[2]||'http://127.0.0.1:4191/');base.searchParams.set('debug','1');
const filter=process.argv.find(a=>a.startsWith('--case='))?.slice(7);
const recordings=JSON.parse(readFileSync(new URL('../public/audio/fauna/SOURCES.json',import.meta.url),'utf8')).assets.map(a=>({id:a.id,sha256:a.sha256}));
mkdirSync(out,{recursive:true});
const report={startedAt:new Date().toISOString(),url:base.href,tests:[],limits:[
 'Chrome and Playwright WebKit run on Windows. Mobile uses viewport, touch and iPhone UA; not a physical iPhone/Safari memory test.',
 'Debug teleport stages acoustic habitats; no claim of a continuous walking route or mission completion.',
 'Visibility is simulated with document.hidden/visibilityState plus visibilitychange, explicitly not an OS background/process-kill test.',
 'Audio evidence is real AudioContext state, decoded buffer/cache and scheduled source counters. No perceptual listening/mix approval.',
 'FPS is a controlled five-second window, not a sustained thermal or device benchmark.',
 'Only GET/HEAD requests permitted; no feedback form is submitted.'
]};
const cases=[{name:'chrome-desktop',width:1280,height:800},{name:'chrome-mobile',width:390,height:844,mobile:true},{name:'webkit-mobile',width:390,height:844,mobile:true,webkit:true},{name:'chrome-audio-404',width:390,height:844,mobile:true,failAudio:true}].filter(c=>!filter||c.name===filter);
assert.ok(cases.length,'unknown case');
const persist=()=>writeFileSync(`${out}/report${filter?`-${filter}`:''}.json`,JSON.stringify(report,null,2));
for(const config of cases){
 const engine=config.webkit?pw.webkit:pw.chromium;
 if(config.webkit)assert.ok(existsSync(engine.executablePath()),'existing WebKit binary required');
 const browser=await engine.launch(config.webkit?{headless:true}:{headless:true,channel:'chrome'});
 const context=await browser.newContext({viewport:{width:config.width,height:config.height},deviceScaleFactor:1,hasTouch:!!config.mobile,isMobile:!!config.mobile,...(config.mobile?{userAgent:pw.devices['iPhone 13'].userAgent}:{})});
 await context.addInitScript(recordings=>{
  const AC=window.AudioContext||window.webkitAudioContext;
  window.__faunaAudioQA={started:[],decoded:[],instrumented:!!AC};if(!AC)return;
  // Instrument only the browser API boundary: native decode/start still run. No fabricated game counters.
  const info=new WeakMap(),decode=AC.prototype.decodeAudioData,create=AC.prototype.createBufferSource;
  AC.prototype.decodeAudioData=function(bytes,...args){
   const copy=bytes.slice(0),digest=crypto.subtle.digest('SHA-256',copy).then(hash=>Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''));
   const result=decode.call(this,bytes,...args);
   if(!result?.then)return result;
   return Promise.all([result,digest]).then(([buffer,hash])=>{const recording=recordings.find(r=>r.sha256===hash),entry={kind:recording?.id??'unidentified',sha256:hash,duration:buffer.duration,channels:buffer.numberOfChannels,sampleRate:buffer.sampleRate};info.set(buffer,entry);window.__faunaAudioQA.decoded.push(entry);return buffer;});
  };
  AC.prototype.createBufferSource=function(){
   const source=create.call(this),start=source.start;
   source.start=function(...args){const entry=info.get(source.buffer),result=start.apply(this,args);window.__faunaAudioQA.started.push({at:performance.now(),...entry,visibleAnimals:window.__gta?.fauna?.().visible??[],player:window.__gta?{...window.__gta.player.pos}:null});return result;};return source;
  };
 },recordings);
 const page=await context.newPage();
 const r={name:config.name,passed:false,startedAt:new Date().toISOString(),checks:[],observations:[],screenshots:[],pageErrors:[],consoleErrors:[],warnings:[],crashes:[],httpErrors:[],requests:[],responses:[],requestFailures:[],blockedWrites:[]};report.tests.push(r);
 const pendingResponses=[];
 const isAudio=url=>/\/audio\/fauna\/[^/]+\.mp3(?:\?|$)/.test(url);
 const failsAudio=url=>!!config.failAudio&&/\/audio\/fauna\/birds\.mp3(?:\?|$)/.test(url);
 page.on('pageerror',e=>r.pageErrors.push(String(e)));
 page.on('crash',()=>r.crashes.push(new Date().toISOString()));
 page.on('console',m=>{if(m.type()==='error')r.consoleErrors.push({text:m.text(),location:m.location()});else if(m.type()==='warning')r.warnings.push(m.text());});
 page.on('request',q=>r.requests.push({url:q.url(),method:q.method(),type:q.resourceType(),at:Date.now()}));
 page.on('requestfailed',q=>r.requestFailures.push({url:q.url(),failure:q.failure(),at:Date.now()}));
 page.on('response',response=>{
  if(response.status()>=400)r.httpErrors.push({url:response.url(),status:response.status(),intentional:failsAudio(response.url())});
  pendingResponses.push(response.allHeaders().then(h=>r.responses.push({url:response.url(),status:response.status(),contentLength:Number(h['content-length'])||null,contentType:h['content-type']||null})).catch(error=>r.observations.push({responseCaptureError:String(error)})));
 });
 await context.route('**/*',route=>{
  if(!['GET','HEAD'].includes(route.request().method())){r.blockedWrites.push({url:route.request().url(),method:route.request().method()});return route.abort();}
  if(failsAudio(route.request().url()))return route.fulfill({status:404,contentType:'text/plain',body:'intentional audio QA 404'});
  return route.continue();
 });
 const check=(ok,label)=>{assert.ok(ok,label);r.checks.push(label);};
 const snap=async label=>{const data=await page.evaluate(()=>({audio:window.__gta.audio(),fauna:window.__gta.fauna?.()}));r.observations.push({label,...data});return data.audio;};
 const shot=async label=>{const file=`${config.name}-${label}.png`;await page.screenshot({path:`${out}/${file}`});r.screenshots.push(file);};
 const stage=async kind=>{
  const h=await page.evaluate(kind=>{const g=window.__gta,hs=g.audio().habitats.filter(h=>h.kind===kind);if(!hs.length)throw Error('No '+kind+' habitats');const p=hs.slice().sort((a,b)=>Math.hypot(a.x-g.player.pos.x,a.z-g.player.pos.z)-Math.hypot(b.x-g.player.pos.x,b.z-g.player.pos.z))[0];g.teleport(p.x,p.z);return p;},kind);
  r.observations.push({label:'debug-acoustic-staging',habitat:h});
 };
 const waitAudio=async predicate=>page.waitForFunction(predicate,null,{timeout:45000,polling:150});
 try {
  const initialAt=Date.now();await page.goto(base.href,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__gta?.loading().state==='ready'&&!document.getElementById('go').disabled,null,{timeout:120000});
  r.readyMs=Date.now()-initialAt;r.loading=await page.evaluate(()=>window.__gta.loading());r.backend=await page.evaluate(()=>window.__gta.backend);
  check(r.loading.completed===14&&r.loading.total===14&&r.loading.failed===0,'initial loading complete: 14/14 real assets');
  check((await snap('intro')).contextState==='not-created','no AudioContext before Go');
  check(!r.requests.some(q=>isAudio(q.url)),'no MP3 request before Go');
  check(await page.locator('#loading-screen').getAttribute('data-state')==='ready','premium opening remains ready');
  await shot('intro');
  await page.locator('#go').click();await page.waitForFunction(()=>window.__gta.state.phase==='play',null,{timeout:10000});
  const available=await page.evaluate(()=>window.__gta.audio().available);
  r.audioStatus=available?'supported-awaiting-test':'unavailable';
  if(available)await waitAudio(()=>window.__gta.audio().contextState==='running');
  const emitters=await page.evaluate(()=>({count:window.__gta.audio().visibleAnimalEmitters,visible:window.__gta.fauna?.().visible??[]}));
  check(emitters.count===emitters.visible.filter(a=>a.kind!=='fish').length,'animal emitters correspond to approved scene-visible animals');
  const layout=await page.locator('.hud-links').evaluate(el=>{const b=el.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,viewportWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth,buttons:[...el.querySelectorAll('button')].map(e=>({id:e.id,text:e.textContent,rect:{x:e.getBoundingClientRect().x,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}}))};});
  r.observations.push({label:'HUD-layout',layout});check(layout.x>=-1&&layout.x+layout.width<=config.width+1&&layout.scrollWidth<=config.width+1,'HUD controls fit viewport');
  if(!available){
   check(config.webkit&&!config.failAudio,'only the known Windows WebKit capability case may omit Web Audio');
   check(await page.locator('#soundbtn').isDisabled(),'unavailable audio control is disabled');
   check((await page.locator('#soundbtn').innerText()).includes('Som indisponível'),'unavailable audio is honestly labelled');
   check(!r.requests.some(q=>isAudio(q.url)),'unavailable Web Audio downloads no MP3');
   const before=await page.evaluate(()=>window.__gta.state.time);await page.waitForTimeout(1000);
   check(await page.evaluate(t=>window.__gta.state.time>t,before),'gameplay continues without Web Audio');
   for(const panel of [{open:'#credbtn',close:'#credclose',dialog:'#credits'},{open:'#mapbtn',close:'#worldmap-close',dialog:'#worldmap'},{open:'#hud [data-feedback-open]',close:'#feedback-close',dialog:'#feedback'}]){
    await page.locator(panel.open).click();await page.locator(panel.dialog).waitFor({state:'visible'});
    const pausedAt=await page.evaluate(()=>window.__gta.state.time);await page.waitForTimeout(200);
    if(panel.dialog!=='#credits')check(await page.evaluate(t=>window.__gta.state.time===t,pausedAt),`${panel.dialog} pauses gameplay without Web Audio`);
    await page.locator(panel.close).click();await page.locator(panel.dialog).waitFor({state:'hidden'});
   }
   r.observations.push({label:'capability-limit',note:'AudioContext/webkitAudioContext unavailable in this Windows WebKit runtime. No audio playback/mute/restore claims; physical Safari not tested.'});
   await snap('audio-unavailable');await shot('audio-unavailable');
  }else{
  check(await page.locator('#soundbtn').getAttribute('aria-pressed')==='true','sound starts enabled and accessible');
  await stage('birds');
  if(config.failAudio){
   await waitAudio(()=>window.__gta.audio().nature.failedClips.includes('birds'));
   const firstCount=r.requests.filter(q=>failsAudio(q.url)).length,beforeTime=await page.evaluate(()=>window.__gta.state.time);
   await page.waitForTimeout(6500);
   check(firstCount===1&&r.requests.filter(q=>failsAudio(q.url)).length===firstCount,'audio 404 does not cause a retry loop');
   check(await page.evaluate(t=>window.__gta.state.time>t+1,beforeTime),'game time continues after optional audio 404');
   check(!(await page.locator('#start').isVisible()),'audio 404 does not reopen or block start');
   await snap('404-tolerated');await shot('404-game-continues');
  }else{
   await waitAudio(()=>window.__faunaAudioQA.started.some(s=>s.kind==='birds'));
   check(r.requests.some(q=>q.url.endsWith('/birds.mp3')),'birds loaded near actual tree habitat');
   await snap('birds-playing');await shot('birds-playing');
   await stage('lake');
   await waitAudio(()=>window.__faunaAudioQA.started.some(s=>s.kind==='lake'));
   check(r.requests.some(q=>q.url.endsWith('/lake.mp3')),'lake recording loaded near mapped shore');
   await snap('lake-playing');await shot('lake-playing');
   const loadedKinds=await page.evaluate(()=>window.__gta.fauna?.().renderer?.loadedKinds??[]);
   check(r.requests.filter(q=>/\/(donkey|chicken|sheep)\.mp3$/.test(q.url)).every(q=>loadedKinds.includes(q.url.match(/\/([^/]+)\.mp3$/)[1])),'animal audio requires a loaded approved species');
   for(const kind of loadedKinds.filter(kind=>['chicken','donkey','sheep','goat'].includes(kind))){
    if(!await page.evaluate(kind=>window.__faunaAudioQA.started.some(s=>s.kind===kind),kind)){
     const staged=await page.evaluate(kind=>{const g=window.__gta,a=g.fauna().visible.find(a=>a.kind===kind);if(!a)return null;for(let i=0;i<12;i++){const angle=i*Math.PI/6,x=a.x+Math.sin(angle)*3,z=a.z+Math.cos(angle)*3;if(!g.blocked(x,z,false)){g.teleport(x,z,Math.atan2(a.x-x,-(a.z-z)));return{id:a.id,x,z};}}return null;},kind);
     check(!!staged,`a real ${kind} can stage its recording`);r.observations.push({label:`animal-audio-staging-${kind}`,staged});
     await page.waitForFunction(kind=>window.__faunaAudioQA.started.some(s=>s.kind===kind),kind,{timeout:45000,polling:150});
    }
    const proof=await page.evaluate(kind=>window.__faunaAudioQA.started.filter(s=>s.kind===kind),kind);
    check(proof.length>0&&proof.every(p=>p.visibleAnimals.some(a=>a.kind===kind)),`${kind} recording is hash-identified and starts with its approved visible species`);
    await shot(`recording-${kind}`);
   }
   r.performance=await page.evaluate(async()=>{const g=window.__gta,first=g.fpsLog.length,start=performance.now();let frames=0;await new Promise(resolve=>{const frame=now=>{frames++;if(now-start>=5000)resolve();else requestAnimationFrame(frame);};requestAnimationFrame(frame);});const elapsed=(performance.now()-start)/1000;return{windowSeconds:elapsed,rafFrames:frames,rafFPS:frames/elapsed,rendererFPSSamples:g.fpsLog.slice(first),renderer:g.info(),audio:g.audio()};});
   await page.locator('#soundbtn').click();let muted=await snap('muted');const mutedStarted=muted.nature.startedVoices;
   check(muted.muted&&muted.nature.voices===0&&!muted.nature.enabled,'mute stops active voices');
   check(await page.locator('#soundbtn').getAttribute('aria-pressed')==='false','mute changes aria-pressed');
   check(await page.evaluate(()=>localStorage.getItem('gta:audio-muted'))==='1','mute preference persisted locally');
   await page.waitForTimeout(800);check((await snap('still-muted')).nature.startedVoices===mutedStarted,'mute schedules no new sounds');await shot('muted');
   await page.locator('#soundbtn').click();check(!(await snap('unmuted')).muted,'unmute applies');
   const panels=[{name:'credits',open:'#credbtn',close:'#credclose',dialog:'#credits'},{name:'map',open:'#mapbtn',close:'#worldmap-close',dialog:'#worldmap'},{name:'feedback',open:'#hud [data-feedback-open]',close:'#feedback-close',dialog:'#feedback'}];
   for(const panel of panels){
    await page.locator(panel.open).click();await page.locator(panel.dialog).waitFor({state:'visible'});
    const paused=await snap(`${panel.name}-open`);check(paused.paused&&!paused.nature.enabled&&paused.nature.voices===0,`${panel.name} pauses and silences voices`);
    if(panel.name==='credits'){check(await page.locator('#credbody a[href*="freesound.org/people/"]').count()===5,'credits retain five primary recording sources');await shot('credits');await page.getByRole('heading',{name:'Gravações de natureza'}).scrollIntoViewIfNeeded();await shot('credits-audio');}
    await page.locator(panel.close).click();await page.locator(panel.dialog).waitFor({state:'hidden'});
    await page.waitForTimeout(100);check((await snap(`${panel.name}-closed`)).nature.enabled,`${panel.name} close reenables optional audio`);
   }
   await page.evaluate(()=>{const hidden=Object.getOwnPropertyDescriptor(document,'hidden'),visibility=Object.getOwnPropertyDescriptor(document,'visibilityState');window.__restoreFaunaVisibility=()=>{if(hidden)Object.defineProperty(document,'hidden',hidden);else delete document.hidden;if(visibility)Object.defineProperty(document,'visibilityState',visibility);else delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));};Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
   const hidden=await snap('synthetic-hidden');check(hidden.paused&&!hidden.nature.visible&&hidden.nature.voices===0,'visibility handler stops sound when hidden');
   const hiddenTime=await page.evaluate(()=>window.__gta.state.time);await page.waitForTimeout(600);check(await page.evaluate(t=>window.__gta.state.time===t,hiddenTime),'hidden handler also freezes game time');
   await page.evaluate(()=>window.__restoreFaunaVisibility());
   if(config.mobile)await page.touchscreen.tap(200,250);else await page.mouse.click(200,250);
   await waitAudio(()=>window.__gta.audio().contextState==='running'&&window.__gta.audio().nature.enabled&&window.__gta.audio().nature.visible);
   check(true,'restored visibility plus real user gesture returns running audio');
   // Wait for a genuinely scheduled source after silence, respecting natural clip cooldown.
   const afterHide=(await snap('visible-restored')).nature.startedVoices;
   await page.waitForFunction(n=>window.__gta.audio().nature.startedVoices>n,afterHide,{timeout:45000,polling:200});
   check(true,'a real source starts again after pause/hidden recovery');await shot('resumed');
  }
  r.audioStatus=config.failAudio?'failure-recovery-passed':'playback-controls-passed';
  }
  r.audioProof=await page.evaluate(()=>window.__faunaAudioQA);
  r.resourceTiming=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>({name:e.name,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize,duration:e.duration,initiatorType:e.initiatorType})));
  await Promise.all(pendingResponses);
  r.byteSummary={headerContentLengthTotal:r.responses.reduce((n,x)=>n+(x.contentLength||0),0),audioHeaderBytes:r.responses.filter(x=>isAudio(x.url)&&x.status<400).reduce((n,x)=>n+(x.contentLength||0),0),resourceTransferBytes:r.resourceTiming.reduce((n,x)=>n+x.transferSize,0),resourceEncodedBytes:r.resourceTiming.reduce((n,x)=>n+x.encodedBodySize,0)};
  check(r.pageErrors.length===0,'no captured page exceptions');check(r.crashes.length===0,'no captured page crash');check(r.blockedWrites.length===0,'no write requests attempted');
  check(r.httpErrors.every(e=>e.intentional),'no unexpected HTTP failures');
  check(r.consoleErrors.every(e=>config.failAudio&&(/404/.test(e.text)||isAudio(e.location?.url||''))),'no unexpected console errors');
  r.passed=true;
 }catch(error){r.failure=String(error.stack||error);try{await snap('failure');await shot('failure');}catch{} }
 finally{r.finishedAt=new Date().toISOString();await context.close();await browser.close();persist();console.log(JSON.stringify({name:r.name,passed:r.passed,checks:r.checks.length,failure:r.failure,readyMs:r.readyMs,bytes:r.byteSummary,fps:r.performance?.rendererFPSSamples}));}
}
report.finishedAt=new Date().toISOString();report.passed=report.tests.every(t=>t.passed);persist();if(!report.passed)process.exitCode=1;
