// R12 integration QA. Run only after the build owner releases the GPU slot.
// node tools/check_takeover_r12.mjs URL NEW_OUTDIR --case=chrome-desktop --expected-sha=SHA
// --smoke limits public verification to Chrome desktop/mobile startup + one real encounter.
// Viewport/inputs are emulated on Windows. Staging teleports are not a full walked route.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const args=process.argv.slice(2),pos=args.filter(a=>!a.startsWith('--'));
const opt=(k,d='')=>args.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3)??d;
const smoke=args.includes('--smoke');
const base=new URL(pos[0]||'http://127.0.0.1:4199/'),out=path.resolve(pos[1]||'shots/takeover-r12');
assert.ok(!existsSync(out),'Use a new output directory; do not overwrite evidence');mkdirSync(out,{recursive:true});
writeFileSync(path.join(out,'HARNESS.mjs'),readFileSync(new URL(import.meta.url)));
const ep=JSON.parse(readFileSync(new URL('../src/data/mc-pescadores.json',import.meta.url),'utf8'));
const roster=JSON.parse(readFileSync(new URL('../src/data/tripo-assets.json',import.meta.url),'utf8'));
const npcCatalog=JSON.parse(readFileSync(new URL('../src/data/npc-assets.json',import.meta.url),'utf8'));
const heroFile=roster.assets.heroi.file.split('/').at(-1),coreCount=Object.values(roster.assets).filter(a=>a.status==='runtime').length;
const hash=b=>createHash('sha256').update(b).digest('hex');
const profiles=[
 {id:'chrome-desktop',width:1280,height:800},
 {id:'chrome-mobile',width:390,height:844,mobile:true},
 {id:'webkit-mobile',width:390,height:844,mobile:true,webkit:true},
 {id:'hero-404-retry',width:390,height:844,mobile:true,failure:'hero'},
 {id:'npc-404',width:390,height:844,mobile:true,failure:'npc'},
 {id:'npc-portrait',width:390,height:844,mobile:true,portrait:true},
 {id:'panel-desktop',width:1280,height:800,panel:true},
 {id:'panel-mobile',width:390,height:844,mobile:true,panel:true},
].filter(c=>(!opt('case')||c.id===opt('case'))&&(!smoke||['chrome-desktop','chrome-mobile'].includes(c.id)));
assert.ok(profiles.length,'Unknown --case');
const report={schema:1,started:new Date().toISOString(),url:base.href,expectedSha:opt('expected-sha')||null,expectedCommit:opt('expected-commit')||null,smoke,coreCount,tests:[],limitations:[
 'Chrome and WebKit run on this Windows PC. Mobile viewport/touch emulation does not verify physical Safari, iPhone memory/thermal limits or phone FPS.',
 'Mission encounters are staged with debug teleport; only explicit short keyboard/touch segments are walked. This is not a continuous whole-map traversal.',
 'NPC diagnostics and height/collision checks support screenshots, but do not prove exact foot contact on all terrain or classify arbitrary untagged scene geometry.',
 'Panel responses use versioned public GitHub fixtures; this proves rendering/error handling, not current live GitHub totals. No form, repository or payment writes.',
 'Only short native RAF samples are measured. Frame caps, other desktop applications and emulation preclude broad performance or DLSS claims.',
 'No audio audition is performed. Expected deliberately injected failures are preserved separately from ordinary runtime errors.',
 'In public smoke mode only the Vercel Insights script is stubbed to prevent artificial page views. Analytics delivery is not verified by that smoke.'
]};
const save=()=>writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const head=(a,b)=>Math.atan2(b[0]-a[0],-(b[1]-a[1]));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const raf=(page,ms=2500)=>page.evaluate(async duration=>{
 const samples=[];let previous;const start=performance.now();
 await new Promise(resolve=>{const f=t=>{if(previous!==undefined)samples.push(t-previous);previous=t;if(t-start>=duration)resolve();else requestAnimationFrame(f);};requestAnimationFrame(f);});
 const sorted=[...samples].sort((a,b)=>a-b),sum=samples.reduce((a,b)=>a+b,0);
 return {frames:samples.length,spanMs:sum,fps:1000*samples.length/sum,p95Ms:sorted[Math.ceil(.95*sorted.length)-1],maxMs:sorted.at(-1),samples};
},ms);

