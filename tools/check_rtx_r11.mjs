// R11 real-RTX evidence. One Chrome at a time; no changes to the game, no publication.
// node tools/check_rtx_r11.mjs URL NEW_OUTDIR [--profile=desktop|mobile] [--fx=off|alto|master]
//   [--warmup=300] [--frames=600] [--expected-sha=SHA256] [--features-only] [--no-water-video]
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,existsSync,readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const args=process.argv.slice(2), positional=args.filter(a=>!a.startsWith('--'));
const flag=(k,d)=>args.find(a=>a.startsWith(`--${k}=`))?.slice(k.length+3)??d;
const base=new URL(positional[0]||'http://127.0.0.1:4196/'),out=path.resolve(positional[1]||'shots/rtx-r11');
assert.ok(!existsSync(out),'Use a NEW output directory: baseline evidence is immutable');mkdirSync(out,{recursive:true});
const featuresOnly=args.includes('--features-only'),captureWater=!args.includes('--no-water-video'),warmup=Number(flag('warmup','300')),frames=Number(flag('frames','600'));
assert.ok(Number.isInteger(warmup)&&warmup>0&&Number.isInteger(frames)&&frames>0);
const profiles=[{id:'desktop',width:1280,height:800,dpr:1,mobile:false},{id:'mobile',width:390,height:844,dpr:3,mobile:true}].filter(p=>!flag('profile','')||p.id===flag('profile',''));
const variants=['off','alto','master'].filter(v=>!flag('fx','')||v===flag('fx',''));
assert.ok(profiles.length&&variants.length);
const hash=b=>createHash('sha256').update(b).digest('hex');
const command=(file,argv)=>{try{return{ok:true,text:execFileSync(file,argv,{encoding:'utf8',windowsHide:true,timeout:15000}).trim()};}catch(e){return{ok:false,error:String(e)};}};
const machine=()=>({at:new Date().toISOString(),nvidia:command('C:/Windows/system32/nvidia-smi.exe',['--query-gpu=name,driver_version,temperature.gpu,power.draw,utilization.gpu,memory.used,memory.total','--format=csv']),ollama:command('C:/Users/R2/AppData/Local/Programs/Ollama/ollama.exe',['ps'])});
const report={schema:1,startedAt:new Date().toISOString(),url:base.href,expectedSha:flag('expected-sha',null),warmup,frames,featuresOnly,captureWater,node:process.version,platform:process.platform,profiles,runs:[],limitations:[
 'Mobile is a 390x844 touch viewport at deviceScaleFactor3 on this Windows RTX PC, not a physical phone. Renderer DPR may be capped by the game; actual canvas size is recorded.',
 'Bench mode bypasses Go and does not start fauna/audio. Gameplay preflight is separate; these times are the six existing static benchmark scenes, not populated-world gameplay.',
 'Game CPU timing excludes renderer.render/postprocessing submission. GPU stats use the last asynchronously resolved timestamp total and may repeat a sample; sample freshness is not exposed.',
 'RAF intervals are measured with the native browser clock, independently of simulation dt. A display/browser ceiling is not evidence of unused GPU headroom or physical-phone FPS.',
 'The original six eye/target poses are preserved, including the known poorly framed viela shot. Camera positions are staged, not walked.',
 'Master remains diagnostic while its known temporal-water defect is being investigated. No DLSS, neural renderer or visual superiority is inferred from a preset name.',
 'Video capture starts only after all timed windows. Screencast may drop frames; original CDP timestamps and JPEG frames are retained. No audio audition or physical Safari test.',
 'HTTP GET/HEAD only; external writes are blocked and logged. GPU benchmarks are serial but unrelated existing desktop applications are not closed.'
]};
const save=()=>writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const ep=JSON.parse(readFileSync(new URL('../src/data/mc-pescadores.json',import.meta.url),'utf8'));

