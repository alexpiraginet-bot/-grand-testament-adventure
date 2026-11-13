// Visual evidence for support/animation; does not automatically approve contact or gait.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const base=new URL(process.argv[2]||'http://127.0.0.1:4191/');base.searchParams.set('debug','1');
const out=process.argv[3]||'shots/fauna-r8-support',kind=process.argv.find(a=>a.startsWith('--kind='))?.slice(7)||'chicken';
mkdirSync(out,{recursive:true});
const report={startedAt:new Date().toISOString(),url:base.href,kind,limits:['Debug player/camera staging; no animal coordinate assignment. DPR 2 captures are not performance benchmarks.','Visual review required; exact mesh-foot contact is not inferred from root-height diagnostics.'],errors:[],consoleErrors:[],httpErrors:[],samples:[],screenshots:[]};
const browser=await pw.chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:2});
const page=await context.newPage();page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});page.on('response',r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});
await context.route('**/*',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
try{
 await page.goto(base.href,{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>window.__gta?.loading().state==='ready',null,{timeout:120000});await page.locator('#go').click();
 await page.waitForFunction(kind=>window.__gta.fauna().status==='ready'&&window.__gta.fauna().visible.some(a=>a.kind===kind),kind,{timeout:75000});
 const stage=await page.evaluate(kind=>{
  const g=window.__gta,all=g.fauna().visible.filter(a=>a.kind===kind);
  const chickens=g.fauna().visible.filter(a=>a.kind==='chicken');
  if(kind==='donkey')all.sort((a,b)=>Math.min(...chickens.map(c=>Math.hypot(a.x-c.x,a.z-c.z)))-Math.min(...chickens.map(c=>Math.hypot(b.x-c.x,b.z-c.z))));
  const a=all.find(a=>a.id==='fauna:92471:-1:0:chicken:2')??all[0];if(!a)throw Error('Requested species not generated');
  for(let i=0;i<16;i++){const angle=i*Math.PI/8,x=a.x+Math.sin(angle)*2.4,z=a.z+Math.cos(angle)*2.4;
   if(!g.blocked(x,z,false)){g.teleport(x,z,Math.atan2(a.x-x,-(a.z-z)));g.cam.yaw+=.72;g.cam.dist=3.2;g.cam.pitch=.25;return{animal:a,player:{x,z},cam:{...g.cam}};}}
  throw Error('No clear player staging point');
 },kind);report.stage=stage;
 await page.waitForFunction(id=>{const f=window.__gta.fauna(),a=f.visible.find(a=>a.id===id),rig=f.renderer.actors.find(a=>a.id===id);return a?.speed>.02&&rig?.weight>.1;},stage.animal.id,{timeout:25000});
 for(let i=0;i<8;i++){
  await page.waitForTimeout(360);report.samples.push(await page.evaluate(()=>({time:window.__gta.state.time,fauna:window.__gta.fauna()})));
  const file=`${kind}-phase-${i}.png`;await page.screenshot({path:`${out}/${file}`});report.screenshots.push(file);
  // A native browser screenshot clip preserves the actual rendered pixels, with no AI/editor enlargement.
  if(i===0||i===4){const detail=`${kind}-contact-detail-${i}.png`;await page.screenshot({path:`${out}/${detail}`,clip:{x:250,y:300,width:780,height:460}});report.screenshots.push(detail);}
 }
 await page.waitForFunction(id=>{const f=window.__gta.fauna(),a=f.visible.find(a=>a.id===id),rig=f.renderer.actors.find(a=>a.id===id);return a?.speed===0&&rig?.weight<.01;},stage.animal.id,{timeout:25000});
 for(let i=0;i<3;i++){await page.waitForTimeout(300);report.samples.push({label:`idle-${i}`,awaitedAnimalId:stage.animal.id,...await page.evaluate(()=>({time:window.__gta.state.time,fauna:window.__gta.fauna()}))});const file=`${kind}-idle-${i}.png`;await page.screenshot({path:`${out}/${file}`});report.screenshots.push(file);}
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;}
finally{await context.close();await browser.close();report.finishedAt=new Date().toISOString();writeFileSync(`${out}/${kind}-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({kind,errors:report.errors,consoleErrors:report.consoleErrors,httpErrors:report.httpErrors,failure:report.failure,files:report.screenshots.length}));}
