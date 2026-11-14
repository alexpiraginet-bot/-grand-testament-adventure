// Authorial CPU-only browser test of the real input sources. No game renderer/GPU.
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const relative=process.argv[2]??'shots/context-input-r15-first';
assert.match(relative,/^shots\/context-input-r15-[a-z0-9-]+$/);
const out=path.resolve(root,relative);assert.ok(out.startsWith(root+path.sep));await mkdir(out,{recursive:false});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={startedAt:new Date().toISOString(),passed:false,scope:'Real Input+joystick modules in isolated CPU Chrome; not gameplay, Safari or physical screen-reader validation',launchArgs:['--disable-gpu','--disable-features=WebGPU'],sources:{},checks:[],errors:[]};
let browser;
try{
  const sources={};for(const name of ['src/input.ts','src/joystick.ts','tools/check_context_input_r15.mjs']){
    const bytes=await readFile(path.join(root,name));report.sources[name]={sha256:hash(bytes),bytes:bytes.length};sources[name]=bytes.toString('utf8');
  }
  const input=sources['src/input.ts'];assert.equal(input.split('\n').filter(line=>line.startsWith('import ')).length,1);
  assert.match(input,/from "\.\/joystick\.ts"/);
  const executable=stripTypeScriptTypes(sources['src/joystick.ts']+'\n'+input.split('\n').filter(line=>!line.startsWith('import ')).join('\n'));
  const pw=createRequire(import.meta.url)('C:/Users/R2/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  browser=await pw.chromium.launch({channel:'chrome',headless:true,args:report.launchArgs,timeout:30000});report.browser=browser.version();
  const page=await browser.newPage({viewport:{width:1280,height:800},serviceWorkers:'block'});
  page.on('pageerror',error=>report.errors.push(String(error)));await page.route('**/*',route=>route.abort());
  await page.setContent('<!doctype html><html lang="pt-BR"><body tabindex="-1"><canvas id="c"></canvas><div id="joy"><div id="knob"></div></div><button id="act" type="button">Continuar conversa</button></body></html>');
  await page.addScriptTag({type:'module',content:executable+`
    window.controls=new Input(document.getElementById('c'),document.getElementById('joy'),document.getElementById('knob'),document.getElementById('act'));
    window.trace=[];
    for(const type of ['keydown','keyup','click','pointerdown','pointerup'])addEventListener(type,e=>window.trace.push({type:e.type,target:e.target.id||e.target.tagName,code:e.code,key:e.key,repeat:e.repeat,detail:e.detail,defaultPrevented:e.defaultPrevented}));
  `});
  const take=()=>page.evaluate(()=>window.controls.takeAction());
  const reset=async()=>page.evaluate(()=>{window.controls.setSuspended(true);window.controls.setSuspended(false);document.body.focus();});
  async function check(name,run){
    await reset();const start=await page.evaluate(()=>window.trace.length);
    try{await run();report.checks.push({name,passed:true,events:await page.evaluate(start=>window.trace.slice(start),start)});}
    catch(error){report.checks.push({name,passed:false,error:String(error),events:await page.evaluate(start=>window.trace.slice(start),start)});throw error;}
  }
  for(const key of ['Enter','Space','NumpadEnter'])await check(`focused button: ${key} once, repeated down, release, fresh press`,async()=>{
    await page.locator('#act').focus();await page.keyboard.down(key);assert.equal(await take(),true);assert.equal(await take(),false);
    // The intervening read mimics separate game frames: a boolean queue alone is not sufficient.
    await page.keyboard.down(key);assert.equal(await take(),false,'repeat must not queue another native click');
    await page.keyboard.up(key);assert.equal(await take(),false,'release must not create an extra action');
    await page.keyboard.down(key);assert.equal(await take(),true);await page.keyboard.up(key);assert.equal(await take(),false);
  });
  for(const key of ['KeyE','Enter'])await check(`world shortcut: ${key} rejects autorepeat`,async()=>{
    await page.keyboard.down(key);assert.equal(await take(),true);await page.keyboard.down(key);assert.equal(await take(),false);await page.keyboard.up(key);assert.equal(await take(),false);
  });
  await check('pointerdown and its later native click consume once',async()=>{
    const box=await page.locator('#act').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
    await page.mouse.down();assert.equal(await take(),true);await page.mouse.up();assert.equal(await take(),false);
  });
  await check('standalone detail-zero activation remains available to assistive click path',async()=>{
    await page.evaluate(()=>document.getElementById('act').click());assert.equal(await take(),true);assert.equal(await take(),false);
  });
  await check('suspension discards queued controls and ignores keys or assistive click',async()=>{
    await page.evaluate(()=>{window.controls.queueAction();window.controls.queueFocus();window.controls.setSuspended(true);});assert.equal(await take(),false);assert.equal(await page.evaluate(()=>window.controls.takeFocus()),false);
    await page.locator('#act').focus();await page.keyboard.down('Enter');await page.keyboard.up('Enter');assert.equal(await take(),false);
    await page.evaluate(()=>document.getElementById('act').click());assert.equal(await take(),false);
  });
  await check('Q focus shortcut consumes once and rejects autorepeat',async()=>{
    await page.keyboard.down('KeyQ');assert.equal(await page.evaluate(()=>window.controls.takeFocus()),true);
    await page.keyboard.down('KeyQ');assert.equal(await page.evaluate(()=>window.controls.takeFocus()),false);await page.keyboard.up('KeyQ');assert.equal(await take(),false);
  });
  assert.equal(report.errors.length,0);
  for(const [name,source] of Object.entries(report.sources))assert.equal(hash(await readFile(path.join(root,name))),source.sha256,'Source changed during CPU test: '+name);
  report.passed=true;
}catch(error){report.error=String(error);process.exitCode=1;}
finally{
  try{await browser?.close();}catch(error){report.closeError=String(error);report.passed=false;process.exitCode=1;}
  report.finishedAt=new Date().toISOString();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
}
console.log(JSON.stringify({out,passed:report.passed,checks:report.checks.length,error:report.error,sources:report.sources}));
