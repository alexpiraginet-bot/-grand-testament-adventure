// R9 browser evidence: approved hero only, no procedural NPCs, encounters remain playable.
// Run only after the build owner releases the single-browser/GPU slot.
// node tools/check_npc_visual.mjs [url] [outdir] --case=chrome-desktop
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {faunaAssetsManifest} from '../src/fauna-assets-manifest.ts';

const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const args=process.argv.slice(2),positionals=args.filter(a=>!a.startsWith('--'));
const base=new URL(positionals[0]||'http://127.0.0.1:4192/');base.searchParams.set('debug','1');
const out=positionals[1]||'shots/npc-quality-r9',filter=args.find(a=>a.startsWith('--case='))?.slice(7);
const roster=JSON.parse(readFileSync(new URL('../src/data/tripo-assets.json',import.meta.url),'utf8'));
const coreCount=Object.values(roster.assets).filter(a=>a.status==='runtime').length;
const heroPath=roster.assets.heroi.file,heroFile=heroPath.split('/').at(-1);
const cases=[
 {name:'chrome-desktop',width:1280,height:800,missions:true,walk:true},
 {name:'chrome-mobile',width:390,height:844,mobile:true,missions:true},
 {name:'webkit-mobile',width:390,height:844,mobile:true,webkit:true},
 {name:'hero-404-retry',width:390,height:844,mobile:true,failHero:true},
].filter(c=>!filter||c.name===filter);
assert.ok(cases.length,'Unknown --case');mkdirSync(out,{recursive:true});
const report={startedAt:new Date().toISOString(),url:base.href,coreCount,heroPath,tests:[],limitations:[
 'Chrome/WebKit execute on Windows; a mobile viewport and iPhone UA do not verify a physical iPhone, Safari memory limit, thermal stability or phone FPS.',
 'Teleports stage the beach and each encounter. Only the recorded keyboard segment is walked; this is not proof of a continuous route through the entire episode.',
 'Human diagnostics inspect visible tagged roots and are combined with screenshots and the CPU transitive-import guard. They are not an automatic classifier of arbitrary untagged scene geometry.',
 'Narrative participant counts remain separate from rendered actors. No character mesh is considered approved merely because its ID appears in mission/save data.',
 'GET/HEAD only: no forms, feedback, payment, repository or deployment writes. Deliberate hero404 errors are listed separately from ordinary runtime errors.',
 'Five-second FPS and Resource Timing are short measurements on this PC. Resource Timing after retry covers only the current document.',
 'No perceptual audio judgement or all-slopes foot-contact claim is made by this harness.',
]};
const save=()=>writeFileSync(`${out}/report${filter?`-${filter}`:''}.json`,JSON.stringify(report,null,2));