for(const cfg of profiles){
 const dir=path.join(out,cfg.id);mkdirSync(dir);
 const r={id:cfg.id,config:cfg,passed:false,started:new Date().toISOString(),checks:[],snapshots:[],screenshots:[],pageErrors:[],consoleErrors:[],warnings:[],httpErrors:[],requestFailures:[],requests:[],bundles:[],blockedWrites:[],suppressedAnalytics:[],crashes:[],injections:[]};
 report.tests.push(r);save();let browser,context,expectedWindow=false,heroInjected=false,npcInjected=0;
 const tasks=[];
 try{
  const engine=cfg.webkit?pw.webkit:pw.chromium;
  if(cfg.webkit)assert.ok(existsSync(engine.executablePath()),'Existing WebKit only; no browser installation');
  browser=await engine.launch(cfg.webkit?{headless:true}:{headless:true,channel:'chrome'});r.browser=browser.version();
  context=await browser.newContext({viewport:{width:cfg.width,height:cfg.height},deviceScaleFactor:1,isMobile:!!cfg.mobile,hasTouch:!!cfg.mobile,...(cfg.mobile?{userAgent:pw.devices['iPhone 13'].userAgent}:{})});
  const page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>r.pageErrors.push({text:String(e),expectedWindow}));
  page.on('crash',()=>r.crashes.push(new Date().toISOString()));
  page.on('console',m=>{if(m.type()==='error')r.consoleErrors.push({text:m.text(),location:m.location(),expectedWindow});else if(m.type()==='warning')r.warnings.push(m.text());});
  page.on('request',q=>r.requests.push({url:q.url(),method:q.method(),at:Date.now()}));
  page.on('requestfailed',q=>r.requestFailures.push({url:q.url(),failure:q.failure(),expectedWindow}));
  page.on('response',res=>{
   if(res.status()>=400)r.httpErrors.push({url:res.url(),status:res.status(),expectedWindow});
   if(/\/assets\/index-[^/]+\.js$/.test(new URL(res.url()).pathname))tasks.push(res.body().then(b=>r.bundles.push({url:res.url(),bytes:b.length,sha256:hash(b),expectedCommitFound:report.expectedCommit?b.includes(Buffer.from(report.expectedCommit)):null})).catch(e=>r.warnings.push(`Bundle read: ${e}`)));
  });
  await context.route('**/*',route=>{
   const q=route.request(),u=new URL(q.url());
   if(smoke&&u.pathname==='/_vercel/insights/script.js'){r.suppressedAnalytics.push(q.url());return route.fulfill({status:200,contentType:'application/javascript',body:'/* R12 QA: no artificial analytics visit. Game bundle unchanged. */'});}
   if(!['GET','HEAD'].includes(q.method())){r.blockedWrites.push({url:q.url(),method:q.method()});return route.abort();}
   if(cfg.failure==='hero'&&!heroInjected&&u.pathname.endsWith(`/${heroFile}`)){
    heroInjected=true;expectedWindow=true;r.injections.push({url:q.url(),status:404});return route.fulfill({status:404,contentType:'text/plain',body:'Intentional R12 hero404'});
   }
   if(cfg.failure==='npc'&&/\/[^/]*simao[^/]*\.glb$/i.test(u.pathname)){
    npcInjected++;expectedWindow=true;r.injections.push({url:q.url(),status:404});return route.fulfill({status:404,contentType:'text/plain',body:'Intentional R12 optional NPC404'});
   }
   return route.continue();
  });
  const check=(ok,text)=>{assert.ok(ok,text);r.checks.push(text);};
  const shot=async label=>{const f=`${label}.png`;await page.screenshot({path:path.join(dir,f),fullPage:!!cfg.panel});r.screenshots.push(f);};
  const snap=async label=>{
   const value=await page.evaluate(()=>{const g=window.__gta;return {backend:g.backend,phase:g.state.phase,mission:g.state.mission,time:g.state.time,player:{...g.player.pos},speed:g.player.speed,characters:g.characters(),npcPositions:g.npcPositions(),followers:g.followers(),narrativeFollowers:g.narrativeFollowers(),npc:g.npc?.()??null,fauna:g.fauna(),actor:g.actor(),camera:g.camera(),cine:g.cine(),roam:g.roam(),bible:g.bible()};});
   r.snapshots.push({label,...value});return value;
  };
  const ready=async()=>{
   await page.waitForFunction(()=>document.getElementById('loading-screen')?.dataset.state==='error'||(window.__gta?.loading().state==='ready'&&!document.getElementById('go').disabled),null,{timeout:120000});
   assert.equal(await page.locator('#loading-screen').getAttribute('data-state'),'ready',await page.locator('#loading-stage').textContent());
  };
  const waitGame=async n=>{const until=await page.evaluate(n=>__gta.state.time+n,n);await page.waitForFunction(t=>__gta.state.time>=t,until,{timeout:30000});};
  const stage=async p=>{await page.evaluate(p=>__gta.teleport(p[0],p[1],p[2]),p);await waitGame(.3);};
  const press=async()=>{if(cfg.mobile)await page.locator('#act').tap();else{await page.locator('#c').click({position:{x:cfg.width*.48,y:cfg.height*.54}});await page.keyboard.press('KeyE');}};
  const proveHumans=s=>{check(s.characters.primitiveHumanMeshes===0,'no procedural human meshes');check(s.characters.rendered.some(h=>h.id==='heroi'&&h.skinnedMeshes>0),'native hero skeleton attached');};
  const runtime=async()=>page.evaluate(()=>({loading:__gta.loading(),npc:__gta.npc?.()??null,fauna:__gta.fauna(),audio:__gta.audio(),info:__gta.info(),canvas:{width:document.getElementById('c').width,height:document.getElementById('c').height,css:[innerWidth,innerHeight],dpr:devicePixelRatio},resources:performance.getEntriesByType('resource').map(e=>({name:e.name,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,duration:e.duration}))}));
  if(cfg.panel){
   const api='https://api.github.com/repos/alexpiraginet-bot/-grand-testament-adventure',asked=[];let refuse=false,partial=false;
   await page.route(`${api}**`,route=>{const u=new URL(route.request().url());asked.push(u.pathname+u.search);if(refuse){expectedWindow=true;return route.fulfill({status:403,contentType:'application/json',body:'{"message":"API rate limit exceeded"}'});}const tail=u.pathname.slice(new URL(api).pathname.length),file=tail===''?'repo':tail==='/commits'?'commits':tail==='/issues'?'issues':null;assert.ok(file,'Unexpected panel API request');let body=readFileSync(new URL(`../test/fixtures/github/${file}.json`,import.meta.url),'utf8');if(partial&&file==='issues'){const item=JSON.parse(body)[0];body=JSON.stringify(Array.from({length:100},(_,i)=>({...item,number:1000+i})));}return route.fulfill({status:200,contentType:'application/json',body});});
   const url=new URL('painel.html',base);await page.goto(url.href,{waitUntil:'load'});await page.waitForFunction(()=>document.querySelectorAll('#kpis .tile').length===6);
   r.panel=await page.evaluate(()=>({tiles:[...document.querySelectorAll('#kpis .tile')].map(n=>n.firstElementChild.textContent),text:document.body.innerText,overflow:document.documentElement.scrollWidth>innerWidth,targets:[...document.querySelectorAll('.painel-nav a')].map(n=>n.getBoundingClientRect().height),stamp:document.getElementById('stamp').textContent}));
   assert.deepEqual(r.panel.tiles,['29','3','1','1','0','0']);check(true,'panel counts match known GitHub fixtures');
   check(!r.panel.overflow&&r.panel.targets.every(n=>n>=44),'panel fits viewport and navigation targets are touch sized');check(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(r.panel.text),'panel does not expose emails');check(asked.length===3,'panel uses three bounded read requests');await shot('panel');
   const count=asked.length;await page.reload({waitUntil:'load'});await page.waitForFunction(()=>document.querySelectorAll('#kpis .tile').length===6);check(asked.length===count,'panel reload uses five-minute cache');
   await page.evaluate(()=>sessionStorage.removeItem('gta:painel:v1'));refuse=true;await page.reload({waitUntil:'load'});await page.waitForFunction(()=>document.getElementById('stamp').classList.contains('is-error'));
   check(await page.locator('#kpis .tile').count()===0,'403 does not invent dashboard values');await shot('panel-refused');refuse=false;await page.locator('#stamp button').click();await page.waitForFunction(()=>document.querySelectorAll('#kpis .tile').length===6);expectedWindow=false;check(true,'real retry restores panel after deliberate API refusal');
   await page.evaluate(()=>sessionStorage.removeItem('gta:painel:v1'));partial=true;await page.reload({waitUntil:'load'});await page.waitForFunction(()=>document.querySelectorAll('#kpis .tile').length===6);r.panelPartial=await page.locator('#stamp').textContent();check(/Totais de issues, pull requests e participantes parciais/.test(r.panelPartial)&&/100 itens/.test(r.panelPartial),'a full synthetic page of 100 tickets is explicitly labelled partial');await shot('panel-partial-100');r.panelRequests=asked;
  }else{
   const u=new URL(base);u.searchParams.set('debug','1');u.searchParams.set('fx','off');r.url=u.href;const began=Date.now();await page.goto(u.href,{waitUntil:'domcontentloaded',timeout:120000});
   if(cfg.failure==='hero'){
    await page.waitForFunction(()=>document.getElementById('loading-screen')?.dataset.state==='error',null,{timeout:120000});
    r.failureOpening=await page.evaluate(()=>({goDisabled:document.getElementById('go').disabled,debug:!!window.__gta,stage:document.getElementById('loading-stage').textContent}));
    check(heroInjected&&r.failureOpening.goDisabled&&!r.failureOpening.debug,'hero404 remains terminal without a substitute actor');check(await page.locator('#loading-retry').isVisible()&&await page.locator('#loading-safe').isVisible(),'hero404 exposes recovery buttons');await page.waitForTimeout(1200);check(await page.locator('#go').isDisabled(),'late assets do not override terminal startup failure');await shot('hero404');expectedWindow=false;await Promise.all([page.waitForEvent('domcontentloaded'),page.locator('#loading-retry').click()]);
   }
   await ready();r.readyMs=Date.now()-began;r.loading=await page.evaluate(()=>__gta.loading());check(r.loading.completed===coreCount&&r.loading.failed===0,'all core assets load before Go');proveHumans(await snap('intro'));await shot('intro');
   await page.locator('#go').click();await page.waitForFunction(()=>__gta.state.phase==='play');await page.waitForFunction(()=>__gta.fauna().status==='ready',null,{timeout:75000});
   check((await page.evaluate(()=>__gta.fauna().renderer.loadedKinds)).length===2,'both approved fauna species survive integration');
   await page.waitForFunction(()=>['ready','unavailable'].includes(__gta.npc?.().status),null,{timeout:40000});
   if(cfg.failure!=='npc'){
    const n=await page.evaluate(()=>__gta.npc()),expected=npcCatalog.profiles[cfg.mobile?'mobile':'desktop'];check(n.status==='ready','reviewed Simão loads after Go');
    check(n.actor.bytes===expected.expectedBytes&&n.actor.sha256===expected.sha256&&n.actor.textureLimit===expected.textureMaxSize,'NPC profile byte/hash/texture budget matches pinned catalogue');
   }await waitGame(.5);await snap('after-go');
   if(cfg.failure==='npc'){
    check(npcInjected>0,'optional NPC request was actually intercepted');const failed=await snap('npc404');check(failed.npc.status==='unavailable'&&failed.characters.npcs===0&&failed.characters.primitiveHumanMeshes===0&&failed.characters.npcColliders.length===0,'optional NPC failure has no geometric fallback or invisible collider');const requests=npcInjected;await page.waitForTimeout(3000);check(npcInjected===requests,'optional NPC failure does not create a retry loop');
    const P=await page.evaluate(()=>__gta.meta.points);await stage([...P.beach,head(P.start,P.beach)]);await page.waitForFunction(()=>__gta.state.mission===1);await stage([P.simao[0]+1,P.simao[1]+1,head(P.beach,P.simao)]);await page.waitForFunction(()=>__gta.state.promptVisible);await press();await page.waitForFunction(()=>__gta.state.phase==='line');check(true,'optional NPC404 leaves narrative action playable');await shot('npc404-playable');expectedWindow=false;
   }else if(cfg.portrait){
    r.portraitStaging=await page.evaluate(()=>{const g=__gta,n=g.npc(),h=n.navigation.heading,p=n.navigation.pos;const pos={x:p.x-Math.sin(h)*2,z:p.z+Math.cos(h)*2};g.teleport(pos.x,pos.z,h+Math.PI);g.cam.dist=4.5;g.cam.pitch=-.06;return{npc:p,player:pos,heading:h,cameraYaw:h+Math.PI,dist:4.5,pitch:-.06,blocked:g.blocked(pos.x,pos.z,false),note:'Debug composition: camera stands on land in front of unchanged dry NPC; hero is staged behind NPC toward the shore.'};});
    check(!r.portraitStaging.blocked,'close portrait player staging is outside static obstacles');await waitGame(7);await snap('close-mobile-512');await shot('simao-close-512');await page.evaluate(()=>{__gta.cam.yaw+=.12;});await waitGame(.6);await shot('simao-close-512-quarter');
   }else if(smoke){
    const P=await page.evaluate(()=>__gta.meta.points);await stage([...P.beach,head(P.start,P.beach)]);await page.waitForFunction(()=>__gta.state.mission===1);
    const near=await page.evaluate(()=>{const n=__gta.npc(),h=n.navigation.heading,p=n.navigation.pos;return[p.x+Math.sin(h)*2.5,p.z-Math.cos(h)*2.5,h+Math.PI];});await stage(near);await page.waitForFunction(()=>__gta.state.promptVisible);const before=await snap('smoke-idle');
    check(before.characters.npcs===1&&before.characters.primitiveHumanMeshes===0&&before.npc.actor.visible,'public scene contains reviewed Simão and no human placeholders');await waitGame(.5);check((await page.evaluate(()=>__gta.npc().actor.mixerTime))>before.npc.actor.mixerTime,'public NPC idle mixer advances');await shot('simao-idle');
    await press();await page.waitForFunction(()=>__gta.state.phase==='line');await waitGame(.8);const call=await snap('smoke-call');check(call.cine.on&&!call.camera.inside,'public E/tap starts clear cinematic');check(await page.locator('#subt').textContent()===`“${await page.evaluate(()=>__gta.state.line.texto)}”`&&/BÍBLIA LIVRE/.test(await page.locator('#subr').textContent()),'public subtitle is literal and credited');await shot('simao-call');await page.waitForFunction(()=>__gta.state.mission===2,null,{timeout:45000});await waitGame(.3);const after=await snap('smoke-following');check(after.followers.length===1&&after.npc.navigation.following,'public encounter produces exactly one actual follower');
   }else if(!cfg.failure){
    await gameplay({page,cfg,r,check,shot,snap,waitGame,stage,press});
   }else await shot('hero-recovered');
   r.raf=await raf(page);r.runtime=await runtime();
  }
  await Promise.all(tasks);
  if(report.expectedSha&&!cfg.panel)check(r.bundles.length>0&&r.bundles.every(b=>b.sha256===report.expectedSha),'served game bundle matches declared SHA256');
  if(report.expectedCommit&&!cfg.panel)check(r.bundles.every(b=>b.expectedCommitFound===true),'served game bundle embeds declared build commit');
  const injectedUrl=u=>r.injections.some(i=>i.url===u)||(cfg.panel&&u?.startsWith('https://api.github.com/repos/alexpiraginet-bot/-grand-testament-adventure'));
  const expectedConsole=e=>e.expectedWindow&&((/Failed to load resource/i.test(e.text)&&injectedUrl(e.location?.url))||(cfg.failure==='hero'&&heroInjected&&e.text.startsWith('Error: O personagem principal não chegou. Confira a conexão e tente novamente.')));
  check(r.pageErrors.length===0,'no page errors, including deliberate resource failures');check(r.consoleErrors.filter(e=>!expectedConsole(e)).length===0,'no unexpected console errors');check(r.httpErrors.filter(e=>!(e.expectedWindow&&injectedUrl(e.url))).length===0,'no unexpected HTTP errors');check(r.requestFailures.filter(e=>!(e.expectedWindow&&injectedUrl(e.url)&&/abort|cancel/i.test(e.failure?.errorText??''))).length===0,'no unexpected request failures');check(r.crashes.length===0&&r.blockedWrites.length===0,'no browser crashes or external writes');r.passed=true;
 }catch(e){r.failure=String(e.stack||e);console.error(r.failure);try{if(context){const p=context.pages()[0];r.failureState=await p.evaluate(()=>{const g=window.__gta;return g?{npc:g.npc?.(),loading:g.loading(),characters:g.characters(),phase:g.state.phase,mission:g.state.mission,player:{...g.player.pos},camera:g.camera()}:null;});await p.screenshot({path:path.join(dir,'failure.png')});r.screenshots.push('failure.png');}}catch(captureError){r.captureError=String(captureError);}}
 finally{await context?.close();await browser?.close();r.finished=new Date().toISOString();save();console.log(JSON.stringify({case:r.id,passed:r.passed,checks:r.checks.length,failure:r.failure?.split('\n')[0]}));}
}

