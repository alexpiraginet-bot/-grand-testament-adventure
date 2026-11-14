// Real browser smoke of R15. Authoring this file does not run it.
// Run only after reviewing the build and freeing GPU: node tools/check_context_game_r15.mjs --allow-gpu [url] [shots/context-game-r15-ID]
// Debug teleports stage the encounters; actions and walking use browser keyboard/touch, never __gta.act().
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

assert.equal(process.argv[2],'--allow-gpu','Explicit --allow-gpu required; coordinate with the paused local laboratory first.');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const address=new URL(process.argv[3]??'http://127.0.0.1:4175/');
assert.equal(address.protocol,'http:');assert.ok(['127.0.0.1','localhost','[::1]'].includes(address.hostname),'Loopback build only');
assert.equal(address.username+address.password,'');
address.searchParams.set('debug','1');address.searchParams.set('fps','1');
assert.equal(address.searchParams.has('dtmax'),false,'Keep the actual bounded game clock');
const relative=process.argv[4]??'shots/context-game-r15-first';assert.match(relative,/^shots\/context-game-r15-[a-z0-9-]+$/);
const out=path.resolve(root,relative);assert.ok(out.startsWith(root+path.sep));await mkdir(out);
const hash=b=>createHash('sha256').update(b).digest('hex');
const urlLabel=value=>{try{const url=new URL(value);return url.origin+url.pathname;}catch{return String(value).slice(0,180);}};
const report={startedAt:new Date().toISOString(),passed:false,url:address.href,
  scope:'Real Go, keyboard/touch, context actions, staged mission completion and teaching/persistence; encounter placement uses explicitly logged DEBUG TELEPORTS. Not a walked full mission, Safari device test or new graphics/FPS improvement.',
  measurement:'RAF interval sample for at least 5000ms plus game fpsLog. Resource Timing byte totals are browser-reported, not packet capture; zero-size entries may be cached or restricted.',
  sources:{},runs:{}};