async function attach(page,context,r){
 const tasks=[];
 page.on('pageerror',e=>r.pageErrors.push(String(e)));page.on('crash',()=>r.crashes.push(new Date().toISOString()));
 page.on('console',m=>{if(m.type()==='error')r.consoleErrors.push(m.text());if(m.type()==='warning')r.warnings.push(m.text());});
 page.on('requestfailed',q=>r.requestFailures.push({url:q.url(),failure:q.failure()}));
 page.on('response',res=>{if(res.status()>=400)r.httpErrors.push({url:res.url(),status:res.status()});
  tasks.push(res.allHeaders().then(h=>r.responses.push({url:res.url(),status:res.status(),contentLength:Number(h['content-length'])||0})).catch(e=>r.warnings.push(String(e))));
  if(/\/assets\/index-[^/]+\.js$/.test(new URL(res.url()).pathname))tasks.push(res.body().then(b=>r.bundles.push({url:res.url(),bytes:b.length,sha256:hash(b)})).catch(e=>r.warnings.push(String(e))));
 });
 await context.route('**/*',route=>{const q=route.request();if(!['GET','HEAD'].includes(q.method())){r.blockedWrites.push({url:q.url(),method:q.method()});return route.abort();}return route.continue();});
 await page.addInitScript(()=>{
  // Observe the adapter actually used for requestDevice, not merely a second adapter requested by the harness.
  window.__r11Gpu={adapters:[],devices:[],errors:[]};
  const info=a=>{const i=a.info;return i?{vendor:i.vendor,architecture:i.architecture,device:i.device,description:i.description,isFallbackAdapter:i.isFallbackAdapter}:null;};
  if(globalThis.GPU?.prototype?.requestAdapter){const orig=GPU.prototype.requestAdapter;GPU.prototype.requestAdapter=async function(...a){const v=await orig.apply(this,a);if(v)window.__r11Gpu.adapters.push({info:info(v),features:[...v.features]});return v;};}
  if(globalThis.GPUAdapter?.prototype?.requestDevice){const orig=GPUAdapter.prototype.requestDevice;GPUAdapter.prototype.requestDevice=async function(...a){const v=await orig.apply(this,a);window.__r11Gpu.devices.push({info:info(this),features:[...v.features],requiredFeatures:[...(a[0]?.requiredFeatures??[])]});return v;};}
 });
 return tasks;
}
async function captureStream(page,cdp,dir,name,milliseconds=5000){
 mkdirSync(dir,{recursive:true});const frames=[];let pending=Promise.resolve();
 const listener=e=>{const index=frames.length,file=`${name}-${String(index).padStart(5,'0')}.jpg`;frames.push({index,file,timestamp:e.metadata.timestamp,metadata:e.metadata});writeFileSync(path.join(dir,file),Buffer.from(e.data,'base64'));pending=pending.then(()=>cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId})).catch(()=>{});};
 cdp.on('Page.screencastFrame',listener);const began=Date.now();await cdp.send('Page.startScreencast',{format:'jpeg',quality:85,maxWidth:1280,maxHeight:844,everyNthFrame:1});
 await page.waitForTimeout(milliseconds);await cdp.send('Page.stopScreencast');cdp.off('Page.screencastFrame',listener);await pending;
 const result={name,wallMs:Date.now()-began,frames,frameCount:frames.length,timestampSpanMs:frames.length>1?(frames.at(-1).timestamp-frames[0].timestamp)*1000:0};writeFileSync(path.join(dir,`${name}.json`),JSON.stringify(result,null,2));return result;
}
function encodeStream(dir,stream){
 if(!stream.frames?.length)return{encoded:false,reason:'No captured frames; leave failure in report and do not throw from cleanup'};
 const ff='D:/BentoLabs/04-Fotos-e-videos/Bento3D-Portfolio-R2-20261008/tools/ffmpeg.exe';if(!existsSync(ff))return{encoded:false,reason:'Existing FFmpeg not available; CDP JPEG/timestamp sequence retained'};
 const concat=stream.frames.map((f,i)=>`file '${f.file}'\nduration ${i+1<stream.frames.length?Math.max(.001,stream.frames[i+1].timestamp-f.timestamp):.04}`).join('\n')+`\nfile '${stream.frames.at(-1).file}'\n`;
 const list=path.join(dir,`${stream.name}.ffconcat`),output=path.join(dir,`${stream.name}.mp4`);writeFileSync(list,concat);
 try{execFileSync(ff,['-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',list,'-an','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-fps_mode','vfr','-movflags','+faststart',output],{windowsHide:true,timeout:120000});return{encoded:true,file:output,sha256:hash(readFileSync(output)),bytes:statSync(output).size};}catch(e){return{encoded:false,error:String(e)};}
}
const raf=async(page,ms)=>page.evaluate(async ms=>{let previous;const samples=[],start=performance.now();await new Promise(resolve=>{const next=t=>{if(previous!==undefined)samples.push(t-previous);previous=t;if(t-start>=ms)resolve();else requestAnimationFrame(next);};requestAnimationFrame(next);});const sorted=[...samples].sort((a,b)=>a-b),sum=samples.reduce((a,b)=>a+b,0),q=p=>sorted[Math.ceil(sorted.length*p)-1];return{elapsedMs:performance.now()-start,frames:samples.length,samples,meanMs:sum/samples.length,fps:1000*samples.length/sum,p50Ms:q(.5),p95Ms:q(.95),p99Ms:q(.99),maxMs:sorted.at(-1)};},ms);
async function features(page,r,shot){
 await page.waitForFunction(()=>window.__gta?.loading().state==='ready'&&!document.getElementById('go').disabled,null,{timeout:120000});
 const check=(ok,s)=>{assert.ok(ok,s);r.checks.push(s);};
 r.intro=await page.evaluate(()=>({loading:__gta.loading(),characters:__gta.characters(),bible:__gta.bible(),fauna:__gta.fauna()}));
 check(r.intro.loading.completed===14&&r.intro.loading.failed===0,'14 core assets ready');check(r.intro.characters.npcs===0&&r.intro.characters.primitiveHumanMeshes===0&&r.intro.characters.humans===1,'only approved native hero');
 await page.locator('#go').click();await page.waitForFunction(()=>__gta.fauna().status==='ready',null,{timeout:75000});
 r.afterGo=await page.evaluate(()=>({fauna:__gta.fauna(),bible:__gta.bible(),roam:__gta.roam()}));check(r.afterGo.fauna.renderer.loadedKinds.length===2,'two approved fauna species after Go');
 await page.locator('#obj').click();await page.waitForFunction(()=>document.getElementById('biblia').open);
 const before=await page.evaluate(()=>__gta.state.time);await page.waitForTimeout(600);check(await page.evaluate(()=>__gta.state.time)===before,'Bible modal pauses mission time');
 const lines=await page.locator('#bible-here .bible-verse').evaluateAll(nodes=>nodes.map(p=>p.childNodes[1].textContent));assert.deepEqual(lines,[16,17,18,19,20,21].map(n=>ep.versiculos[`Mark.1.${n}`]));check(true,'Bible panel contains literal BLIVRE verses');await shot('bible');
 await page.locator('#bible-close').click();await page.waitForFunction(t=>__gta.state.time>t,before);check(true,'closing Bible resumes simulation');
 r.freeze={before:await page.evaluate(()=>{__gta.freeze(true);return __gta.state.time;})};await page.waitForTimeout(400);r.freeze.after=await page.evaluate(()=>__gta.state.time);check(r.freeze.after===r.freeze.before,'debug freeze holds story clock');await page.evaluate(()=>__gta.freeze(false));
 const P=await page.evaluate(()=>__gta.meta.points);await page.evaluate(P=>__gta.teleport(P.beach[0],P.beach[1]),P);await page.waitForFunction(()=>__gta.state.mission===1);
 await page.evaluate(P=>__gta.teleport(P.simao[0]+1,P.simao[1]+1),P);await page.waitForFunction(()=>__gta.state.promptVisible);
 r.unreadEncounter=await page.evaluate(()=>({bible:__gta.bible(),mission:__gta.state.mission,prompt:__gta.state.promptVisible}));check(r.unreadEncounter.bible.sealed&&r.unreadEncounter.prompt,'unread next step still exposes playable encounter');
 if(r.profile.mobile)await page.locator('#act').tap();else{await page.locator('#c').click({position:{x:500,y:450}});await page.keyboard.press('KeyE');}
 await page.waitForFunction(()=>__gta.state.phase==='line');await page.waitForTimeout(800);r.cinematic=await page.evaluate(()=>({cine:__gta.cine(),camera:__gta.camera(),line:__gta.state.line,characters:__gta.characters()}));
 check(r.cinematic.cine.on&&!r.cinematic.camera.inside,'real action starts cinematic outside buildings');await shot('cinematic');
 check(await page.locator('#subt').textContent()===`“${r.cinematic.line.texto}”`,'cinematic quote stays literal');
 await page.waitForFunction(()=>__gta.state.phase!=='line',null,{timeout:45000});await page.evaluate(()=>__gta.persist());
 r.session=await page.evaluate(()=>__gta.session());check(r.session.record.loads>=1||r.session.record!==null,'session diary diagnostics available');
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__gta?.loading().state==='ready',null,{timeout:120000});
 check(/Continuar/.test(await page.locator('#go').textContent()),'reload offers saved-progress continuation');await shot('continue');
}

