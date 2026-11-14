// R13: matched real-runtime views, then a separate short real-input/RAF check.
// No source/build mutation; one installed Chrome process at a time.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const args=process.argv.slice(2),pos=args.filter(a=>!a.startsWith('--'));
const opt=(key,fallback='')=>args.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3)??fallback;
const base=new URL(pos[0]||'http://127.0.0.1:4201/'),out=path.resolve(pos[1]||'shots/cafarnaum-r13');
const sourceRoot=path.resolve(opt('source-root',path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i,'$1')),'..')));
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const hash=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(readFileSync(path.join(sourceRoot,p),'utf8'));
const fileHash=p=>hash(readFileSync(path.join(sourceRoot,p)));
assert.ok(!existsSync(out),'Preserve evidence: output directory must be new');mkdirSync(out,{recursive:true});
writeFileSync(path.join(out,'HARNESS.mjs'),readFileSync(new URL(import.meta.url)));
const expectedSha=opt('expected-sha'),fixturePath=opt('fixture');
const waterWip=args.includes('--water-wip');
const traceRoot=opt('trace-source-root');
function sourceTrace(){
 if(!traceRoot)return null;
 const files=[];const visit=d=>{for(const e of readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())visit(f);else if(/\.(ts|css|json)$/.test(e.name))files.push({file:path.relative(traceRoot,f).replaceAll('\\','/'),sha256:hash(readFileSync(f))});}};
 visit(path.join(traceRoot,'src'));for(const file of ['index.html','package.json','package-lock.json','vite.config.ts']){const f=path.join(traceRoot,file);if(existsSync(f))files.push({file,sha256:hash(readFileSync(f))});}
 files.sort((a,b)=>a.file.localeCompare(b.file));return{at:new Date().toISOString(),root:traceRoot,sha256:hash(JSON.stringify(files)),files};
}
const core=read('src/data/tripo-assets.json'),coreCount=Object.values(core.assets).filter(a=>a.status==='runtime').length;
const npcCatalog=read('src/data/npc-assets.json');
const heading=(a,b)=>Math.atan2(b.x-a.x,-(b.z-a.z));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
let fixture;
if(fixturePath) fixture=JSON.parse(readFileSync(fixturePath,'utf8'));
else{
 const {Terrain,decodeHeights}=await import(pathToFileURL(path.join(sourceRoot,'src/terrain.ts')));
 const {missionRoutes,settlementLayout}=await import(pathToFileURL(path.join(sourceRoot,'src/world-layout.ts')));
 const meta=read('public/world/cafarnaum.json'),terrain=new Terrain(meta,decodeHeights(read('public/world/cafarnaum-heights.json')));
 const routes=missionRoutes(terrain),plans=settlementLayout(terrain,routes);
 const end=routes.findIndex(s=>Math.hypot(s.bx-meta.points.beach[0],s.bz-meta.points.beach[1])<.01),lane=routes.slice(0,end+1);
 assert.ok(end>=0);const lengths=lane.map(s=>Math.hypot(s.bx-s.ax,s.bz-s.az)),total=lengths.reduce((a,b)=>a+b,0);
 const along=distance=>{let d=distance,i=0;while(i<lane.length-1&&d>lengths[i])d-=lengths[i++];const s=lane[i],u=d/lengths[i];return{x:s.ax+(s.bx-s.ax)*u,z:s.az+(s.bz-s.az)*u,yaw:heading({x:s.ax,z:s.az},{x:s.bx,z:s.bz})};};
 const closest=b=>lane.map(s=>{const dx=s.bx-s.ax,dz=s.bz-s.az,u=Math.max(0,Math.min(1,((b.x-s.ax)*dx+(b.z-s.az)*dz)/(dx*dx+dz*dz)));return{x:s.ax+u*dx,z:s.az+u*dz};}).sort((a,c)=>distance(a,b)-distance(c,b))[0];
 const facade=variant=>{const b=plans.filter(p=>p.variant===variant).sort((a,b)=>distance(a,along(25))-distance(b,along(25)))[0];assert.ok(b);const p=closest(b);return{id:`facade-${'abc'[variant]}`,...p,yaw:heading(p,b),pitch:.04,dist:3.2,house:b,derivation:'Closest lane point to a baseline house of this variant near metre 25; faces the house'};};
 fixture={schema:1,sourceRoot,metaSha:fileHash('public/world/cafarnaum.json'),terrainSha:fileHash('public/world/cafarnaum-heights.json'),routes,
  fixedQuery:{debug:'1',dtmax:'0',cam:'fixa',fx:'off'},simulationTime:0,deviceScaleFactor:1,
  profiles:[{id:'desktop',width:1280,height:800,pitch:.2,dist:4.4},{id:'mobile',width:390,height:844,pitch:.2,dist:5.2,mobile:true}],
  views:[{id:'start',...along(0),derivation:'First mission route point'},facade(0),{id:'street',...along(45),derivation:'45 metres along baseline village route'},
   {id:'middle',...along(85),derivation:'85 metres along baseline village route'},
   {id:'beach',...along(total-3),derivation:'Three metres before baseline beach point'},
   {id:'simao',deriveNpc:true,derivation:'Player two metres behind unchanged NPC, camera in front; baseline actual dry NPC point pinned once'},facade(1),facade(2)],
  intendedComparison:'Same geography, requested viewpoints, viewport/DPR, backend and FX off. Lighting/art changes are the treatment. Actual camera collision offsets are observed.',
 };
}
assert.equal(fixture.metaSha,fileHash('public/world/cafarnaum.json'));assert.equal(fixture.terrainSha,fileHash('public/world/cafarnaum-heights.json'));
const saveFixture=()=>writeFileSync(path.join(out,'scenario.json'),JSON.stringify(fixture,null,2));saveFixture();
const report={schema:1,startedAt:new Date().toISOString(),url:base.href,sourceRoot,expectedSha,waterWip,sourceBefore:sourceTrace(),fixtureSource:fixturePath||'derived once from baseline routes, house lots and actual NPC',runs:[],limits:[
 'Fixed captures are diagnostic staging with dtmax=0 and cam=fixa: story, animation, boat and water time remain zero. Native wall clock is never changed. Views are not a walked journey.',
 'The separate live run uses normal dt and real W input. Only that short segment is a continuous walkthrough. No screenshots are taken inside the native RAF measurement window.',
 'Mobile is Chrome with iPhone UA/touch viewport on this Windows PC, DPR1; this is neither physical Safari nor phone performance.',
 'Actual camera positions are recorded because new geometry could affect obstruction. A matched requested pose alone is insufficient for a pixel-causal comparison.',
 'Lighting and authored materials may intentionally differ; this is visual direction A/B, not an isolated shader performance experiment.',
 'Resource Timing bytes include optional assets and headers; renderer texture bytes are estimates, not process or dedicated VRAM readings.',
 'Network writes are blocked; analytics script is stubbed. No forms, purchases, new generation, commits or deployments.'
]};
if(waterWip)report.limits.push('WIP water-only dev-source inspection, not final integrated build. Only beach/Simão fixed views and a 200-RAF real W segment. No performance claim.');
const save=()=>writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const profiles=fixture.profiles.filter(p=>!opt('profile')||p.id===opt('profile'));assert.ok(profiles.length);
const modes=args.includes('--fixed-only')?['fixed']:args.includes('--live-only')?['live']:['fixed','live'];

