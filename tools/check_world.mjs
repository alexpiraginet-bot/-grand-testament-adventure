// Examine the denser scene, test the actual collision predicate along all land routes.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const base=process.argv[2]||'http://localhost:4173/',out=process.argv[3]||'shots/world-r1';
mkdirSync(out,{recursive:true});const reports=[];
for(const [name,viewport] of [['pc',{width:1280,height:800}],['mobile',{width:390,height:844}]]){
 const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
 try {
  const page=await browser.newPage({viewport,hasTouch:name==='mobile',deviceScaleFactor:name==='mobile'?2:1}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${base}?debug`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__gta?.actor());await page.click('#go');
  const route=await page.evaluate(()=>{
   const g=window.__gta,blocked=[];
   for(const s of g.routes){const dx=s.bx-s.ax,dz=s.bz-s.az,l=Math.hypot(dx,dz);
    for(let i=0;i<=Math.ceil(l);i++)for(const side of [-.8,0,.8]){
     const x=s.ax+dx*i/Math.ceil(l)+dz/l*side,z=s.az+dz*i/Math.ceil(l)-dx/l*side;
     if(g.blocked(x,z,false))blocked.push({x,z});
    }
   }
   return {world:g.world,segments:g.routes.length,blocked};
  });
  assert.deepEqual(route.blocked,[],'The actual game collision must allow the route');
  const scenes=[];
  for(const [label,x,z,yaw] of [['vila',-9.1,35.1,Math.PI],['patios',-9.1,35.1,-Math.PI/2],['caminho',-10.1,180,Math.PI],['margem',-204.5,433.8,-Math.PI/2]]) {
   await page.evaluate(({x,z,yaw})=>window.__gta.teleport(x,z,yaw),{x,z,yaw});await page.waitForTimeout(2800);
   await page.screenshot({path:`${out}/${name}-${label}.png`});
   scenes.push({label,...await page.evaluate(()=>({fps:window.__gta.fpsLog.slice(-2),render:window.__gta.info()}))});
  }
  assert.deepEqual(errors,[]);reports.push({name,viewport,...route,scenes,errors});
  writeFileSync(`${out}/report.json`,JSON.stringify({reports,note:'Real Chrome on the PC; mobile viewport, not a physical phone. Collision path samples and scene captures use debug hooks; solid scenery/water collision checked, NPC interaction endpoint occupancy excluded.'},null,2));
 }finally{await browser.close();}
}
console.log(JSON.stringify(reports,null,2));
