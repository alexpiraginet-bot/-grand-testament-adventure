// Bounded R10 comparison. Fixed visual frames and live performance are separate runs.
// One Chrome context at a time; never starts downloads, purchases, publication or model generation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Terrain,decodeHeights} from '../src/terrain.ts';
import {missionRoutes,settlementLayout} from '../src/world-layout.ts';
import {faunaAssetsManifest} from '../src/fauna-assets-manifest.ts';

const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const argv=process.argv.slice(2),positional=argv.filter(x=>!x.startsWith('--'));
const base=new URL(positional[0]||'http://127.0.0.1:4194/'),out=positional[1]||'shots/village-r10-baseline';
const option=name=>argv.find(x=>x.startsWith(`--${name}=`))?.slice(name.length+3);
const fixturePath=option('fixture'),filter=option('profile'),engineName=option('engine')||'chrome';
assert.ok(['chrome','webkit'].includes(engineName),'Unknown engine');
const liveWarmupMs=Number(option('warmup-ms')||2500),measureMs=Number(option('measure-ms')||5000);
assert.ok(Number.isFinite(liveWarmupMs)&&liveWarmupMs>=0&&liveWarmupMs<=60000);
assert.ok(Number.isFinite(measureMs)&&measureMs>=1000&&measureMs<=60000);
const modes=argv.includes('--live-only')?['live']:['fixed','live'];
assert.ok(!existsSync(out),'Output directory must be new; preserve previous evidence');mkdirSync(out,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fileSha=file=>sha(readFileSync(file));
const read=file=>JSON.parse(readFileSync(new URL(`../${file}`,import.meta.url),'utf8'));
const meta=read('public/world/cafarnaum.json'),terrain=new Terrain(meta,decodeHeights(read('public/world/cafarnaum-heights.json')));
const routes=missionRoutes(terrain),plans=settlementLayout(terrain,routes);
const roster=read('src/data/tripo-assets.json'),coreCount=Object.values(roster.assets).filter(a=>a.status==='runtime').length;
const heading=(a,b)=>Math.atan2(b.x-a.x,-(b.z-a.z));
function makeFixture(){
 const i=routes.findIndex(s=>Math.hypot(s.bx-meta.points.beach[0],s.bz-meta.points.beach[1])<.01);
 assert.ok(i>=0);const lane=routes.slice(0,i+1),lengths=lane.map(s=>Math.hypot(s.bx-s.ax,s.bz-s.az)),total=lengths.reduce((a,b)=>a+b,0);
 const along=distance=>{let at=distance,j=0;while(j<lane.length-1&&at>lengths[j])at-=lengths[j++];const s=lane[j],u=at/lengths[j];return{x:s.ax+(s.bx-s.ax)*u,z:s.az+(s.bz-s.az)*u,pathYaw:heading({x:s.ax,z:s.az},{x:s.bx,z:s.bz})};};
 const initial=along(0),middle=along(total*.5),shore=along(total-3);
 const house=[...plans].sort((a,b)=>Math.hypot(a.x-middle.x,a.z-middle.z)-Math.hypot(b.x-middle.x,b.z-middle.z))[0];
 return{version:1,description:'Three derived static views: lane start, middle facing nearby house, shoreline three metres before beach endpoint.',
  metaSha:fileSha(new URL('../public/world/cafarnaum.json',import.meta.url)),terrainSha:fileSha(new URL('../public/world/cafarnaum-heights.json',import.meta.url)),
  sunDirectionUnnormalised:[.45,.92,.7],simulationTime:0,visualQuery:{debug:'1',dtmax:'0'},deviceScaleFactor:1,
  profiles:{desktop:{width:1280,height:800,pitch:.2,dist:4.4,fov:52},mobile:{width:390,height:844,pitch:.2,dist:5.2,fov:62}},
  points:[{id:'street-start',...initial,yaw:initial.pathYaw,derivation:'first route point'},
   {id:'street-house',...middle,yaw:heading(middle,house),nearbyHouse:house,derivation:'50% of the route start-to-beach, looking at the nearest planned house'},
   {id:'shore-sand',...shore,yaw:shore.pathYaw,derivation:'three metres before beach along the last village route segment'}],
  routes,buildingProbe:plans.filter((_,j)=>j%Math.max(1,Math.floor(plans.length/16))===0).map(b=>({x:b.x,z:b.z})),
 };
}
const fixture=fixturePath?JSON.parse(readFileSync(fixturePath,'utf8')):makeFixture();
const points=fixture.points.filter(p=>!option('point')||p.id===option('point'));assert.ok(points.length,'Unknown point');
assert.equal(fixture.metaSha,fileSha(new URL('../public/world/cafarnaum.json',import.meta.url)),'Geographical metadata must match the baseline');
assert.equal(fixture.terrainSha,fileSha(new URL('../public/world/cafarnaum-heights.json',import.meta.url)),'Measured terrain must match the baseline');
writeFileSync(`${out}/scenario.json`,JSON.stringify(fixture,null,2));
const report={startedAt:new Date().toISOString(),url:base.href,engineName,liveWarmupMs,measureMs,fixtureSha:sha(JSON.stringify(fixture)),fixtureSource:fixturePath||'derived from data and route/building layout',runs:[],limits:[
 'Fixed visual frames use debug dtmax=0: simulation, water/bob and animation time are frozen at zero; the real performance.now clock is never overridden.',
 'Live performance uses normal dt and no FPS/artificial clock override. RAF intervals and renderer counters are recorded separately on this PC, not a phone.',
 'The sun direction is static in the runtime. Requested cam properties and hero world position are observed; the renderer camera matrix is not exposed by R9.',
 'Views are staged with debug teleport. Only the explicitly recorded W segment is walked; route probing is a collision predicate test, not a complete playthrough.',
 'Identical render dimensions/backend/profile/positions are required for a comparison. Variable fauna is frozen only in the static runs; live fauna poses/voices may differ.',
 'Texture byte counters are renderer estimates, not VRAM/process memory. Resource Timing does not equal first-screen download bytes.',
 'GET/HEAD only; no new assets generated, forms submitted, repository pushes or deployment calls.',
]};
const save=()=>writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
const profiles=Object.entries(fixture.profiles).filter(([name])=>!filter||name===filter);assert.ok(profiles.length,'Unknown profile');
for(const [profile,viewport] of profiles)for(const mode of modes){
 const mobile=profile==='mobile',expected=faunaAssetsManifest(mobile),name=`${profile}-${mode}`;
 const r={name,profile,mode,passed:false,checks:[],views:[],screenshots:[],pageErrors:[],consoleErrors:[],warnings:[],httpErrors:[],requestFailures:[],blockedWrites:[],requests:[],responses:[],bundles:[]};report.runs.push(r);
 if(engineName==='webkit')assert.ok(existsSync(pw.webkit.executablePath()),'WebKit must already be installed');
 const browser=await (engineName==='webkit'?pw.webkit.launch({headless:true}):pw.chromium.launch({channel:'chrome',headless:true}));
 const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:fixture.deviceScaleFactor,isMobile:mobile,hasTouch:mobile,...(mobile?{userAgent:pw.devices['iPhone 13'].userAgent}:{})});
 const page=await context.newPage(),tasks=[];
 const url=new URL(base);url.searchParams.set('debug','1');if(mode==='fixed')url.searchParams.set('dtmax','0');else url.searchParams.delete('dtmax');r.url=url.href;
 page.on('pageerror',e=>r.pageErrors.push(String(e)));page.on('crash',()=>r.pageErrors.push('PAGE CRASH'));
 page.on('console',m=>{if(m.type()==='error')r.consoleErrors.push(m.text());if(m.type()==='warning')r.warnings.push(m.text());});
 page.on('request',q=>r.requests.push({url:q.url(),type:q.resourceType()}));page.on('requestfailed',q=>r.requestFailures.push({url:q.url(),error:q.failure()}));
 page.on('response',res=>{
  if(res.status()>=400)r.httpErrors.push({url:res.url(),status:res.status()});
  tasks.push(res.allHeaders().then(h=>r.responses.push({url:res.url(),status:res.status(),contentLength:Number(h['content-length'])||0})).catch(e=>r.warnings.push(`Header capture: ${e}`)));
  if(/\/assets\/index-[^/]+\.js$/.test(new URL(res.url()).pathname))tasks.push(res.body().then(body=>r.bundles.push({url:res.url(),bytes:body.length,sha256:sha(body)})).catch(e=>r.warnings.push(`Bundle capture: ${e}`)));
 });
 await context.route('**/*',route=>{if(!['GET','HEAD'].includes(route.request().method())){r.blockedWrites.push(route.request().url());return route.abort();}return route.continue();});
 const check=(condition,label)=>{assert.ok(condition,label);r.checks.push(label);};
 const inspect=()=>page.evaluate(()=>{const g=window.__gta;return{time:g.state.time,phase:g.state.phase,mission:g.state.mission,player:{...g.player},cam:{...g.cam},hero:g.characters(),fauna:g.fauna(),render:g.info(),world:g.world,worldQuality:typeof g.worldQuality==='function'?g.worldQuality():null,dimensions:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,canvasWidth:document.getElementById('c').width,canvasHeight:document.getElementById('c').height}};});
 const validate=s=>{
  assert.equal(s.hero.humans,1);assert.equal(s.hero.npcs,0);assert.equal(s.hero.primitiveHumanMeshes,0);assert.equal(s.hero.rendered[0].source,'tripo-r1/hero-native-skeleton');assert.ok(s.hero.rendered[0].skinnedMeshes>0);
  assert.deepEqual(s.hero.npcColliders,[]);assert.deepEqual(s.hero.radarFollowers,[]);
  assert.ok(expected.every(a=>s.fauna.renderer.loadedKinds.includes(a.kind)));assert.equal(s.fauna.renderer.failedKinds.length,0);
 };
 try{
  const started=Date.now();await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>window.__gta?.loading().state==='ready'&&!document.getElementById('go').disabled,null,{timeout:120000});r.readyMs=Date.now()-started;
  r.loading=await page.evaluate(()=>window.__gta.loading());r.backend=await page.evaluate(()=>window.__gta.backend);r.quality=await page.evaluate(()=>window.__gta.quality);
  check(r.loading.completed===coreCount&&r.loading.total===coreCount&&r.loading.failed===0,`${coreCount} core assets before Go`);
  await page.locator('#go').click();await page.waitForFunction(()=>window.__gta.fauna().status==='ready',null,{timeout:75000});
  await page.waitForFunction(()=>window.__gta.fauna().renderer.instances>0,null,{timeout:10000});
  const opened=await inspect();validate(opened);
  check(expected.length===2&&opened.fauna.renderer.receivedBytes===expected.reduce((n,a)=>n+a.expectedBytes,0),'both approved fauna assets retained with exact profile bytes');
  check(opened.hero.humans===1&&opened.hero.npcs===0&&opened.hero.primitiveHumanMeshes===0,'only the native skinned hero; no procedural humans');
  r.routeProbe=await page.evaluate(baseline=>{
   const g=window.__gta,blocked=[],buildings=[];let checked=0;
   for(const s of g.routes){const dx=s.bx-s.ax,dz=s.bz-s.az,l=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(l));
    for(let i=0;i<=n;i++)for(const side of [-.8,0,.8]){const x=s.ax+dx*i/n+dz/l*side,z=s.az+dz*i/n-dx/l*side;checked++;if(g.blocked(x,z,false))blocked.push({x,z,side});}}
   for(const p of baseline.buildingProbe)buildings.push({...p,blocked:g.blocked(p.x,p.z,false)});
   return{routes:g.routes,checked,blocked,buildings};
  },fixture);
  assert.deepEqual(r.routeProbe.routes,fixture.routes,'route geometry unchanged from fixed scenario');
  check(r.routeProbe.checked>100&&r.routeProbe.blocked.length===0,'actual collision predicate keeps all route centres and +/-0.8m clear');
  check(r.routeProbe.buildings.length>0&&r.routeProbe.buildings.every(b=>b.blocked),'representative building centres remain solid');
  for(const point of points){
   await page.evaluate(({p,v})=>{const g=window.__gta;g.teleport(p.x,p.z,p.yaw);g.cam.pitch=v.pitch;g.cam.dist=v.dist;g.cam.idle=0;},{p:point,v:viewport});
   await page.waitForTimeout(mode==='fixed'?700:liveWarmupMs);
   const view={id:point.id,requested:point,observed:await inspect()};validate(view.observed);
   assert.ok(Math.hypot(view.observed.player.pos.x-point.x,view.observed.player.pos.z-point.z)<1e-8);
   assert.ok(Math.abs(view.observed.cam.yaw-point.yaw)<1e-8&&Math.abs(view.observed.cam.pitch-viewport.pitch)<1e-8&&Math.abs(view.observed.cam.dist-viewport.dist)<1e-8);
   if(mode==='fixed'){
    assert.equal(view.observed.time,0);const root=view.observed.hero.rendered[0].position;
    assert.ok(Math.hypot(root.x-point.x,root.z-point.z)<1e-8,'frozen simulation still updates actual hero placement');
    for(const layer of ['screen','canvas']){const file=`${name}-${point.id}-${layer}.png`;if(layer==='canvas')await page.locator('#c').screenshot({path:`${out}/${file}`});else await page.screenshot({path:`${out}/${file}`});r.screenshots.push(file);}
   }else{
    view.performance=await page.evaluate(async durationMs=>{
     const g=window.__gta,first=g.fpsLog.length,start=performance.now(),gameStart=g.state.time,stamps=[];
     await new Promise(resolve=>{function tick(now){stamps.push(now);if(now-start>=durationMs)resolve();else requestAnimationFrame(tick);}requestAnimationFrame(tick);});
     const end=performance.now(),intervals=stamps.slice(1).map((s,i)=>s-stamps[i]),sorted=[...intervals].sort((a,b)=>a-b),p=q=>sorted[Math.min(sorted.length-1,Math.floor(q*sorted.length))];
     return{clock:'native performance.now + requestAnimationFrame timestamps, no overrides',startMs:start,endMs:end,elapsedMs:end-start,frames:stamps.length,rafFPS:(stamps.length-1)*1000/(stamps.at(-1)-stamps[0]),intervalMs:{min:sorted[0],p50:p(.5),p95:p(.95),p99:p(.99),max:sorted.at(-1)},intervalsMs:intervals,rendererFPSSamples:g.fpsLog.slice(first),gameTimeElapsed:g.state.time-gameStart,renderer:g.info(),fauna:g.fauna()};
    },measureMs);
    check(view.performance.frames>0&&view.performance.elapsedMs>=measureMs&&view.performance.gameTimeElapsed>measureMs/2000,`${point.id}: live RAF measured with advancing simulation`);
   }
   r.views.push(view);
  }
  if(mode==='fixed'){
   const hashes=points.map(p=>fileSha(`${out}/${name}-${p.id}-canvas.png`));check(new Set(hashes).size===points.length,'staged locations render distinct native canvas images');
   check(r.views.every(v=>v.observed.time===0),'all fixed views keep identical zero simulation/water phase');
  }else{
   const p=fixture.points[0];await page.evaluate(p=>{const g=window.__gta;g.teleport(p.x,p.z,p.pathYaw);g.cam.idle=0;},p);
   await page.locator('#c').click({position:{x:viewport.width*.48,y:viewport.height*.52}});r.walk={input:'real KeyW, including emulated mobile viewport',start:{x:p.x,z:p.z},samples:[]};await page.keyboard.down('KeyW');
   try{for(let i=0;i<16;i++){await page.waitForTimeout(100);r.walk.samples.push(await page.evaluate(()=>({pos:{...window.__gta.player.pos},time:window.__gta.state.time,blocked:window.__gta.blocked(window.__gta.player.pos.x,window.__gta.player.pos.z,false)})));}}
   finally{await page.keyboard.up('KeyW');}
   const last=r.walk.samples.at(-1);r.walk.displacement=Math.hypot(last.pos.x-p.x,last.pos.z-p.z);
   check(r.walk.displacement>2&&r.walk.samples.every(s=>!s.blocked),'keyboard movement advances on the real lane without obstruction');
  }
  await Promise.all(tasks);r.resourceTiming=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>({name:e.name,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,duration:e.duration})));
  r.bytes={responseHeaders:r.responses.reduce((n,x)=>n+x.contentLength,0),resourceEncoded:r.resourceTiming.reduce((n,x)=>n+x.encodedBodySize,0)};
  check(!r.pageErrors.length&&!r.consoleErrors.length&&!r.httpErrors.length&&!r.blockedWrites.length,'no captured page/console/HTTP errors or external writes');r.passed=true;
 }catch(error){r.failure=String(error.stack||error);try{r.failureState=await inspect();await page.screenshot({path:`${out}/${name}-failure.png`});}catch{}}
 finally{await context.close();await browser.close();r.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({name:r.name,passed:r.passed,checks:r.checks.length,backend:r.backend,failure:r.failure}));}
}
report.finishedAt=new Date().toISOString();report.passed=report.runs.every(r=>r.passed);save();
const evidence=readdirSync(out).filter(f=>f!=='MANIFEST.json').map(file=>({file,bytes:statSync(`${out}/${file}`).size,sha256:fileSha(`${out}/${file}`)}));
writeFileSync(`${out}/MANIFEST.json`,JSON.stringify({createdAt:new Date().toISOString(),passed:report.passed,fixtureSha:report.fixtureSha,harnessSha:fileSha(new URL(import.meta.url)),evidence},null,2));
if(!report.passed)process.exitCode=1;
