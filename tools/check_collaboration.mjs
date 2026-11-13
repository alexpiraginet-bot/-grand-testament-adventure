// Built-game regression. Real plan/ledger data; GitHub window.open is captured, never published.
// Run sequentially with other GPU/browser checks: node tools/check_collaboration.mjs URL OUTPUT_DIR
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {parseProjectPlan,projectPlanTotals,formatPlanCents} from '../src/project-plan.ts';
import {accountabilityTotals} from '../src/accountability.ts';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const base=new URL(process.argv[2]||'http://127.0.0.1:4173/');base.searchParams.set('debug','1');
const out=process.argv[3]||'shots/collaboration';mkdirSync(out,{recursive:true});
const planText=readFileSync(new URL('../src/data/project-plan.json',import.meta.url),'utf8');
const ledgerText=readFileSync(new URL('../src/data/accountability.json',import.meta.url),'utf8');
const plan=parseProjectPlan(JSON.parse(planText)),totals=projectPlanTotals(plan),ledgerTotals=accountabilityTotals(JSON.parse(ledgerText));
const hash=text=>createHash('sha256').update(text).digest('hex');
const normalize=text=>text.replace(/\s+/g,' ').trim();
const num=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1});
const tabs=['ideas','support','volunteer'];
const report={tests:[],planSha256:hash(planText),ledgerSha256:hash(ledgerText),syntheticPlan:false,
  note:'Chromium on PC; 390×844 uses viewport/touch emulation, not a physical phone. Plan and ledger are real repository data compared to the built UI. Volunteer input is a synthetic QA draft. window.open is mocked; all attempted non-GET/HEAD requests are blocked and fail the check. No issue, application or payment is submitted. Draft persistence is tested only across tabs and dialog reopening, not page reloads.'};

async function selectedTab(page,name) {
  for(const candidate of tabs){
    const selected=candidate===name,tab=page.locator(`#community-${candidate}-tab`),panel=page.locator(`#community-${candidate}`);
    assert.equal(await tab.getAttribute('aria-selected'),String(selected));
    assert.equal(await tab.getAttribute('tabindex'),selected?'0':'-1');
    assert.equal(await tab.getAttribute('aria-controls'),`community-${candidate}`);
    assert.equal(await panel.isVisible(),selected);
    assert.equal(await panel.getAttribute('aria-labelledby'),`community-${candidate}-tab`);
  }
}

async function layoutFits(page) {
  const layout=await page.locator('#feedback').evaluate(dialog=>{
    const box=dialog.getBoundingClientRect();
    return {x:box.x,y:box.y,width:box.width,height:box.height,scrollWidth:dialog.scrollWidth,clientWidth:dialog.clientWidth,
      viewWidth:innerWidth,viewHeight:innerHeight};
  });
  assert.ok(layout.x>=0&&layout.y>=0&&layout.x+layout.width<=layout.viewWidth+1&&layout.y+layout.height<=layout.viewHeight+1,'dialog fits the viewport');
  assert.ok(layout.scrollWidth<=layout.clientWidth+1,'dialog has no horizontal overflow');
  return layout;
}

async function topShot(page,path) {
  await page.locator('#feedback').evaluate(dialog=>{dialog.scrollTop=0;});
  await page.screenshot({path});
}

function parseDisplayedBRL(value) {
  const compact=value.replace(/\s/g,'');
  assert.match(compact,/^R\$\d{1,3}(?:\.\d{3})*,\d{2}$/,'displayed amount has exact BRL cents');
  return Number(compact.slice(2).replace(/[.,]/g,''));
}

