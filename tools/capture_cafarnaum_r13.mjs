// Private real-game capture: stage once, then hold W without teleporting during the take.
// Playwright video is a visual artifact, never an FPS measurement. No audio is captured.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const argv=process.argv.slice(2),pos=argv.filter(a=>!a.startsWith('--'));
const opt=(key,d='')=>argv.find(a=>a.startsWith(`--${key}=`))?.slice(key.length+3)??d;
const base=new URL(pos[0]),out=path.resolve(pos[1]),fixture=JSON.parse(readFileSync(opt('fixture'),'utf8'));
const expectedSha=opt('expected-sha');assert.ok(expectedSha,'Use an approved immutable build hash, not a changing dev server');
const hash=b=>createHash('sha256').update(b).digest('hex');
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const ffmpeg=opt('ffmpeg','D:/BentoLabs/04-Fotos-e-videos/Bento3D-Portfolio-R2-20261008/tools/ffmpeg.exe');
const ffprobe=opt('ffprobe','D:/BentoLabs/00-Ferramentas/agent-stack/openmontage-remotion-runtime/node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe');
assert.ok(existsSync(ffmpeg)&&existsSync(ffprobe),'Use existing FFmpeg/FFprobe; never install during capture');
assert.ok(!existsSync(out),'Preserve earlier captures');mkdirSync(out,{recursive:true});
writeFileSync(path.join(out,'CAPTURE.mjs'),readFileSync(new URL(import.meta.url)));
writeFileSync(path.join(out,'scenario.json'),JSON.stringify(fixture,null,2));
const report={started:new Date().toISOString(),url:base.href,expectedSha,runs:[],limits:[
 'Private actual-game video, no image generation/interpolation or social upload. Silent: Playwright recordVideo does not record game audio.',
 'The player is teleported once before the take to the pinned street pose. During the take only real KeyW is held; no positions/camera/time are reassigned.',
 'The full raw WebM includes loading and staging. The delivered MP4 is a 10-second interior cut from the last 12.5 seconds of continuously held W.',
 'Capture/encoding overhead means this video is not an FPS or phone-performance measurement. Mobile is Chrome/iPhone-UA viewport on Windows, DPR1.',
 'The two profiles run sequentially. Analytics is stubbed and all external writes are blocked.'
]};
const save=()=>writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const probe=f=>{const p=spawnSync(ffprobe,['-v','error','-show_entries','format=duration:stream=codec_name,width,height,r_frame_rate','-of','json',f],{encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);};
for(const v of fixture.profiles.filter(p=>!opt('profile')||p.id===opt('profile'))){
 const dir=path.join(out,v.id);mkdirSync(dir);const r={profile:v,started:new Date().toISOString(),passed:false,requests:[],bundles:[],errors:[],warnings:[],samples:[]};report.runs.push(r);save();
 let browser,context,page,video;const tasks=[];
 try{
  browser=await pw.chromium.launch({channel:'chrome',headless:true});r.browser=browser.version();
  context=await browser.newContext({viewport:{width:v.width,height:v.height},deviceScaleFactor:1,isMobile:!!v.mobile,hasTouch:!!v.mobile,...(v.mobile?{userAgent:pw.devices['iPhone 13'].userAgent}:{}),recordVideo:{dir:path.join(dir,'raw'),size:{width:v.width,height:v.height}}});
  page=await context.newPage();video=page.video();
  page.on('pageerror',e=>r.errors.push(String(e)));page.on('crash',()=>r.errors.push('PAGE CRASH'));
  page.on('console',m=>{if(m.type()==='error')r.errors.push(m.text());else if(m.type()==='warning')r.warnings.push(m.text());});
  page.on('requestfailed',q=>r.errors.push(`${q.url()}: ${q.failure()?.errorText}`));
  page.on('response',res=>{if(res.status()>=400)r.errors.push(`HTTP${res.status()} ${res.url()}`);if(/\/assets\/index-[^/]+\.js$/.test(new URL(res.url()).pathname))tasks.push(res.body().then(b=>r.bundles.push({url:res.url(),bytes:b.length,sha256:hash(b)})));});
  await context.route('**/*',route=>{const q=route.request();r.requests.push({url:q.url(),method:q.method()});if(new URL(q.url()).pathname==='/_vercel/insights/script.js')return route.fulfill({status:200,contentType:'application/javascript',body:'/* private QA capture */'});if(!['GET','HEAD'].includes(q.method())){r.errors.push(`Blocked write ${q.url()}`);return route.abort();}return route.continue();});
  const url=new URL(base);url.searchParams.set('debug','1');url.searchParams.set('fx','off');url.searchParams.set('cam','fixa');url.searchParams.delete('dtmax');
  await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.__gta?.loading().state==='ready',null,{timeout:120000});
  await page.locator('#go').click();await page.waitForFunction(()=>__gta.fauna().status==='ready'&&__gta.npc().status==='ready',null,{timeout:90000});
  await Promise.all(tasks);assert.ok(r.bundles.length&&r.bundles.every(b=>b.sha256===expectedSha),'Only the approved bundle may be recorded');
  const p=fixture.views.find(p=>p.id==='street');r.staging={...p};
  await page.evaluate(({p,v})=>{__gta.teleport(p.x,p.z,p.yaw);__gta.cam.pitch=p.pitch??v.pitch;__gta.cam.dist=p.dist??v.dist;},{p,v});
  await page.waitForTimeout(7000);await page.waitForFunction(()=>document.getElementById('placefound').hidden);
  await page.locator('#c').click({position:{x:v.width*.48,y:v.height*.55}});
  r.before=await page.evaluate(()=>({player:structuredClone(__gta.player),camera:__gta.camera(),backend:__gta.backend,loading:__gta.loading(),npc:__gta.npc(),fauna:__gta.fauna(),worldQuality:__gta.worldQuality()}));
  r.inputStartUtc=new Date().toISOString();await page.keyboard.down('KeyW');
  // Keep the key held through page close. Raw recording therefore has no deliberately idle tail.
  r.samples=await page.evaluate(async()=>{const samples=[],start=performance.now();await new Promise(resolve=>{let last=-Infinity;const tick=t=>{if(t-last>=95){samples.push({at:t,time:__gta.state.time,pos:{...__gta.player.pos},speed:__gta.player.speed,blocked:__gta.blocked(__gta.player.pos.x,__gta.player.pos.z,false),camera:__gta.camera()});last=t;}if(t-start>=12500)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});return samples;});
  r.inputEndUtc=new Date().toISOString();r.recordedInputMs=Date.parse(r.inputEndUtc)-Date.parse(r.inputStartUtc);
  await context.close();context=null;await browser.close();browser=null;
  const raw=await video.path();r.raw={file:path.relative(out,raw).replaceAll('\\','/'),...probe(raw)};
  assert.ok(r.samples.length>=90&&r.recordedInputMs>=12500,'Full guarded real-input segment recorded');
  assert.ok(r.samples.every(s=>!s.blocked&&!s.camera.inside),'No player/static collision or camera penetration during the take');
  r.displacement=Math.hypot(r.samples.at(-1).pos.x-r.samples[0].pos.x,r.samples.at(-1).pos.z-r.samples[0].pos.z);assert.ok(r.displacement>15,'Take must contain actual continuous forward movement');
  const rawDuration=Number(r.raw.format.duration);assert.ok(rawDuration>13);
  const start=rawDuration-10.25,target=path.join(dir,`cafarnaum-r13-${v.id}-10s.mp4`);
  r.trim={startSeconds:start,durationSeconds:10,endGuardSeconds:.25,method:'tail-relative interior cut; no frame interpolation or speed change'};
  const command=['-hide_banner','-loglevel','error','-n','-ss',String(start),'-i',raw,'-t','10','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',target];
  const encoded=spawnSync(ffmpeg,command,{encoding:'utf8',windowsHide:true,timeout:120000});assert.equal(encoded.status,0,encoded.stderr);
  const encodedProbe=probe(target);assert.ok(Math.abs(Number(encodedProbe.format.duration)-10)<.1);assert.equal(encodedProbe.streams[0].width,v.width);assert.equal(encodedProbe.streams[0].height,v.height);
  r.delivery={file:path.relative(out,target).replaceAll('\\','/'),bytes:readFileSync(target).length,sha256:hash(readFileSync(target)),probe:encodedProbe};assert.equal(r.errors.length,0);r.passed=true;
 }catch(e){r.failure=String(e.stack||e);console.error(r.failure);}
 finally{await context?.close();await browser?.close();r.finished=new Date().toISOString();save();console.log(JSON.stringify({profile:v.id,passed:r.passed,video:r.delivery?.file,failure:r.failure?.split('\n')[0]}));}
}
report.finished=new Date().toISOString();report.passed=report.runs.length>0&&report.runs.every(r=>r.passed);save();
const files=[];function walk(d){for(const e of readdirSync(d,{withFileTypes:true})){const f=path.join(d,e.name);if(e.isDirectory())walk(f);else if(e.name!=='MANIFEST.json'){const b=readFileSync(f);files.push({file:path.relative(out,f).replaceAll('\\','/'),bytes:b.length,sha256:hash(b)});}}}walk(out);
writeFileSync(path.join(out,'MANIFEST.json'),JSON.stringify({at:new Date().toISOString(),files},null,2));if(!report.passed)process.exitCode=1;