async function gameplay({page,cfg,r,check,shot,snap,waitGame,stage,press}){
 const sampleNpc=()=>page.evaluate(()=>{const g=__gta,n=g.npc();return{at:performance.now(),time:g.state.time,player:{...g.player.pos},...n,blocked:n.navigation?g.blocked(n.navigation.pos.x,n.navigation.pos.z,false):null};});
 const assertNpc=s=>{assert.equal(s.status,'ready');assert.ok(s.actor?.visible);assert.ok(Math.abs(s.y-s.groundHeight)<1e-5);assert.equal(s.blocked,false);};
 r.npcSamples=[];
 const sampleFor=async(ms,label)=>{const until=Date.now()+ms,samples=[];while(Date.now()<until){samples.push(await sampleNpc());await page.waitForTimeout(150);}r.npcSamples.push({label,samples});return samples;};
 await page.locator('#obj').click();await page.waitForFunction(()=>document.getElementById('biblia').open);
 const before=await page.evaluate(()=>__gta.state.time);await page.waitForTimeout(500);check(await page.evaluate(()=>__gta.state.time)===before,'Bible pauses game time');
 const lines=await page.locator('#bible-here .bible-verse').evaluateAll(nodes=>nodes.map(p=>p.childNodes[1].textContent));assert.deepEqual(lines,[16,17,18,19,20,21].map(n=>ep.versiculos[`Mark.1.${n}`]));check(true,'Bible text is literal BLIVRE from episode data');await shot('bible');await page.locator('#bible-close').click();await waitGame(.4);check(true,'Bible close resumes time');
 const P=await page.evaluate(()=>__gta.meta.points);
 await stage([P.beach[0],P.beach[1],head(P.start,P.beach)]);await page.waitForFunction(()=>__gta.state.mission===1);
 const sim=[P.simao[0]+(P.beach[0]-P.simao[0])*.015,P.simao[1]+(P.beach[1]-P.simao[1])*.015];
 await stage([...sim,head(P.beach,P.simao)]);await page.waitForFunction(()=>__gta.state.promptVisible);
 check(await page.evaluate(()=>__gta.bible().sealed),'next Bible step is still unread before encounter');const initialNpc=await snap('simao-before');
 check(initialNpc.characters.npcs===1&&initialNpc.characters.humans===2&&initialNpc.characters.primitiveHumanMeshes===0,'one reviewed skinned Simão joins native hero, no extra human placeholders');
 check(initialNpc.npc.actor.clips.idle==='simao-idle-r11'&&initialNpc.npc.actor.clips.walk==='simao-walk-r11','reviewed idle and walk clips selected');
 const idle=await sampleFor(1100,'idle');idle.forEach(assertNpc);check(idle.every(s=>s.navigation.speed===0&&s.actor.weight<.01)&&idle.at(-1).actor.mixerTime>idle[0].actor.mixerTime,'visible Simão breathes in idle without translating');await shot('simao-idle');
 if(cfg.mobile){r.hud=await page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};return{joy:rect('#joy'),action:rect('#act'),radar:rect('.radarbox'),overflow:document.documentElement.scrollWidth>innerWidth};});const inside=b=>b.x>=0&&b.y>=0&&b.x+b.w<=cfg.width+1&&b.y+b.h<=cfg.height+1;check(!r.hud.overflow&&inside(r.hud.joy)&&inside(r.hud.action),'mobile joystick/action fully inside viewport');}
 await press();await page.waitForFunction(()=>__gta.state.phase==='line');await waitGame(.7);const line=await snap('simao-line');
 check(line.cine.on&&!line.camera.inside,'E/tap starts cinematic outside buildings');check(await page.locator('#subt').textContent()===`“${line.phase==='line'?await page.evaluate(()=>__gta.state.line.texto):''}”`,'action subtitle remains literal');check(/BÍBLIA LIVRE/.test(await page.locator('#subr').textContent()),'scripture subtitle is explicitly credited');
 const talking=await sampleFor(750,'dialogue');talking.forEach(assertNpc);check(talking.every(s=>distance(s.navigation.pos,talking[0].navigation.pos)<1e-5&&s.navigation.speed===0),'Simão remains positioned while dialogue plays');await shot('simao-call');await page.waitForFunction(()=>__gta.state.mission===2,null,{timeout:45000});
 check((await page.evaluate(()=>__gta.narrativeFollowers())).length===2,'first call advances narrative without mandatory reading');
 await waitGame(.8);const following=await snap('first-followers');check(following.followers.length===1&&following.characters.radarFollowers.length===1&&following.npc.navigation.following,'one actual follower/radar marker despite two narrative names');
 // Start one short real-input segment, facing along the dry shoreline. Do not assign actor/player positions during it.
 const start=await page.evaluate(P=>{const p=__gta.player.pos;const h=Math.atan2(P.barco_margem[0]-p.x,-(P.barco_margem[1]-p.z));__gta.cam.yaw=h;return{...p};},P);
 let cdp,touchPoint;
 if(cfg.mobile&&!cfg.webkit){cdp=await page.context().newCDPSession(page);const box=await page.locator('#joy').boundingBox();touchPoint={x:box.x+box.width/2,y:box.y+box.height/2};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...touchPoint,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchPoint.x,y:touchPoint.y-box.width*.45,id:1}]});r.movementInput='Chrome CDP touch on actual canvas joystick, 90% radius, below run threshold';}
 else{await page.locator('#c').click({position:{x:cfg.width*.48,y:cfg.height*.54}});await page.keyboard.down('KeyW');r.movementInput=cfg.webkit?'Keyboard segment in WebKit touch viewport; action uses real tap':'Real KeyW';}
 const moving=await sampleFor(cdp?2800:2200,'following-while-player-moves');
 if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.keyboard.up('KeyW');
 const catchup=await sampleFor(2800,'following-after-player-stops');const all=[...moving,...catchup];all.forEach(assertNpc);
 check(distance(start,all.at(-1).player)>.75,'real input moves player along short shoreline segment');
 check(all.some(s=>s.navigation.speed>.1&&s.actor.weight>.8)&&all.at(-1).actor.walkTime!==all[0].actor.walkTime,'real follower translates and advances weighted walk clip');
 for(let i=1;i<all.length;i++){const a=all[i-1],b=all[i],elapsed=(b.at-a.at)/1000;assert.ok(distance(a.navigation.pos,b.navigation.pos)<=.70*elapsed+.06,'follower never teleports to catch up');}
 const segments=all.map(s=>s.navigation.pos);const crossings=await page.evaluate(points=>{const bad=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.1));for(let j=0;j<=steps;j++){const x=a.x+(b.x-a.x)*j/steps,z=a.z+(b.z-a.z)*j/steps;if(__gta.blocked(x,z,false))bad.push({i,x,z});}}return bad;},segments);check(crossings.length===0,'every sampled follower segment avoids static blocked space');await shot('simao-walk');
 await page.locator('#obj').click();await page.waitForFunction(()=>document.getElementById('biblia').open);const pause0=await sampleNpc();await page.waitForTimeout(700);const pause1=await sampleNpc();check(distance(pause0.navigation.pos,pause1.navigation.pos)<1e-5&&pause1.actor.mixerTime===pause0.actor.mixerTime,'Bible freezes follower position and AnimationMixer');await page.locator('#bible-close').click();await waitGame(.5);check((await sampleNpc()).actor.mixerTime>pause1.actor.mixerTime,'closing menu resumes NPC mixer');
 r.gameplayRaf=await raf(page);r.firstDocumentResources=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>({name:e.name,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,duration:e.duration})));
 await page.evaluate(()=>__gta.persist());await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__gta?.loading().state==='ready',null,{timeout:120000});check(/Continuar/.test(await page.locator('#go').textContent()),'partial save offers Continue');await page.locator('#go').click();await page.waitForFunction(()=>__gta.npc().status==='ready',null,{timeout:40000});await waitGame(.4);const restored=await snap('restored-follower');
 check(restored.npc.navigation.following&&restored.characters.npcs===1&&restored.followers.length===1,'partial reload restores exactly one visible follower');check(distance(restored.npc.navigation.pos,restored.player)<9&&Math.abs(restored.npc.y-restored.npc.groundHeight)<1e-5,'restored follower starts on nearby safe ground');await shot('simao-restored');
 const boat=[P.barco_margem[0]+(P.simao[0]-P.barco_margem[0])*.03,P.barco_margem[1]+(P.simao[1]-P.barco_margem[1])*.03];
 await stage([...boat,head(P.simao,P.barco)]);await page.waitForFunction(()=>__gta.state.promptVisible);await press();await page.waitForFunction(()=>__gta.state.phase==='line');await waitGame(.4);await shot('second-call');await page.waitForFunction(()=>__gta.state.phase==='done'&&!document.getElementById('end').hidden,null,{timeout:45000});
 check((await page.evaluate(()=>__gta.narrativeFollowers())).length===4,'all three missions finish through actual action input');await shot('episode-done');
 await page.locator('#roam').click();await page.waitForFunction(()=>__gta.roam().phase==='return'&&document.getElementById('mk').textContent==='EPÍLOGO'&&document.querySelector('.journey-label')?.textContent==='Narrativa do jogo');check(true,'epilogue authorial text is distinguished from scripture after HUD update');await shot('epilogue');
 await stage([P.start[0],P.start[1]+10,head(P.beach,P.start)]);await page.waitForFunction(()=>__gta.roam().phase==='line');
 check(await page.locator('#subt').textContent()===`“${ep.versiculos['Mark.1.21'].split(';')[0].trim()}”`,'return to village uses literal Mark1:21 clause');await shot('capernaum');await page.waitForFunction(()=>__gta.roam().phase==='free',null,{timeout:45000});
 const places=await page.evaluate(()=>__gta.roam().places),top=places.find(p=>p.id==='mirante');assert.ok(top);await stage([top.x,top.z,head([top.x,top.z],P.beach)]);await page.waitForFunction(()=>__gta.roam().found.length===__gta.roam().places.length);
 check(/Nome do jogo/.test(await page.locator('#placenote').textContent()),'authored lookout is labelled separately from sourced places');await shot('free-exploration');
 const edgeAt=await page.evaluate(()=>__gta.meta.size/2-80);await stage([0,-edgeAt,0]);await page.waitForFunction(()=>document.querySelector('.journey-body')?.textContent.startsWith('Aqui termina'));check(await page.locator('.journey-label').textContent()==='Orientação','region boundary is communicated as guidance');await shot('region-limit');
 await page.evaluate(()=>__gta.persist());r.saved=await page.evaluate(()=>({save:__gta.save(),session:__gta.session()}));check(Object.values(r.saved.save.episodes).some(e=>e.missionsDone===3&&e.completions>=1),'completed episode persists');
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__gta?.loading().state==='ready',null,{timeout:120000});r.reload=await page.evaluate(()=>({save:__gta.save(),session:__gta.session(),go:document.getElementById('go').textContent,explore:document.getElementById('explore')?.textContent}));
 check(Object.values(r.reload.save.episodes).some(e=>e.completions>=1),'reload keeps completed episode');check(r.reload.session.previous?.uncleanEnd===false,'normal reload recorded as clean session end');await shot('saved');
 check(await page.locator('#novo').textContent()==='Explorar a região','completed save offers exploration as a distinct action');await page.locator('#novo').click();await page.waitForFunction(()=>__gta.roam().phase==='free'&&__gta.npc().status==='ready',null,{timeout:45000});await waitGame(.5);const returned=await snap('saved-exploration');check(returned.characters.npcs===1&&returned.followers.length===1&&returned.narrativeFollowers.length===4,'saved exploration restores only the one actual approved follower');await shot('saved-exploration');
}

report.finished=new Date().toISOString();report.passed=report.tests.every(t=>t.passed);save();
const inventory=[];function walk(d){for(const e of readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(e.name!=='MANIFEST.json'){const b=readFileSync(f);inventory.push({file:path.relative(out,f).replaceAll('\\','/'),bytes:b.length,sha256:hash(b)});}}}walk(out);
writeFileSync(path.join(out,'MANIFEST.json'),JSON.stringify({created:new Date().toISOString(),harnessSha256:hash(readFileSync(new URL(import.meta.url))),files:inventory},null,2));if(!report.passed)process.exitCode=1;