for(const file of ['tools/check_context_game_r15.mjs','src/input.ts','src/context-action.ts','src/main.ts','src/hud.ts','src/hud.css','src/teaching-journey.ts','src/data/mc-ensino.json','src/town-life-layout.ts','src/world-state.ts','src/bibleui.ts']){
  const bytes=await readFile(path.join(root,file));report.sources[file]={sha256:hash(bytes),bytes:bytes.length};
}
const teachingData=JSON.parse(await readFile(path.join(root,'src/data/mc-ensino.json'),'utf8'));
const expectedTeaching=[teachingData.versiculos['Mark.1.21'].split(';').slice(1).join(';').trim(),teachingData.versiculos['Mark.1.22'].split(',')[0].trim()];
assert.ok(expectedTeaching.every(text=>text.length>0),'Teaching fixture must derive from the current BLIVRE data');
const {chromium}=createRequire(import.meta.url)('C:/Users/R2/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe';
const WAIT={timeout:45000,polling:100};

async function run(name,options){
  const dir=path.join(out,name);await mkdir(dir);
  const r={startedAt:new Date().toISOString(),passed:false,viewport:options.viewport,touch:!!options.hasTouch,
    checks:[],teleports:[],screenshots:[],console:[],errors:[],requestsFailed:[],httpErrors:[],bundles:[],blockedExternal:[],resourceDocuments:[]};
  report.runs[name]=r;let browser,page;const bundleTasks=[];
  try{
    browser=await chromium.launch({executablePath:CHROME,headless:true,timeout:30000});r.browser=browser.version();r.browserExecutable=CHROME;
    const context=await browser.newContext({...options,deviceScaleFactor:1,serviceWorkers:'block'});page=await context.newPage();
    page.setDefaultTimeout(15000);
    await page.addInitScript(()=>performance.setResourceTimingBufferSize(3000));
    // Local assets must already be prepared. Never call analytics/cloud or fetch missing remote assets during QA.
    await page.route('**/*',route=>{const requestUrl=new URL(route.request().url());
      if(requestUrl.origin===address.origin||['data:','blob:'].includes(requestUrl.protocol))return route.continue();
      if(r.blockedExternal.length<100)r.blockedExternal.push(urlLabel(requestUrl.href));return route.abort();
    });
    page.on('pageerror',e=>{if(r.errors.length<100)r.errors.push(String(e));});
    page.on('console',m=>{if(r.console.length<300)r.console.push({type:m.type(),text:m.text().slice(0,1500)});});
    page.on('requestfailed',request=>{if(r.requestsFailed.length<100)r.requestsFailed.push({url:urlLabel(request.url()),failure:request.failure()?.errorText});});
    page.on('response',response=>{
      const url=new URL(response.url());if(response.status()>=400&&r.httpErrors.length<100)r.httpErrors.push({url:urlLabel(url.href),status:response.status()});
      if(url.origin===address.origin&&url.pathname.endsWith('.js')&&bundleTasks.length<40){
        const task=response.body().then(bytes=>{assert.ok(bytes.length<32*1024*1024,'Unexpectedly large script response');r.bundles.push({url:urlLabel(url.href),status:response.status(),bytes:bytes.length,sha256:hash(bytes)});}).catch(error=>r.errors.push('Bundle hash: '+String(error)));bundleTasks.push(task);
      }
    });
    const g=(fn,arg)=>page.evaluate(fn,arg);
    const snapshot=()=>g(()=>{
      const G=window.__gta,t=id=>document.getElementById(id)?.textContent??null;
      return{player:{...G.player.pos,heading:G.player.heading,speed:G.player.speed},state:{mission:G.state.mission,phase:G.state.phase,time:G.state.time,followers:[...G.state.followers],line:G.state.line},
        actions:G.actions(),npc:G.npc(),camera:G.camera(),teaching:G.teaching(),bible:G.bible(),sub:{hidden:document.getElementById('sub').hidden,text:t('subt'),ref:t('subr')},
        controls:{actHidden:document.getElementById('act').hidden,actDisabled:document.getElementById('act').disabled,actText:t('actt'),aria:document.getElementById('act').getAttribute('aria-label'),promptText:t('promptt'),focusHidden:document.getElementById('switch-action').hidden},creditsHidden:document.getElementById('credits').hidden};
    });
    const frames=()=>g(()=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('RAF stalled')),10000);requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(timeout);resolve(true);}));}));
    const resourceSnapshot=()=>page.evaluate(()=>{const entries=performance.getEntriesByType('resource').map(e=>({url:new URL(e.name,location.href).origin+new URL(e.name,location.href).pathname,type:e.initiatorType,durationMs:e.duration,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize}));return{timeOrigin:performance.timeOrigin,entries,count:entries.length,transferBytes:entries.reduce((n,e)=>n+e.transferSize,0),encodedBodyBytes:entries.reduce((n,e)=>n+e.encodedBodySize,0),decodedBodyBytes:entries.reduce((n,e)=>n+e.decodedBodySize,0),zeroTransferEntries:entries.filter(e=>e.transferSize===0).length};});
    const collectResources=async()=>{const current=await resourceSnapshot(),index=r.resourceDocuments.findIndex(d=>d.timeOrigin===current.timeOrigin);if(index<0)r.resourceDocuments.push(current);else r.resourceDocuments[index]=current;};
    const press=selector=>r.touch?page.locator(selector).tap():page.locator(selector).click();
    const act=async()=>{if(r.touch)await press('#act');else{await page.locator('#c').click({position:{x:Math.floor(options.viewport.width*.55),y:Math.floor(options.viewport.height*.45)}});await page.keyboard.press('KeyE');}};
    const focus=async()=>{if(r.touch)await press('#switch-action');else{await page.locator('#c').click({position:{x:Math.floor(options.viewport.width*.55),y:Math.floor(options.viewport.height*.45)}});await page.keyboard.press('KeyQ');}};
    const waitReceiver=(to,id=null)=>page.waitForFunction(({to,id})=>{const a=window.__gta.actions();return a.receiver.to===to&&a.shown.to===to&&a.receiver.label===a.shown.label&&(id===null||a.receiver.id===id&&a.shown.id===id);},{to,id},WAIT);
    async function check(label,fn){console.log(`[${name}] ${label}`);const start=performance.now();try{const result=await fn();r.checks.push({label,passed:true,durationMs:performance.now()-start,result});}catch(error){r.checks.push({label,passed:false,durationMs:performance.now()-start,error:String(error)});throw error;}}
    async function shot(label){const filename=`${label}.png`,file=path.join(dir,filename);const bytes=await page.screenshot({path:file,fullPage:false,timeout:15000});r.screenshots.push({file:`${name}/${filename}`,sha256:hash(bytes),bytes:bytes.length,state:await snapshot()});}
    async function teleport(x,z,heading,reason){const before=await g(()=>({...window.__gta.player.pos}));await g(p=>window.__gta.teleport(p.x,p.z,p.heading),{x,z,heading});await frames();r.teleports.push({reason,method:'DEBUG TELEPORT — placement only, not walking evidence',before,to:{x,z,heading}});}
    async function moveReal(forward,seconds){
      const before=await snapshot(),until=before.state.time+seconds;
      if(r.touch){
        const box=await page.locator('#joy').boundingBox();assert.ok(box&&box.width>0);const x=box.x+box.width/2,y=box.y+box.height/2;
        const cdp=await context.newCDPSession(page);
        try{await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-forward*box.height*.34,id:1}]});
          await page.waitForFunction(t=>window.__gta.state.time>=t,until,{timeout:20000,polling:50});
        }finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
      }else{
        await page.locator('#c').click({position:{x:Math.floor(options.viewport.width*.55),y:Math.floor(options.viewport.height*.45)}});
        const key=forward>0?'KeyW':'KeyS';await page.keyboard.down(key);
        try{await page.waitForFunction(t=>window.__gta.state.time>=t,until,{timeout:20000,polling:50});}finally{await page.keyboard.up(key);}
      }
      await frames();const after=await snapshot();return{method:r.touch?'Browser touch input on joystick (CDP), no direct movement mutation':'Real browser WASD input',before:before.player,after:after.player,meters:Math.hypot(after.player.x-before.player.x,after.player.z-before.player.z),gameSeconds:after.state.time-before.state.time};
    }
    async function stageSimao(reason){
      const nav=await g(()=>window.__gta.npc().navigation);assert.ok(nav?.pos,'Physical Simão must have loaded');
      const points=await g(({x,z})=>{
        const G=window.__gta,list=[];
        for(const radius of [1.7,2.1])for(const i of [6,0,1,2,3,4,5,7,8,9,10,11]){
          const angle=i*Math.PI/6,dx=Math.sin(angle),dz=Math.cos(angle),px=x+dx*radius,pz=z+dz*radius;
          // Reserve a short clear retreat for the real departure-input test. This check is only the game's exposed collision query.
          if([0,.4,.8,1.2,1.6,2,2.4].every(d=>!G.blocked(px+dx*d,pz+dz*d)))list.push({x:px,z:pz,heading:Math.atan2(x-px,-(z-pz))});
        }return list;
      },nav.pos);assert.ok(points.length,'No unblocked nearby staging points');
      for(const point of points){await teleport(point.x,point.z,point.heading,reason);const current=await snapshot();
        if(current.actions.candidates.some(t=>t.id==='talk:simao')&&current.state.mission===1&&current.actions.receiver.to==='mission')return current;
      }
      throw Error('No nearby placement exposes both real Simão conversation and mission action; see logged teleports');
    }

    await check('startup and real Go',async()=>{
      await page.goto(address.href,{waitUntil:'domcontentloaded',timeout:60000});
      await page.waitForFunction(()=>window.__gta?.actions&&document.getElementById('go')&&!document.getElementById('go').disabled,null,{timeout:120000,polling:150});
      r.entryScripts=await g(()=>[...document.querySelectorAll('script[type="module"][src]')].map(s=>s.src));
      assert.ok(r.entryScripts.some(url=>new URL(url).pathname.startsWith('/assets/')),'Use the built bundle, not the Vite dev source tree');
      await press('#go');await page.waitForFunction(()=>window.__gta.state.phase==='play',null,WAIT);
      r.backend=await g(()=>({backend:window.__gta.backend,quality:window.__gta.quality,heroSource:window.__gta.heroSource,viewport:[innerWidth,innerHeight],pixelRatio:devicePixelRatio,session:window.__gta.session()}));
      await shot('01-started');return{clicked:'Go',...r.backend};
    });
    await check(r.touch?'joystick movement smoke':'W movement smoke',async()=>{const moved=await moveReal(1,.65);assert.ok(moved.meters>.15,'Real input must move the hero');await shot('02-movement');return moved;});
    await check('stage mission and physical Simão; mission has default priority',async()=>{
      const beach=await g(()=>window.__gta.meta.points.beach);await teleport(beach[0],beach[1],0,'Stage beach reach — not a walked route');
      await page.waitForFunction(()=>window.__gta.state.mission===1&&window.__gta.state.phase==='play',null,WAIT);
      await page.waitForFunction(()=>window.__gta.npc().status==='ready'&&window.__gta.npc().navigation,null,{timeout:90000,polling:150});
      const staged=await stageSimao('Stage nearby physical actor, LOS/range supplied by runtime candidates');
      await waitReceiver('mission');assert.equal(staged.actions.focus,null);assert.equal(staged.actions.receiver.label,staged.controls.actText);assert.equal(staged.controls.focusHidden,false);
      await shot('03-mission-priority');return{mission:staged.state.mission,receiver:staged.actions.receiver,actor:staged.npc.navigation.pos};
    });
    await check(r.touch?'touch selects dialogue instead of mission':'Q selects dialogue instead of mission',async()=>{
      await focus();await waitReceiver('target','talk:simao');const selected=await snapshot();assert.equal(selected.state.mission,1);assert.equal(selected.state.followers.length,0);
      await act();await page.waitForFunction(()=>window.__gta.actions().conversation?.index===0,null,WAIT);await waitReceiver('ongoing');
      const started=await snapshot();assert.equal(started.state.phase,'play');assert.equal(started.state.followers.length,0);assert.match(started.sub.ref,/SIMÃO.*NARRATIVA DO JOGO/i);assert.equal(started.sub.text,started.actions.conversation.text);
      await shot('04-conversation');return started.actions;
    });
    await check('Credits pauses dialogue and E; closing preserves the same line',async()=>{
      const original=await snapshot();await press('#credbtn');await page.waitForFunction(()=>!document.getElementById('credits').hidden,null,WAIT);await frames();
      const paused=await snapshot();assert.equal(paused.actions.conversation.index,original.actions.conversation.index);
      // Explicit focus-only test setup: blur the opener while leaving Credits open. Input ignores E on buttons,
      // so allowing the Credits button to retain focus would give a false pass even without actual suspension.
      const focusSetup=await g(()=>{const before=document.activeElement?.tagName;if(document.activeElement instanceof HTMLElement)document.activeElement.blur();
        const after=document.activeElement?.tagName;window.__contextQaKey=null;
        const capture=event=>{if(event.code!=='KeyE')return;window.__contextQaKey={code:event.code,target:event.target?.tagName,excluded:!!event.target?.closest?.('input,textarea,select,button,a,[contenteditable]')};removeEventListener('keydown',capture,true);};
        addEventListener('keydown',capture,true);return{method:'Focus-only DOM blur; no gameplay state mutation or modal close',before,after};});
      assert.ok(['BODY','CANVAS'].includes(focusSetup.after),'E must be delivered outside a focused control');
      await page.keyboard.press('KeyE');await frames();const keyTarget=await g(()=>window.__contextQaKey),after=await snapshot();
      assert.ok(keyTarget&&['BODY','CANVAS'].includes(keyTarget.target));assert.equal(keyTarget.excluded,false);
      assert.equal(after.state.time,paused.state.time);assert.deepEqual(after.player,paused.player);assert.deepEqual(after.actions.conversation,paused.actions.conversation);assert.equal(after.actions.receiver.to,'none');assert.equal(after.controls.actHidden,true);
      await shot('05-credits-paused');await press('#credclose');await page.waitForFunction(()=>document.getElementById('credits').hidden,null,WAIT);await waitReceiver('ongoing');
      const resumed=await snapshot();assert.deepEqual(resumed.actions.conversation,original.actions.conversation);return{focusSetup,keyTarget,before:original.actions.conversation,paused:after.actions.conversation,resumed:resumed.actions.conversation};
    });
    await check('continue then end uses real input without advancing the mission',async()=>{
      await act();await page.waitForFunction(()=>window.__gta.actions().conversation?.index===1,null,WAIT);await waitReceiver('ongoing');
      const second=await snapshot();assert.equal(second.actions.receiver.label,'Encerrar conversa');assert.equal(second.state.mission,1);assert.equal(second.state.followers.length,0);await shot('06-second-line');
      await act();await page.waitForFunction(()=>window.__gta.actions().conversation===null,null,WAIT);const ended=await snapshot();assert.equal(ended.state.mission,1);assert.equal(ended.state.phase,'play');assert.equal(ended.state.followers.length,0);return{second:second.actions,after:ended.actions};
    });
    await check('real movement away dismisses optional conversation',async()=>{
      // A modal suspends candidates and clears the optional selection. After ending that conversation, the
      // mission correctly regains default priority: select the nearby conversation again through real input.
      const prior=await snapshot();if(prior.actions.receiver.to==='mission')await focus();
      await waitReceiver('target','talk:simao');await act();await page.waitForFunction(()=>window.__gta.actions().conversation?.index===0,null,WAIT);
      const moved=await moveReal(-1,r.touch?1.5:1.1);assert.ok(moved.meters>.4);await page.waitForFunction(()=>window.__gta.actions().conversation===null,null,WAIT);
      await shot('07-left-conversation');return{selectedAgain:prior.actions.receiver.to==='mission',...moved};
    });
    await check('return to default mission and E/tap triggers Scripture only',async()=>{
      await stageSimao('Restage both choices after real departure; no narrative state mutation');await waitReceiver('mission');await act();
      await page.waitForFunction(()=>window.__gta.state.phase==='line',null,WAIT);const called=await snapshot();assert.equal(called.actions.conversation,null);assert.equal(called.actions.receiver.to,'none');assert.ok(called.state.followers.includes('simao'));assert.match(called.sub.ref,/BÍBLIA LIVRE/);assert.equal(called.sub.text,`“${called.state.line.texto}”`);
      await shot('08-scripture');await page.waitForFunction(()=>window.__gta.state.mission===2&&window.__gta.state.phase==='play',null,WAIT);return{line:called.state.line,followers:called.state.followers};
    });
    await check('last mission with real action, exploration button and staged return to town',async()=>{
      assert.equal((await g(()=>window.__gta.bible())).read,-1,'No prior Bible reading is required');
      const goal=await g(()=>window.__gta.goals[2]);assert.equal(goal.kind,'call');await teleport(goal.at.x,goal.at.z,0,'Stage final mission goal — not a walked beach route');
      await waitReceiver('mission');await act();await page.waitForFunction(()=>window.__gta.state.phase==='line',null,WAIT);
      const last=await snapshot();assert.equal(last.actions.conversation,null);assert.equal(last.sub.text,`“${last.state.line.texto}”`);assert.match(last.sub.ref,/BÍBLIA LIVRE/);
      await page.waitForFunction(()=>window.__gta.state.phase==='done'&&!document.getElementById('end').hidden,null,{timeout:90000,polling:100});await shot('09-episode-completed');
      await press('#roam');await page.waitForFunction(()=>window.__gta.roam().phase==='return',null,WAIT);
      const back=await g(()=>window.__gta.roam().goal.at);await teleport(back.x,back.z,0,'Stage epilogue return to village — not a walked return');
      await page.waitForFunction(()=>window.__gta.roam().phase==='free'&&window.__gta.teaching().state.phase==='walk',null,{timeout:90000,polling:100});
      const entered=await snapshot();assert.ok(entered.teaching.layout?.teaching?.court);assert.equal(entered.bible.read,-1);assert.equal(entered.teaching.record.encounters['ensino-cafarnaum'].stage,'accepted');
      await shot('10-teaching-walk');return{lastLine:last.state.line,teaching:entered.teaching,bibleReadBeforeTeaching:entered.bible.read};
    });
    await check('teaching uses actual layout and Scripture without prior Bible gate',async()=>{
      const court=await g(()=>window.__gta.teaching().layout.teaching.court);await teleport(court.x,court.z,0,'Stage computed teaching courtyard — street traversal is tested separately');
      await page.waitForFunction(()=>window.__gta.teaching().state.phase==='ready',null,WAIT);await waitReceiver('mission');
      const ready=await snapshot();assert.equal(ready.actions.receiver.label,'Ensinar');assert.equal(ready.controls.actText,'Ensinar');assert.equal(ready.bible.read,-1);
      await shot('11-teaching-ready');await act();await page.waitForFunction(()=>window.__gta.teaching().state.phase==='line'&&window.__gta.teaching().state.index===0,null,WAIT);
      const begun=await snapshot();assert.equal(begun.teaching.state.line.texto,expectedTeaching[0]);assert.equal(begun.sub.text,`“${expectedTeaching[0]}”`);assert.match(begun.sub.ref,/BÍBLIA LIVRE.*Marcos 1:21/i);assert.equal(begun.actions.receiver.to,'none');
      await shot('12-teaching-scripture');return{before:ready.actions,firstLine:begun.teaching.state.line,bibleReadBeforeOpening:begun.bible.read};
    });
    await check('Bible pauses teaching time; B closes and same clause resumes',async()=>{
      // Desktop uses the actual B shortcut; touch uses the on-screen objective to open, then the actual close button.
      if(r.touch)await press('#obj');else await page.keyboard.press('KeyB');
      await page.waitForFunction(()=>window.__gta.bible().open,null,WAIT);await frames();const paused=await snapshot();
      assert.equal(paused.teaching.state.phase,'line');assert.equal(paused.teaching.state.index,0);assert.ok(paused.teaching.state.lineLeft>0);
      await press('#bible-heading');await page.keyboard.press('KeyE');await page.waitForTimeout(1100);await frames();const still=await snapshot();
      assert.deepEqual(still.teaching.state,paused.teaching.state);assert.deepEqual(still.player,paused.player);assert.equal(still.actions.receiver.to,'none');
      assert.equal(await page.locator('#bible-next-ref').textContent(),teachingData.ref_pt);await shot('13-bible-paused-teaching');
      if(r.touch)await press('#bible-close');else await page.keyboard.press('KeyB');
      await page.waitForFunction(()=>!window.__gta.bible().open,null,WAIT);await frames();const resumed=await snapshot();
      assert.equal(resumed.teaching.state.phase,'line');assert.equal(resumed.teaching.state.index,paused.teaching.state.index);assert.deepEqual(resumed.teaching.state.line,paused.teaching.state.line);
      assert.ok(resumed.teaching.state.lineLeft<=paused.teaching.state.lineLeft&&resumed.teaching.state.lineLeft>paused.teaching.state.lineLeft-.5,'Only the actual resumed frames may decrement the timer');
      return{openMethod:r.touch?'Objective tap':'B',closeMethod:r.touch?'Voltar ao jogo tap':'B',paused:paused.teaching.state,still:still.teaching.state,resumed:resumed.teaching.state};
    });
    await check('teaching finishes, saves completion and points at an actual chosen house',async()=>{
      await page.waitForFunction(()=>window.__gta.teaching().state.phase==='line'&&window.__gta.teaching().state.index===1,null,{timeout:90000,polling:100});
      const response=await snapshot();assert.equal(response.teaching.state.line.texto,expectedTeaching[1]);assert.equal(response.sub.text,`“${expectedTeaching[1]}”`);assert.match(response.sub.ref,/BÍBLIA LIVRE.*Marcos 1:22/i);await shot('14-teaching-response');
      await page.waitForFunction(()=>window.__gta.teaching().state.phase==='done',null,{timeout:90000,polling:100});const done=await snapshot();
      assert.equal(done.teaching.storage,'ok');assert.equal(done.teaching.record.encounters['ensino-cafarnaum'].stage,'completed');assert.ok(Number.isInteger(done.teaching.layout.onward?.house),'Onward destination must reference a real house index');
      assert.deepEqual(done.teaching.view.goal,done.teaching.layout.onward.at);assert.deepEqual(done.teaching.layout.teaching.onward,done.teaching.layout.onward.at);assert.ok(done.teaching.view.dist>0);
      assert.equal(done.teaching.view.announce.texto,teachingData.depois.texto);assert.match(done.teaching.view.guidance,/cena.*preparação/i);assert.equal(done.actions.receiver.to,'none');
      const persisted=await g(()=>{const record=window.__gta.teaching().record;return JSON.parse(localStorage.getItem(`gta:world-state:v${record.v}:${record.saveId}`));});
      assert.equal(persisted.encounters['ensino-cafarnaum'].stage,'completed');assert.equal(persisted.saveId,done.teaching.record.saveId);r.completedTeachingRecord=persisted;
      await shot('15-teaching-completed');return{record:persisted,view:done.teaching.view,onward:done.teaching.layout.onward};
    });
    await check('five-second renderer frame sample',async()=>{
      r.performance=await g(()=>new Promise((resolve,reject)=>{
        const samples=[],first=performance.now(),timeout=setTimeout(()=>reject(Error('FPS sample stalled')),15000);let last=first;
        function tick(now){samples.push(now-last);last=now;if(now-first<5000){requestAnimationFrame(tick);return;}
          clearTimeout(timeout);const sorted=[...samples].sort((a,b)=>a-b),at=q=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*q))];
          resolve({method:'RAF intervals while the actual game renders; idle at teaching courtyard after staged completion',elapsedMs:now-first,frames:samples.length,fps:samples.length*1000/(now-first),frameMsP50:at(.5),frameMsP95:at(.95),frameMsMax:sorted.at(-1),gameFpsLog:window.__gta.fpsLog.slice(-8),rendererInfo:window.__gta.info(),camera:window.__gta.camera(),backend:window.__gta.backend});
        }requestAnimationFrame(tick);
      }));assert.ok(r.performance.elapsedMs>=5000&&r.performance.frames>0);return r.performance;
    });
    await check('reload and real Explore button preserve completed teaching',async()=>{
      await collectResources();await page.reload({waitUntil:'domcontentloaded',timeout:60000});
      await page.waitForFunction(()=>window.__gta?.teaching&&!document.getElementById('go').disabled&&!document.getElementById('novo').hidden,null,{timeout:120000,polling:150});
      assert.match(await page.locator('#novo').textContent(),/Explorar a região/);await press('#novo');
      await page.waitForFunction(()=>window.__gta.roam().phase==='free'&&window.__gta.teaching().state.phase==='done',null,WAIT);const restored=await snapshot();
      assert.equal(restored.teaching.record.saveId,r.completedTeachingRecord.saveId);assert.deepEqual(restored.teaching.record.encounters['ensino-cafarnaum'],r.completedTeachingRecord.encounters['ensino-cafarnaum']);
      assert.equal(restored.teaching.state.line,null);assert.equal(restored.teaching.state.intro,false);assert.equal(restored.bible.read,-1,'Reading is optional even after reloading completion');assert.equal(restored.teaching.view.action,null);
      await shot('16-reloaded-completion');await collectResources();return{button:'Explorar a região (#novo)',teaching:restored.teaching,bible:restored.bible};
    });
    assert.equal(r.errors.length,0,'Page/runtime or bundle-hash errors');assert.equal(r.httpErrors.length,0,'HTTP errors');
    const consoleErrors=r.console.filter(entry=>entry.type==='error');assert.equal(consoleErrors.length,0,'Console errors; retained in report');
    await Promise.all(bundleTasks);
    for(const script of r.entryScripts)assert.ok(r.bundles.some(bundle=>bundle.url===urlLabel(script)&&bundle.status===200),'Entry bundle must have an observed SHA-256');
    assert.equal(r.errors.length,0);r.passed=true;
  }catch(error){r.error=String(error);if(page){try{const bytes=await page.screenshot({fullPage:false,timeout:10000});await writeFile(path.join(dir,'failure.png'),bytes,{flag:'wx'});r.failureScreenshot={file:`${name}/failure.png`,sha256:hash(bytes),bytes:bytes.length};}catch(e){r.failureScreenshotError=String(e);}}}
  finally{
    if(page){try{const current=await page.evaluate(()=>{const entries=performance.getEntriesByType('resource').map(e=>({url:new URL(e.name,location.href).origin+new URL(e.name,location.href).pathname,type:e.initiatorType,durationMs:e.duration,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize}));return{timeOrigin:performance.timeOrigin,entries,count:entries.length,transferBytes:entries.reduce((n,e)=>n+e.transferSize,0),encodedBodyBytes:entries.reduce((n,e)=>n+e.encodedBodySize,0),decodedBodyBytes:entries.reduce((n,e)=>n+e.decodedBodySize,0),zeroTransferEntries:entries.filter(e=>e.transferSize===0).length};});
      const index=r.resourceDocuments.findIndex(d=>d.timeOrigin===current.timeOrigin);if(index<0)r.resourceDocuments.push(current);else r.resourceDocuments[index]=current;
      r.resources={documents:r.resourceDocuments.length,transferBytes:r.resourceDocuments.reduce((n,d)=>n+d.transferBytes,0),encodedBodyBytes:r.resourceDocuments.reduce((n,d)=>n+d.encodedBodyBytes,0),decodedBodyBytes:r.resourceDocuments.reduce((n,d)=>n+d.decodedBodyBytes,0),scope:'Per-document snapshots retained across the single reload; browser-reported totals including cache reuse, not unique network payload.'};
    }catch(error){r.resourcesError=String(error);}}
    // Closing cancels unfinished response bodies on a failed/stalled page before waiting on their hashes.
    try{await browser?.close();}catch(error){r.closeError=String(error);r.passed=false;}await Promise.allSettled(bundleTasks);
    r.finishedAt=new Date().toISOString();await writeFile(path.join(dir,'report.json'),JSON.stringify(r,null,2)+'\n',{flag:'wx'});
  }
  console.log(JSON.stringify({profile:name,passed:r.passed,checks:r.checks.length,error:r.error}));
}

try{
  // Sequential browser instances; never overlap two GPU rendering workloads.
  await run('desktop',{viewport:{width:1280,height:800},hasTouch:false,isMobile:false});
  await run('touch',{viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  report.sourceStable=true;for(const [file,source]of Object.entries(report.sources))if(hash(await readFile(path.join(root,file)))!==source.sha256){report.sourceStable=false;}
  report.passed=Object.values(report.runs).every(run=>run.passed)&&report.sourceStable;
}catch(error){report.error=String(error);}
report.finishedAt=new Date().toISOString();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
if(!report.passed)process.exitCode=1;
console.log(JSON.stringify({out,passed:report.passed,sourceStable:report.sourceStable,profiles:Object.fromEntries(Object.entries(report.runs).map(([name,run])=>[name,{passed:run.passed,checks:run.checks.length,fps:run.performance?.fps}]))}));