async function inspectPlan(page,width) {
  const region=page.locator('#support-plan');
  assert.equal(normalize(await region.locator('[data-plan="target"]').innerText()),normalize(formatPlanCents(totals.targetCents)));
  assert.equal(normalize(await region.locator('[data-plan="initial"]').innerText()),normalize(formatPlanCents(totals.initialPhaseCents)));
  assert.equal(await region.locator('[data-plan="time"]').innerText(),`${num.format(plan.timeframeMonths.min/12)}–${num.format(plan.timeframeMonths.max/12)} anos`);
  assert.equal(await region.locator('[data-plan="volunteer-time"]').innerText(),`${plan.volunteerScenario.timeframeMonths.min}–${plan.volunteerScenario.timeframeMonths.max} meses`);
  const text=await region.innerText();
  assert.match(text,/Estimativa revisável, sem garantia de prazo/);
  assert.match(text,/Valor já incluído na meta completa/);
  assert.ok(text.includes(`${num.format(totals.volunteerTheoreticalHoursPerWeek)} horas brutas por semana`));
  assert.ok(text.includes(`${num.format(totals.volunteerReferenceTimeReductionPercent)}% menos tempo`));
  for(const note of plan.volunteerScenario.notes)assert.ok(text.includes(note),'volunteer assumptions are visible');
  if(ledgerTotals.incomeCents===null){
    assert.equal(await region.locator('progress,[role="progressbar"]').count(),0,'unknown receipts cannot produce a funding-progress indicator');
    assert.match(await region.locator('.plan-raised').innerText(),/Nenhum percentual financiado/);
  }else{
    const progress=region.locator('progress');
    assert.equal(await progress.evaluate(el=>el.max),plan.targetCents);
    assert.equal(await progress.evaluate(el=>el.value),Math.min(ledgerTotals.incomeCents,plan.targetCents));
  }
  await region.evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.screenshot({path:`${out}/${width}-plan.png`});
  await region.locator('.plan-volunteers').evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.screenshot({path:`${out}/${width}-volunteer-scenario.png`});
  const details=region.locator('details');await details.locator('summary').click();
  const rows=region.locator('.plan-budget > div');assert.equal(await rows.count(),plan.lineItems.length);
  let displayedSum=0;
  for(let index=0;index<plan.lineItems.length;index++){
    const row=rows.nth(index),item=plan.lineItems[index];
    assert.equal(await row.locator('dt').innerText(),item.label);
    const displayed=parseDisplayedBRL(await row.locator('dd').innerText());
    assert.equal(displayed,item.amountCents);displayedSum+=displayed;
    assert.equal(await row.locator('p').innerText(),item.basis);
  }
  assert.equal(displayedSum,totals.targetCents,'displayed budget rows sum to the displayed goal, without adding the included initial phase');
  for(const note of plan.notes)assert.ok((await details.innerText()).includes(note));
  await region.locator('.plan-budget').evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.screenshot({path:`${out}/${width}-budget.png`});
  await details.locator('summary').click();
  return {targetCents:totals.targetCents,displayedLineSumCents:displayedSum,initialIncludedCents:totals.initialPhaseCents,
    volunteerTheoreticalHoursPerWeek:totals.volunteerTheoreticalHoursPerWeek,volunteerReferenceTimeReductionPercent:totals.volunteerReferenceTimeReductionPercent,
    verifiedIncomeCents:ledgerTotals.incomeCents,fundingProgressShown:ledgerTotals.incomeCents!==null};
}

async function requestRealPointerLock(page,mobile) {
  if(mobile)return {attempted:false,reason:'touch-emulated viewport'};
  await page.evaluate(()=>{
    window.__collaborationPointer={attempted:true,done:false,locked:false};
    const canvas=document.getElementById('c');
    canvas.addEventListener('click',async()=>{
      try{
        if(typeof canvas.requestPointerLock!=='function')throw new Error('Pointer Lock unavailable');
        await canvas.requestPointerLock();window.__collaborationPointer.locked=document.pointerLockElement===canvas;
      }catch(error){window.__collaborationPointer.unavailable=String(error);}
      finally{window.__collaborationPointer.done=true;}
    },{once:true});
  });
  await page.locator('#c').click({position:{x:640,y:450}});
  await page.waitForFunction(()=>window.__collaborationPointer.done,null,{timeout:5000});
  return page.evaluate(()=>window.__collaborationPointer);
}

async function draftValues(page) {
  return page.evaluate(()=>({role:document.getElementById('volunteer-role').value,
    availability:document.getElementById('volunteer-availability').value,portfolio:document.getElementById('volunteer-portfolio').value,
    motivation:document.getElementById('volunteer-motivation').value,consent:document.getElementById('volunteer-consent').checked}));
}