for(const profile of profiles)for(const fx of(featuresOnly?(flag('fx','')?variants:['off']):variants)){
 const name=`${profile.id}-${featuresOnly?'features':fx}`,dir=path.join(out,name);mkdirSync(dir);const r={name,profile,fx,startedAt:new Date().toISOString(),checks:[],machineBefore:machine(),pageErrors:[],consoleErrors:[],warnings:[],httpErrors:[],requestFailures:[],responses:[],bundles:[],blockedWrites:[],crashes:[],screenshots:[],streams:[],passed:false};report.runs.push(r);save();
 let browser,context;
 try{
  assert.ok(r.machineBefore.ollama.ok&&!/\n\S+/.test(r.machineBefore.ollama.text),'Ollama must report no loaded model before RTX benchmark');
  browser=await pw.chromium.launch({channel:'chrome',headless:true});r.browserVersion=browser.version();const bcdp=await browser.newBrowserCDPSession();r.systemInfo=await bcdp.send('SystemInfo.getInfo');
  context=await browser.newContext({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:profile.dpr,isMobile:profile.mobile,hasTouch:profile.mobile});const page=await context.newPage(),tasks=await attach(page,context,r),cdp=await context.newCDPSession(page);
  const shot=async label=>{const file=`${label}.png`;await page.screenshot({path:path.join(dir,file)});r.screenshots.push(file);};
  const u=new URL(base);u.searchParams.set('debug','1');u.searchParams.set('fx',fx);if(!featuresOnly){u.searchParams.set('bench','1');u.searchParams.set('warmup',String(warmup));u.searchParams.set('frames',String(frames));}
  r.url=u.href;const began=Date.now();await page.goto(u.href,{waitUntil:'domcontentloaded',timeout:120000});
  if(featuresOnly)await features(page,r,shot);else{
   await page.waitForFunction(()=>window.__gtaBench?.done,null,{timeout:900000,polling:300});r.navigationToBenchDoneMs=Date.now()-began;
   r.bench=await page.evaluate(()=>__gtaBench.results());assert.equal(r.bench.fx,fx);assert.equal(r.bench.shots.length,6);assert.ok(r.bench.shots.every(s=>s.stats.frames===frames));r.checks.push('six complete fixed-pose measurements');
   for(let i=0;i<6;i++){await page.evaluate(i=>__gtaBench.hold(i),i);await page.evaluate(()=>new Promise(resolve=>{let n=0;const tick=()=>++n>=30?resolve():requestAnimationFrame(tick);requestAnimationFrame(tick);}));await shot(`${i+1}-${r.bench.shots[i].name}`);}
   await page.evaluate(()=>__gtaBench.hold(4));await page.waitForTimeout(3000);r.independentRafBoat=await raf(page,5000);r.checks.push('independent native RAF boat window, no screenshots or screencast during timing');
   if(captureWater)for(const i of[3,4]){await page.evaluate(i=>__gtaBench.hold(i),i);await page.waitForTimeout(1000);const stream=await captureStream(page,cdp,path.join(dir,'water'),r.bench.shots[i].name);r.streams.push(stream);assert.ok(stream.frameCount>20&&stream.timestampSpanMs>4000,'Continuous water capture must span >4 seconds and >20 real frames');}
  }
  r.runtime=await page.evaluate(()=>({gpu:window.__r11Gpu,loading:__gta.loading(),characters:__gta.characters(),fauna:__gta.fauna(),camera:__gta.camera(),canvas:{width:document.getElementById('c').width,height:document.getElementById('c').height,devicePixelRatio,css:[innerWidth,innerHeight]},resources:performance.getEntriesByType('resource').map(e=>({name:e.name,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize,duration:e.duration}))}));
  assert.equal(r.runtime.loading.completed,14);assert.equal(r.runtime.loading.total,14);assert.equal(r.runtime.loading.failed,0);assert.equal(r.runtime.loading.state,'ready');
  if(!featuresOnly)assert.equal(r.bench.models.loaded,14);assert.deepEqual(r.requestFailures,[]);r.checks.push('all 14 core models present, ready, no failed asset or request');
  assert.ok(r.runtime.gpu.devices.length>0,'WebGPU device adapter was captured');assert.ok(r.runtime.gpu.devices.some(d=>/nvidia/i.test(`${d.info?.vendor} ${d.info?.description}`)),'Actual requestDevice adapter is NVIDIA');
  assert.ok(r.systemInfo.gpu.devices.some(d=>/RTX 5060 Ti/i.test(d.deviceString)),'Chrome system GPU is RTX5060Ti');r.checks.push('actual WebGPU NVIDIA adapter and Chrome RTX5060Ti system GPU');
  await Promise.all(tasks);if(report.expectedSha)assert.ok(r.bundles.length>0&&r.bundles.every(b=>b.sha256===report.expectedSha),'Every served primary JS matches frozen build SHA256');r.checks.push('frozen bundle hash captured');
  assert.deepEqual(r.pageErrors,[]);assert.deepEqual(r.crashes,[]);assert.deepEqual(r.httpErrors,[]);assert.deepEqual(r.consoleErrors,[]);assert.deepEqual(r.blockedWrites,[]);r.checks.push('no captured page/console/HTTP/crash/write errors');r.passed=true;
 }catch(error){r.failure=String(error.stack||error);console.error(r.failure.split('\n')[0]);}
 finally{if(context)await context.close();if(browser)await browser.close();r.machineAfter=machine();r.finishedAt=new Date().toISOString();for(const stream of r.streams)stream.encoding=encodeStream(path.join(dir,'water'),stream);save();console.log(JSON.stringify({name:r.name,passed:r.passed,checks:r.checks.length,fx:r.bench?.fx,gpu:r.bench?.gpu,frames:r.bench?.all,adapter:r.runtime?.gpu.devices,failure:r.failure?.split('\n')[0]}));}
}
report.finishedAt=new Date().toISOString();report.passed=report.runs.every(r=>r.passed);save();
const inventory=[];const walk=d=>{for(const entry of readdirSync(d,{withFileTypes:true})){const f=path.join(d,entry.name);if(entry.isDirectory())walk(f);else if(entry.name!=='MANIFEST.json'){const b=readFileSync(f);inventory.push({file:path.relative(out,f).replaceAll('\\','/'),bytes:b.length,sha256:hash(b)});}}};walk(out);writeFileSync(path.join(out,'MANIFEST.json'),JSON.stringify({generatedAt:new Date().toISOString(),harnessSha256:hash(readFileSync(new URL(import.meta.url))),files:inventory},null,2));
if(!report.passed)process.exitCode=1;