for(const profile of profiles)for(const mode of modes){
 const id=`${profile.id}-${mode}`,dir=path.join(out,id);mkdirSync(dir);
 const r={id,profile,mode,startedAt:new Date().toISOString(),passed:false,checks:[],views:[],screenshots:[],pageErrors:[],consoleErrors:[],warnings:[],httpErrors:[],requestFailures:[],blockedWrites:[],analyticsSuppressed:[],bundles:[],requests:[]};report.runs.push(r);save();
 let browser,context,page;const tasks=[];
 const check=(value,name)=>{assert.ok(value,name);r.checks.push(name);save();};
 const snapshot=()=>page.evaluate(()=>{const g=__gta,c=document.getElementById('c');return{time:g.state.time,phase:g.state.phase,mission:g.state.mission,backend:g.backend,quality:g.quality,
  loading:g.loading(),player:structuredClone(g.player),cam:{...g.cam},camera:g.camera(),characters:g.characters(),npc:g.npc(),fauna:g.fauna(),render:g.info(),world:g.world,worldQuality:g.worldQuality(),
  dimensions:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,canvasWidth:c.width,canvasHeight:c.height},audio:g.audio()};});
 const stage=async p=>{await page.evaluate(({p,v})=>{const g=__gta;g.teleport(p.x,p.z,p.yaw);g.cam.pitch=p.pitch??v.pitch;g.cam.dist=p.dist??v.dist;g.cam.idle=0;},{p,v:profile});await page.waitForTimeout(200);};
 const shot=async name=>{const file=`${name}.png`;await page.screenshot({path:path.join(dir,file)});r.screenshots.push(file);save();console.log(JSON.stringify({event:'screenshot',case:id,path:path.join(dir,file)}));};
 try{
  browser=await pw.chromium.launch({channel:'chrome',headless:true});r.browserVersion=browser.version();
  context=await browser.newContext({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:fixture.deviceScaleFactor,isMobile:!!profile.mobile,hasTouch:!!profile.mobile,...(profile.mobile?{userAgent:pw.devices['iPhone 13'].userAgent}:{})});
  page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>r.pageErrors.push(String(e)));page.on('crash',()=>r.pageErrors.push('PAGE CRASH'));
  page.on('console',m=>{if(m.type()==='error')r.consoleErrors.push({text:m.text(),location:m.location()});else if(m.type()==='warning')r.warnings.push(m.text());});
  page.on('request',q=>r.requests.push({url:q.url(),method:q.method(),type:q.resourceType()}));page.on('requestfailed',q=>r.requestFailures.push({url:q.url(),failure:q.failure()}));
  page.on('response',res=>{if(res.status()>=400)r.httpErrors.push({url:res.url(),status:res.status()});if(/\/assets\/index-[^/]+\.js$/.test(new URL(res.url()).pathname))tasks.push(res.body().then(b=>r.bundles.push({url:res.url(),bytes:b.length,sha256:hash(b)})).catch(e=>r.warnings.push(`Bundle read: ${e}`)));});
  await context.route('**/*',route=>{const q=route.request();if(new URL(q.url()).pathname==='/_vercel/insights/script.js'){r.analyticsSuppressed.push(q.url());return route.fulfill({status:200,contentType:'application/javascript',body:'/* R13 QA analytics suppressed */'});}if(!['GET','HEAD'].includes(q.method())){r.blockedWrites.push(q.url());return route.abort();}return route.continue();});
  const url=new URL(base);url.searchParams.set('debug','1');url.searchParams.set('cam','fixa');url.searchParams.set('fx','off');if(mode==='fixed')url.searchParams.set('dtmax','0');else url.searchParams.delete('dtmax');r.url=url.href;
  const start=Date.now();await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.__gta?.loading().state==='ready'&&!document.getElementById('go').disabled,null,{timeout:120000});r.readyMs=Date.now()-start;
  const load=await page.evaluate(()=>__gta.loading());check(load.completed===coreCount&&load.total===coreCount&&load.failed===0,`${coreCount} core assets loaded`);
  await page.locator('#go').click();await page.waitForFunction(()=>__gta.fauna().status==='ready'&&__gta.npc().status==='ready',null,{timeout:90000});
  const opened=await snapshot(),npcProfile=npcCatalog.profiles[profile.mobile?'mobile':'desktop'];r.opened=opened;
  check(opened.characters.primitiveHumanMeshes===0&&opened.characters.rendered.some(c=>c.role==='hero'&&c.skinnedMeshes>0),'native hero and no primitive humans');
  check(opened.fauna.renderer.loadedKinds.length===2&&opened.fauna.renderer.failedKinds.length===0,'two approved fauna species loaded');
  check(opened.npc.actor.bytes===npcProfile.expectedBytes&&opened.npc.actor.sha256===npcProfile.sha256,'approved NPC profile verified by bytes and hash');
  if(fixture.views.some(p=>p.deriveNpc)){
   const n=opened.npc.navigation,h=n.heading,p=n.pos;
   fixture.views=fixture.views.map(v=>v.deriveNpc?{...v,deriveNpc:false,x:p.x-Math.sin(h)*2,z:p.z+Math.cos(h)*2,yaw:h+Math.PI,pitch:-.06,dist:4.5,npcBaseline:{...p,heading:h}}:v);saveFixture();
  }
  if(mode==='fixed'){
   await page.evaluate(()=>__gta.freeze(true));
    for(const p of fixture.views.filter(p=>!waterWip||['beach','simao'].includes(p.id))){
    await stage(p);await page.waitForFunction(()=>document.getElementById('placefound').hidden,null,{timeout:8000});
    const s=await snapshot();r.views.push({id:p.id,requested:p,observed:s});
    assert.ok(distance(s.player.pos,p)<1e-7);assert.ok(Math.abs(s.cam.yaw-p.yaw)<1e-7);assert.equal(s.time,0);assert.equal(s.characters.primitiveHumanMeshes,0);
    await shot(p.id);
   }
   const hashes=r.screenshots.map(f=>hash(readFileSync(path.join(dir,f))));check(new Set(hashes).size===hashes.length,'all staged views produce distinct images');
   check(r.views.every(v=>!v.observed.camera.inside),'staged cameras stay outside building volumes');
  }else if(waterWip){
   const p=fixture.views.find(v=>v.id==='beach');await stage(p);await page.waitForTimeout(500);
   await page.locator('#c').click({position:{x:profile.width*.48,y:profile.height*.55}});
   r.walk={input:'real KeyW for 200 native RAF observations, WIP water inspection',start:(await snapshot()).player.pos};
   await page.keyboard.down('KeyW');try{r.walk.samples=await page.evaluate(async()=>{const out=[];await new Promise(resolve=>{const step=t=>{out.push({at:t,pos:{...__gta.player.pos},camera:__gta.camera(),time:__gta.state.time});if(out.length===200)resolve();else requestAnimationFrame(step);};requestAnimationFrame(step);});return out;});}finally{await page.keyboard.up('KeyW');}
   r.walk.displacement=distance(r.walk.start,r.walk.samples.at(-1).pos);check(r.walk.samples.length===200&&r.walk.displacement>.5,'WIP water movement observed for 200 native frames');await shot('water-walk-end');r.final=await snapshot();
  }else{
   const p=fixture.views.find(v=>v.id==='street');await stage(p);await page.waitForTimeout(10000);
   r.performance=await page.evaluate(async()=>{const start=performance.now(),gameStart=__gta.state.time,t=[];await new Promise(resolve=>{const tick=now=>{t.push(now);if(now-start>=5000)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});const intervals=t.slice(1).map((n,i)=>n-t[i]),sorted=[...intervals].sort((a,b)=>a-b),span=t.at(-1)-t[0];return{clock:'native RAF/performance.now',warmupMs:10000,frames:intervals.length,spanMs:span,fps:intervals.length*1000/span,p95Ms:sorted[Math.ceil(sorted.length*.95)-1],maxMs:sorted.at(-1),intervals,gameElapsed:__gta.state.time-gameStart,render:__gta.info(),fauna:__gta.fauna(),npc:__gta.npc()};});
   check(r.performance.frames>20&&r.performance.gameElapsed>3,'native RAF window samples an advancing playable scene');
   await page.locator('#c').click({position:{x:profile.width*.48,y:profile.height*.55}});r.walk={input:'real KeyW on both profiles; not a mobile joystick claim',start:(await snapshot()).player.pos,samples:[]};
   await page.keyboard.down('KeyW');try{for(let i=0;i<20;i++){await page.waitForTimeout(100);r.walk.samples.push(await page.evaluate(()=>({time:__gta.state.time,pos:{...__gta.player.pos},blocked:__gta.blocked(__gta.player.pos.x,__gta.player.pos.z,false),camera:__gta.camera()})));}}finally{await page.keyboard.up('KeyW');}
   r.walk.displacement=distance(r.walk.start,r.walk.samples.at(-1).pos);
   check(r.walk.displacement>2&&r.walk.samples.every(s=>!s.blocked&&!s.camera.inside),'real W advances along the lane without collision or camera penetration');await shot('walk-end');
   r.routeProbe=await page.evaluate(routes=>{const bad=[];let count=0;for(const s of routes){const l=Math.hypot(s.bx-s.ax,s.bz-s.az);for(let i=0;i<=Math.ceil(l);i++){const u=i/Math.ceil(l),x=s.ax+(s.bx-s.ax)*u,z=s.az+(s.bz-s.az)*u;count++;if(__gta.blocked(x,z,false))bad.push({x,z});}}return{count,blocked:bad};},fixture.routes);
   check(r.routeProbe.count>100&&!r.routeProbe.blocked.length,'baseline route centres remain passable in collision predicate');
   r.final=await snapshot();
  }
  await Promise.all(tasks);if(expectedSha)check(r.bundles.length>0&&r.bundles.every(b=>b.sha256===expectedSha),'served bundle SHA matches expected revision');
  r.resources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>({url:e.name,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize,duration:e.duration})));
  r.bytes={transfer:r.resources.reduce((n,e)=>n+e.transferSize,0),encoded:r.resources.reduce((n,e)=>n+e.encodedBodySize,0),requests:r.requests.length};
  check(!r.pageErrors.length&&!r.consoleErrors.length&&!r.httpErrors.length&&!r.requestFailures.length&&!r.blockedWrites.length,'no captured page, console, HTTP, request errors or external writes');r.passed=true;
 }catch(error){r.failure=String(error.stack||error);try{r.failureState=await snapshot();await shot('failure');}catch(e){r.captureError=String(e);}console.error(r.failure);}
 finally{await context?.close();await browser?.close();r.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({event:'completed',id,passed:r.passed,checks:r.checks.length,backend:r.opened?.backend,fps:r.performance?.fps}));}
}
report.finishedAt=new Date().toISOString();report.sourceAfter=sourceTrace();report.sourcesUnchanged=traceRoot?report.sourceBefore.sha256===report.sourceAfter.sha256:null;report.passed=report.runs.every(r=>r.passed)&&report.sourcesUnchanged!==false;save();
const files=[];function walk(d){for(const e of readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(e.name!=='MANIFEST.json'){const bytes=readFileSync(f);files.push({file:path.relative(out,f).replaceAll('\\','/'),bytes:bytes.length,sha256:hash(bytes)});}}}walk(out);
writeFileSync(path.join(out,'MANIFEST.json'),JSON.stringify({createdAt:new Date().toISOString(),passed:report.passed,harnessSha256:hash(readFileSync(new URL(import.meta.url))),fixtureSha256:hash(readFileSync(path.join(out,'scenario.json'))),files},null,2));
if(!report.passed)process.exitCode=1;