const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
try{
  for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
    const mobile=viewport.width===390,context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:mobile,isMobile:mobile});
    const page=await context.newPage(),errors=[],attemptedWrites=[];
    const result={viewport,passed:false,errors,attemptedWrites};report.tests.push(result);
    page.on('pageerror',error=>errors.push(String(error)));
    await context.route('**/*',async route=>{
      const request=route.request();
      if(!['GET','HEAD'].includes(request.method())){
        const url=new URL(request.url());attemptedWrites.push({method:request.method(),origin:url.origin,pathname:url.pathname});
        await route.abort('blockedbyclient');
      }else await route.continue();
    });
    await page.addInitScript(()=>{
      window.__collaborationOpens=[];window.__collaborationPointerExitCalls=0;
      window.open=(url,target,features)=>{window.__collaborationOpens.push({url:String(url),target,features});return null;};
      const exit=document.exitPointerLock?.bind(document);
      if(exit)document.exitPointerLock=()=>{window.__collaborationPointerExitCalls++;return exit();};
    });
    try{
      await page.goto(base.href,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>window.__gta&&!document.getElementById('go').disabled,null,{timeout:60000});
      await page.click('#go');await page.waitForTimeout(500);
      const snapshot=()=>page.evaluate(()=>({time:window.__gta.state.time,pos:{...window.__gta.player.pos},phase:window.__gta.state.phase,mission:window.__gta.state.mission}));
      result.pointerLock=await requestRealPointerLock(page,mobile);
      // Keyboard activation works even when a real desktop pointer lock was acquired.
      await page.locator('#hud [data-feedback-open]').focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('#feedback').evaluate(el=>el.open),true);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'feedback-heading');
      await page.waitForFunction(()=>document.pointerLockElement===null);
      assert.ok(await page.evaluate(()=>window.__collaborationPointerExitCalls>0),'opening Colabore requests native pointer release');
      await selectedTab(page,'ideas');const frozen=await snapshot();
      const ideaDraft='Abrir atalhos entre as casas sem perder a direção da praia.';
      await page.fill('#feedback-title','Atalhos pela vila');await page.fill('#feedback-description',ideaDraft);
      await page.locator('#community-ideas-tab').focus();await page.keyboard.press('End');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'community-volunteer-tab');await selectedTab(page,'volunteer');
      await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement.id),'community-ideas-tab');await selectedTab(page,'ideas');
      await page.keyboard.press('ArrowLeft');await selectedTab(page,'volunteer');
      await page.keyboard.press('ArrowRight');await selectedTab(page,'ideas');
      await page.keyboard.press('ArrowRight');await selectedTab(page,'support');
      result.plan=await inspectPlan(page,viewport.width);result.planLayout=await layoutFits(page);
      await page.click('#plan-join');await selectedTab(page,'volunteer');
      const submit=page.locator('#volunteer-form button[type="submit"]');
      await submit.click();assert.equal(await page.evaluate(()=>window.__collaborationOpens.length),0);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'volunteer-role');
      assert.equal(await page.locator('#volunteer-role').getAttribute('aria-invalid'),'true');
      assert.equal(await page.locator('#volunteer-error').getAttribute('role'),'alert');
      await page.selectOption('#volunteer-role','qa');await page.selectOption('#volunteer-availability','5');
      const motivation='Posso testar controles, acessibilidade e a jornada em navegadores diferentes. Quero registrar falhas reproduzíveis e revisar as correções.';
      await page.fill('#volunteer-motivation',motivation);
      await page.fill('#volunteer-portfolio','http://example.org/portfolio');await submit.click();
      assert.equal(await page.evaluate(()=>document.activeElement.id),'volunteer-portfolio');
      assert.equal(await page.evaluate(()=>window.__collaborationOpens.length),0,'invalid portfolio cannot create a GitHub draft');
      await page.fill('#volunteer-portfolio','https://example.org/portfolio');await submit.click();
      assert.equal(await page.evaluate(()=>document.activeElement.id),'volunteer-consent');
      assert.equal(await page.evaluate(()=>window.__collaborationOpens.length),0,'public consent is required');
      await page.check('#volunteer-consent');
      await page.locator('#volunteer-motivation').focus();await page.keyboard.press('End');
      await page.keyboard.type(' WASD e E permanecem texto.');
      await page.waitForTimeout(250);assert.deepEqual(await snapshot(),frozen,'dialog navigation and typing leave time, player and mission unchanged');
      const draft=await draftValues(page);
      await topShot(page,`${out}/${viewport.width}-volunteer.png`);result.volunteerLayout=await layoutFits(page);
      await submit.click();const opens=await page.evaluate(()=>window.__collaborationOpens);
      assert.equal(opens.length,1);assert.equal(opens[0].target,'_blank');assert.equal(opens[0].features,'noopener,noreferrer');
      const issue=new URL(opens[0].url);
      assert.equal(issue.origin,'https://github.com');assert.equal(issue.pathname,'/alexpiraginet-bot/-grand-testament-adventure/issues/new');
      assert.deepEqual([...issue.searchParams.keys()].sort(),['body','title']);
      assert.match(issue.searchParams.get('title'),/^\[Voluntariado\]/);
      const body=issue.searchParams.get('body');assert.ok(body.includes(draft.motivation));
      assert.match(body,/Testes e acessibilidade/);assert.match(body,/5 horas por semana/);
      assert.match(body,/Não representa entrada confirmada na equipe/);
      assert.equal(await page.locator('#volunteer-github').getAttribute('href'),opens[0].url);
      assert.equal(await page.locator('#volunteer-github').isVisible(),true);
      assert.equal(await page.locator('#volunteer-github').getAttribute('rel'),'noopener noreferrer');
      assert.match(await page.locator('#volunteer-status').innerText(),/Revise o rascunho.*confirme a publicação/);
      assert.match(await page.locator('#volunteer-status').innerText(),/ainda será analisada/);
      assert.deepEqual(await draftValues(page),draft,'a blocked popup does not discard the draft');
      await page.locator('#volunteer-status').evaluate(el=>el.scrollIntoView({block:'center'}));
      await page.screenshot({path:`${out}/${viewport.width}-volunteer-draft.png`});
      await page.locator('#community-volunteer-tab').focus();await page.keyboard.press('Home');
      assert.equal(await page.inputValue('#feedback-description'),ideaDraft,'idea and volunteer drafts stay separate');
      await page.keyboard.press('End');await selectedTab(page,'volunteer');assert.deepEqual(await draftValues(page),draft);
      assert.deepEqual(await snapshot(),frozen,'draft preparation does not advance gameplay');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#feedback').evaluate(el=>el.open),false);
      assert.equal(await page.evaluate(()=>document.activeElement.matches('#hud [data-feedback-open]')),true);
      assert.equal(await page.evaluate(()=>document.pointerLockElement),null,'closing the dialog does not recapture the pointer');
      await page.waitForTimeout(250);assert.ok((await snapshot()).time>frozen.time,'game time resumes after Escape');
      await page.click('#hud [data-feedback-open]');await selectedTab(page,'ideas');await page.click('#community-volunteer-tab');
      assert.deepEqual(await draftValues(page),draft,'draft persists after closing/reopening the dialog in the same page');
      assert.equal(await page.evaluate(()=>window.__collaborationOpens.length),1,'reopening does not create another GitHub draft');
      await page.click('#feedback-close');assert.equal(await page.locator('#feedback').evaluate(el=>el.open),false);
      assert.equal(await page.evaluate(()=>document.activeElement.matches('#hud [data-feedback-open]')),true);
      assert.deepEqual(attemptedWrites,[],'all collaboration operations are local or read-only');assert.deepEqual(errors,[]);
      Object.assign(result,{passed:true,draftPreservedAcrossTabs:true,draftPreservedAcrossReopen:true,githubDraftCaptured:true,
        issuePublished:false,applicationAccepted:false,gamePausedWhileOpen:true,gameResumedOnClose:true});
    }catch(error){
      result.failure=String(error);await page.screenshot({path:`${out}/${viewport.width}-failure.png`}).catch(()=>{});throw error;
    }finally{await context.close();}
  }
}finally{await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