for(const c of cases){
 const engine=c.webkit?pw.webkit:pw.chromium;
 if(c.webkit)assert.ok(existsSync(engine.executablePath()),'Use the existing WebKit binary; never install a browser implicitly');
 const browser=await engine.launch(c.webkit?{headless:true}:{headless:true,channel:'chrome'});
 const context=await browser.newContext({viewport:{width:c.width,height:c.height},deviceScaleFactor:1,isMobile:!!c.mobile,hasTouch:!!c.mobile,...(c.mobile?{userAgent:pw.devices['iPhone 13'].userAgent}:{})});
 const page=await context.newPage(),tasks=[];
 const r={name:c.name,passed:false,checks:[],snapshots:[],screenshots:[],pageErrors:[],consoleErrors:[],warnings:[],httpErrors:[],requests:[],requestFailures:[],responses:[],bundles:[],blockedWrites:[],crashes:[]};report.tests.push(r);
 let injected=false,expectedFailureWindow=false;
 page.on('pageerror',e=>r.pageErrors.push({text:String(e),expectedFailureWindow}));
 page.on('crash',()=>r.crashes.push(new Date().toISOString()));
 page.on('console',m=>{if(m.type()==='error')r.consoleErrors.push({text:m.text(),location:m.location(),expectedFailureWindow});if(m.type()==='warning')r.warnings.push(m.text());});
 page.on('request',q=>r.requests.push({url:q.url(),type:q.resourceType(),at:Date.now()}));
 page.on('requestfailed',q=>r.requestFailures.push({url:q.url(),failure:q.failure(),expectedFailureWindow}));
 page.on('response',res=>{
  const intentional=!!c.failHero&&res.status()===404&&new URL(res.url()).pathname.endsWith(`/${heroFile}`);
  if(res.status()>=400)r.httpErrors.push({url:res.url(),status:res.status(),intentional});
  tasks.push(res.allHeaders().then(h=>r.responses.push({url:res.url(),status:res.status(),contentLength:Number(h['content-length'])||0})).catch(e=>r.warnings.push(`Header capture: ${e}`)));
  if(/\/assets\/index-[^/]+\.js$/.test(new URL(res.url()).pathname))tasks.push(res.body().then(body=>r.bundles.push({url:res.url(),bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')})).catch(e=>r.warnings.push(`Bundle capture: ${e}`)));
 });
 await context.route('**/*',route=>{
  const req=route.request();
  if(!['GET','HEAD'].includes(req.method())){r.blockedWrites.push({url:req.url(),method:req.method()});return route.abort();}
  if(c.failHero&&!injected&&new URL(req.url()).pathname.endsWith(`/${heroFile}`)){
   injected=true;expectedFailureWindow=true;r.injectedFailure={url:req.url(),status:404};
   return route.fulfill({status:404,contentType:'text/plain',body:'Intentional R9 hero404; retry receives the real GLB'});
  }
  return route.continue();
 });
 const check=(condition,label)=>{assert.ok(condition,label);r.checks.push(label);};
 const shot=async label=>{const file=`${c.name}-${label}.png`;await page.screenshot({path:`${out}/${file}`});r.screenshots.push(file);};
 const snap=async label=>{
  const value=await page.evaluate(()=>{const g=window.__gta;return{phase:g.state.phase,mission:g.state.mission,time:g.state.time,player:{...g.player.pos},heroSource:g.heroSource,characters:g.characters(),renderedFollowers:g.followers(),npcPositions:g.npcPositions(),narrativeFollowers:g.narrativeFollowers(),fauna:g.fauna(),notice:{visible:!document.getElementById('scene-development').hidden,text:document.getElementById('scene-development').textContent}};});
  r.snapshots.push({label,...value});return value;
 };
 const validateHumans=s=>{
  const d=s.characters;
  assert.equal(d.humans,1,'one actual attached visible human root');assert.equal(d.npcs,0);assert.equal(d.primitiveHumanMeshes,0);
  assert.equal(d.rendered.length,1);const h=d.rendered[0];
  assert.equal(h.id,'heroi');assert.equal(h.role,'hero');assert.equal(h.source,'tripo-r1/hero-native-skeleton');assert.ok(h.skinnedMeshes>0&&h.meshes>=h.skinnedMeshes);
  assert.equal(h.primitiveMeshes,0);assert.deepEqual(h.geometryTypes,['BufferGeometry']);
  assert.deepEqual(d.npcColliders,[]);assert.deepEqual(d.radarFollowers,[]);assert.deepEqual(s.renderedFollowers,[]);assert.deepEqual(s.npcPositions,[]);
 };
 const waitGame=async seconds=>{const target=await page.evaluate(s=>window.__gta.state.time+s,seconds);await page.waitForFunction(t=>window.__gta.state.time>=t,target,{timeout:45000,polling:100});};
 const stage=async (point,heading)=>{await page.evaluate(([x,z,h])=>window.__gta.teleport(x,z,h),[point[0],point[1],heading]);await waitGame(.25);};
 const head=(a,b)=>Math.atan2(b[0]-a[0],-(b[1]-a[1]));
 const act=async()=>{
  if(c.mobile){await page.locator('#act').tap();r.actionInput='actual pointer tap on #act';}
  else{await page.locator('#c').click({position:{x:c.width*.48,y:c.height*.54}});await page.keyboard.press('KeyE');r.actionInput='actual keyboard KeyE';}
 };
 try{
  const start=Date.now();await page.goto(base.href,{waitUntil:'domcontentloaded',timeout:90000});
  if(c.failHero){
   await page.waitForFunction(()=>document.getElementById('loading-screen')?.dataset.state==='error',null,{timeout:120000});
   r.failedOpening=await page.evaluate(()=>({stage:document.getElementById('loading-stage').textContent,goDisabled:document.getElementById('go').disabled,hudHidden:document.getElementById('hud').hidden,debugPublished:!!window.__gta}));
   check(injected&&r.failedOpening.goDisabled&&r.failedOpening.hudHidden&&!r.failedOpening.debugPublished,'hero404 keeps gameplay closed and does not publish a fallback hero');
   check(await page.locator('#loading-retry').isVisible()&&await page.locator('#loading-safe').isVisible(),'hero404 exposes retry and compatible-mode recovery');
   await page.waitForTimeout(2000);
   check(await page.locator('#go').isDisabled()&&await page.locator('#loading-screen').getAttribute('data-state')==='error','late successful assets cannot promote the rejected hero to ready');
   await shot('hero-error');expectedFailureWindow=false;
   await Promise.all([page.waitForEvent('domcontentloaded'),page.locator('#loading-retry').click()]);
  }
  await page.waitForFunction(()=>window.__gta?.loading().state==='ready'&&!document.getElementById('go').disabled,null,{timeout:120000});
  r.readyMs=Date.now()-start;r.loading=await page.evaluate(()=>window.__gta.loading());r.backend=await page.evaluate(()=>window.__gta.backend);
  check(r.loading.completed===coreCount&&r.loading.total===coreCount&&r.loading.failed===0,`all ${coreCount} core GLBs complete before Go`);
  const intro=await snap('intro');validateHumans(intro);
  check(intro.heroSource==='tripo-r1/hero-native-skeleton'&&intro.characters.rendered[0].skinnedMeshes>0,'the visible hero is the native skinned GLB');
  check(intro.fauna.status==='not-started','fauna remains optional and waits for Go');await shot('intro');
  await page.locator('#go').click();await page.waitForFunction(()=>window.__gta.state.phase==='play',null,{timeout:10000});
  await page.waitForFunction(()=>window.__gta.fauna().status==='ready',null,{timeout:75000});
  const expected=faunaAssetsManifest(!!c.mobile);
  await page.waitForFunction(kinds=>kinds.every(kind=>window.__gta.fauna().visible.some(a=>a.kind===kind)),expected.map(a=>a.kind),{timeout:20000});
  const initial=await snap('initial-play');validateHumans(initial);
  check(expected.length===2&&expected.every(a=>initial.fauna.renderer.loadedKinds.includes(a.kind)&&initial.fauna.visible.some(v=>v.kind===a.kind)),'both inherited approved fauna species load and have real visible instances');
  check(initial.fauna.renderer.receivedBytes===expected.reduce((n,a)=>n+a.expectedBytes,0)&&initial.fauna.renderer.failedKinds.length===0,'fauna profile bytes and decoding match the reviewed assets');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'viewport has no horizontal overflow');
  await shot('initial-play');
  r.performance=await page.evaluate(async()=>{const g=window.__gta,first=g.fpsLog.length,start=performance.now();let frames=0;await new Promise(resolve=>{function next(now){frames++;if(now-start>=5000)resolve();else requestAnimationFrame(next);}requestAnimationFrame(next);});return{elapsedMs:performance.now()-start,rafFrames:frames,rendererFPSSamples:g.fpsLog.slice(first),renderer:g.info(),fauna:g.fauna()};});
  const P=await page.evaluate(()=>window.__gta.meta.points);
  if(c.missions){
   await stage([P.beach[0]+(P.start[0]-P.beach[0])*.03,P.beach[1]+(P.start[1]-P.beach[1])*.03],head(P.start,P.beach));
   await page.waitForFunction(()=>window.__gta.state.mission===1,null,{timeout:10000});
   check((await snap('beach')).mission===1,'reaching the beach advances mission one');await shot('beach');
   r.colliderProbe=await page.evaluate(()=>{
    const g=window.__gta,probes=[];
    for(const n of g.narrativeLocations().filter(n=>!n.inBoat))for(let i=0;i<17;i++){
     const angle=i*Math.PI/8,r=i===16?0:.5,x=n.pos.x+Math.sin(angle)*r,z=n.pos.z+Math.cos(angle)*r;
     probes.push({id:n.id,x,z,withPeople:g.blocked(x,z,true),staticOnly:g.blocked(x,z,false)});
    }return probes;
   });
   check(r.colliderProbe.length>0&&r.colliderProbe.every(p=>p.withPeople===p.staticOnly),'old shore participant positions have no extra invisible-human collision');
   if(c.walk){
    r.walk=await page.evaluate(()=>{
     const g=window.__gta;
     for(const n of g.narrativeLocations().filter(n=>!n.inBoat))for(let k=0;k<12;k++){
      const h=k*Math.PI/6,dx=Math.sin(h),dz=-Math.cos(h),points=Array.from({length:33},(_,i)=>({x:n.pos.x+dx*(i/32*3.2-1.6),z:n.pos.z+dz*(i/32*3.2-1.6)}));
      if(points.every(p=>!g.blocked(p.x,p.z,false))){g.teleport(points[0].x,points[0].z,h);return{id:n.id,centre:n.pos,heading:h,dx,dz,start:points[0],target:points.at(-1),samples:[]};}
     }return null;
    });
    check(!!r.walk,'a clear keyboard test segment crosses a former NPC centre');
    await page.locator('#c').click({position:{x:c.width*.48,y:c.height*.54}});await page.keyboard.down('KeyW');
    try{for(let i=0;i<65;i++){await page.waitForTimeout(100);const p=await page.evaluate(()=>({...window.__gta.player.pos,time:window.__gta.state.time}));r.walk.samples.push(p);if((p.x-r.walk.start.x)*r.walk.dx+(p.z-r.walk.start.z)*r.walk.dz>=3.1)break;}}
    finally{await page.keyboard.up('KeyW');}
    const last=r.walk.samples.at(-1),progress=(last.x-r.walk.start.x)*r.walk.dx+(last.z-r.walk.start.z)*r.walk.dz;
    r.walk.minCentreDistance=Math.min(...r.walk.samples.map(p=>Math.hypot(p.x-r.walk.centre.x,p.z-r.walk.centre.z)));r.walk.progress=progress;
    check(r.walk.samples.length>=5&&progress>=3.0&&r.walk.minCentreDistance<.25,'real W movement passes through a former NPC centre with intermediate samples');await shot('walk-through-former-npc');
   }
   const nearS=[P.simao[0]+(P.beach[0]-P.simao[0])*.015,P.simao[1]+(P.beach[1]-P.simao[1])*.015];
   const nearB=[P.barco_margem[0]+(P.simao[0]-P.barco_margem[0])*.03,P.barco_margem[1]+(P.simao[1]-P.barco_margem[1])*.03];
   for(const encounter of [{mission:1,name:'simao-andre',point:nearS,facing:head(P.beach,P.simao),count:2},{mission:2,name:'tiago-joao',point:nearB,facing:head(P.simao,P.barco_margem),count:4}]){
    await stage(encounter.point,encounter.facing);await page.waitForFunction(m=>window.__gta.state.mission===m&&window.__gta.state.promptVisible,encounter.mission,{timeout:10000});
    // Staging can outrun the previous mission's normal completion flash; wait for the live HUD before its capture.
    await page.waitForFunction(m=>document.getElementById('mk').textContent===`MISSÃO ${m+1} DE ${window.__gta.goals.length}`,encounter.mission,{timeout:10000});
    const before=await snap(`${encounter.name}-prompt`);validateHumans(before);
    check(before.notice.visible&&/Cena em desenvolvimento/.test(before.notice.text),`${encounter.name}: missing character scene is visibly disclosed`);
    await shot(`${encounter.name}-prompt`);await act();
    await page.waitForFunction(()=>window.__gta.state.phase==='line',null,{timeout:10000});await waitGame(.4);
    const line=await snap(`${encounter.name}-line`);validateHumans(line);
    check(line.narrativeFollowers.length===encounter.count&&line.renderedFollowers.length===0,`${encounter.name}: narrative progression never instantiates unapproved followers`);
    check(await page.locator('#subt').textContent()===await page.evaluate(()=>`“${window.__gta.state.line.texto}”`)&&/^BÍBLIA LIVRE · /.test(await page.locator('#subr').textContent()),`${encounter.name}: quotation remains literal and attributed separately`);
    check(!await page.locator('#journey').isVisible(),`${encounter.name}: editorial hint yields to the biblical line`);await shot(`${encounter.name}-line`);
    await page.waitForFunction(()=>window.__gta.state.phase!=='line',null,{timeout:45000});
   }
   await page.locator('#end').waitFor({state:'visible',timeout:10000});const finished=await snap('completed');validateHumans(finished);
   check(finished.phase==='done'&&finished.narrativeFollowers.length===4&&finished.characters.npcs===0,'the complete three-mission episode works with zero rendered NPCs');await shot('completed');
  }else if(!c.failHero){
   await stage([P.beach[0],P.beach[1]],head(P.start,P.beach));await page.waitForFunction(()=>window.__gta.state.mission===1,null,{timeout:10000});
   await stage([P.simao[0],P.simao[1]],head(P.beach,P.simao));await page.waitForFunction(()=>window.__gta.state.promptVisible,null,{timeout:10000});
   const cue=await snap('encounter-smoke');validateHumans(cue);check(cue.notice.visible&&await page.locator('#act').isVisible(),'WebKit encounter exposes disclosure and the real touch action');await shot('encounter-smoke');
  }
  const final=await snap('final');validateHumans(final);check(true,'every sampled stage retains one skinned hero, no primitive humans, NPCs, NPC colliders or follower radar marks');
  await Promise.all(tasks);r.resourceTiming=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>({name:e.name,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,duration:e.duration})));
  r.bytes={responseHeaderBytes:r.responses.reduce((n,x)=>n+x.contentLength,0),resourceEncodedBytes:r.resourceTiming.reduce((n,x)=>n+x.encodedBodySize,0)};
  check(r.pageErrors.length===0&&r.crashes.length===0,'no captured page exception or crash');check(r.httpErrors.every(e=>e.intentional),'no unexpected HTTP errors');check(r.consoleErrors.every(e=>c.failHero&&e.expectedFailureWindow),'no console errors outside the deliberate hero failure window');check(r.blockedWrites.length===0,'no external write attempted');
  r.passed=true;
 }catch(error){r.failure=String(error.stack||error);try{await snap('failure');}catch{}try{await shot('failure');}catch{}}
 finally{await context.close();await browser.close();r.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({name:r.name,passed:r.passed,checks:r.checks.length,failure:r.failure,bytes:r.bytes}));}
}
report.finishedAt=new Date().toISOString();report.passed=report.tests.every(t=>t.passed);save();if(!report.passed)process.exitCode=1;
