// Built-game regression: no Pix transfer, real clipboard write or public GitHub post.
// Run after build/preview; the browser is deliberately sequential with other GPU checks.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { EFFORT_REMOTE_URL, EFFORT_STALE_MS, parseEffortSnapshot, summarizeEffort, isEffortStale } from '../src/effort.ts';
const { chromium }=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH||'playwright');
const base=new URL(process.argv[2]||'http://127.0.0.1:4173/');base.searchParams.set('debug','1');
const out=process.argv[3]||'shots/support';mkdirSync(out,{recursive:true});
const key='Alexpiraginet@outlook.com';
const diary='https://github.com/alexpiraginet-bot/-grand-testament-adventure/blob/main/docs/DIARIO-DESENVOLVIMENTO.md';
const report={tests:[],mockedTelemetry:null,note:'Chrome on PC; 390x844 is viewport/touch emulation, not a physical phone. Clipboard mocked; no real clipboard write, Pix transfer or GitHub post. No bank receiver or transfer verification. Main telemetry assertions require real endpoint/build responses; optional --mock-refresh uses explicitly synthetic data in a separate context.'};
const normalized=text=>text.replace(/\s+/g,' ').trim();
const number=n=>new Intl.NumberFormat('pt-BR').format(n);
const hours=seconds=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(seconds/3600);
const isMetricUrl=url=>url.startsWith(`${EFFORT_REMOTE_URL}?`)||new URL(url).pathname==='/metrics/development.json';

async function inspectRealEffort(page,observed,pending,out,width) {
  await page.waitForFunction(()=>{
    const effort=document.querySelector('#community-support .effort');
    return effort&&['fresh','stale'].includes(effort.dataset.status)&&effort.getAttribute('aria-busy')==='false';
  },null,{timeout:25000});
  await Promise.all([...pending]);
  const valid=observed.filter(s=>s.snapshot).sort((a,b)=>Date.parse(b.snapshot.generatedAt)-Date.parse(a.snapshot.generatedAt));
  assert.ok(valid.length,'a real public/local metrics response was observed; fabricated browser metrics are forbidden in this test');
  const selected=valid[0],summary=summarizeEffort(selected.snapshot);
  assert.ok(summary.sessionCount>0,'the real snapshot must contain recorded sessions, not an empty placeholder');
  assert.ok((summary.totalTokens??0)>0||(summary.agentSeconds??0)>0,'the real snapshot must contain observed usage');
  const effort=page.locator('#community-support .effort');
  assert.equal(await effort.locator('[data-effort-total="tokens"]').innerText(),summary.totalTokens===null?'Sem medição':number(summary.totalTokens));
  assert.equal(await effort.locator('[data-effort-total="agent-hours"]').innerText(),summary.agentSeconds===null?'Sem medição':`${hours(summary.agentSeconds)} h-agente`);
  assert.equal(await effort.locator('[data-effort-total="union-hours"]').innerText(),summary.unionSeconds===null?'Sem medição':`${hours(summary.unionSeconds)} h`);
  const cost=await effort.locator('[data-effort-total="api-estimate"]').innerText();
  assert.equal(normalized(cost),summary.estimatedApiCostUsd===null?'Sem tarifa confirmada':normalized(new Intl.NumberFormat('pt-BR',{style:'currency',currency:'USD',currencyDisplay:'code'}).format(summary.estimatedApiCostUsd)));
  const text=await effort.innerText();
  assert.match(text,/Registro parcial/);assert.match(text,/cache já fazem parte da entrada/);
  assert.match(text,/não uma cobrança adicional dos planos/);assert.match(text,/não são o tempo decorrido do projeto/);
  const status=await effort.getAttribute('data-status');
  if(isEffortStale(selected.snapshot))assert.equal(status,'stale');
  assert.equal(await effort.locator('[data-effort-session]').count(),Math.min(60,summary.sessionCount));
  assert.equal(await effort.locator('.effort-history').getAttribute('href'),'https://github.com/alexpiraginet-bot/-grand-testament-adventure/commits/metrics/development/development.json');
  const tokensBefore=await effort.locator('[data-effort-total="tokens"]').innerText();
  await page.waitForTimeout(250);
  assert.equal(await effort.locator('[data-effort-total="tokens"]').innerText(),tokensBefore,'no fake token ticker between actual snapshots');
  await effort.evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.screenshot({path:`${out}/${width}-effort.png`});
  await effort.locator('.effort-totals').screenshot({path:`${out}/${width}-effort-totals.png`});
  return {origin:selected.origin,url:selected.url,generatedAt:selected.snapshot.generatedAt,source:selected.snapshot.source,
    sourceSha256:selected.sha256,status,summary,synthetic:false,responses:observed.map(({url,status,error})=>({url,status,...error?{error}:{}}))};
}

async function inspectAccountability(page,out,width) {
  const ledger=page.locator('#support-accountability');
  assert.equal(await ledger.getAttribute('data-status'),'awaiting-records');
  for(const total of ['income','expense','balance'])assert.equal(await ledger.locator(`[data-total="${total}"]`).innerText(),'—',`${total} is unknown, not zero or subscription spending`);
  const claude=normalized(await ledger.locator('.accountability-subscriptions li').filter({hasText:'Claude'}).innerText());
  const codex=normalized(await ledger.locator('.accountability-subscriptions li').filter({hasText:'Codex'}).innerText());
  assert.match(claude,/R\$ 799,00 \/ mês/);assert.match(codex,/R\$ 999,00 \/ mês/);
  assert.match(claude,/dia 6/);assert.match(codex,/dia 6/);
  const monthly=normalized(await ledger.locator('[data-total="subscriptions"]').innerText());
  assert.equal(monthly,'Total mensal informado: R$ 1.798,00');
  const text=await ledger.innerText();assert.match(text,/sem comprovante publicado/);assert.match(text,/não foram descontados do saldo/);
  assert.equal(await ledger.locator('.accountability-table tbody tr').count(),1);
  assert.match(await ledger.locator('.accountability-empty').innerText(),/Nenhum lançamento publicado/);
  assert.doesNotMatch(text,/pagamento recebido|transferência confirmada/i);
  await ledger.evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.screenshot({path:`${out}/${width}-accountability.png`});
  return {status:'awaiting-records',income:'—',expense:'—',balance:'—',claudeMonthlyCents:79900,codexMonthlyCents:99900,
    reportedMonthlyCents:179800,reportedPaymentDay:6,invoiceVerified:false,allocationToGameConfirmed:false};
}
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||undefined});
try {
  for(const viewport of [{width:1280,height:800},{width:390,height:844}]) {
    const mobile=viewport.width===390;
    const context=await browser.newContext({viewport,deviceScaleFactor:1,hasTouch:mobile,isMobile:mobile});
    const page=await context.newPage();
    const errors=[],writes=[],metricRequests=[],observedMetrics=[],pendingMetricReads=new Set();
    page.on('pageerror',error=>errors.push(String(error)));
    page.on('request',request=>{if(request.method()!=='GET'&&request.method()!=='HEAD')writes.push({method:request.method(),url:request.url()});});
    page.on('request',request=>{if(isMetricUrl(request.url()))metricRequests.push({url:request.url(),method:request.method()});});
    page.on('response',response=>{
      if(!isMetricUrl(response.url()))return;
      const read=(async()=>{
        const item={url:response.url(),status:response.status(),origin:response.url().startsWith(EFFORT_REMOTE_URL)?'remote':'fallback'};
        try{const raw=await response.text();item.snapshot=parseEffortSnapshot(JSON.parse(raw));item.sha256=createHash('sha256').update(raw).digest('hex');}
        catch(error){item.error=String(error);}
        observedMetrics.push(item);
      })();pendingMetricReads.add(read);read.finally(()=>pendingMetricReads.delete(read));
    });
    await page.addInitScript(()=>{
      window.__supportClipboardMode='ok';window.__supportCopied=[];window.__supportOpens=[];
      window.open=(url,target,features)=>{window.__supportOpens.push({url:String(url),target,features});return null;};
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{
        if(window.__supportClipboardMode==='deferred')await new Promise((resolve,reject)=>{window.__supportRejectCopy=()=>reject(new Error('permission closed'));});
        if(window.__supportClipboardMode==='blocked')throw new Error('permission denied');
        window.__supportCopied.push(value);
      }}});
    });
    await page.goto(base.href,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__gta&&!document.getElementById('go').disabled,null,{timeout:60000});
    assert.equal(metricRequests.length,0,'the closed dialog must not poll telemetry');
    await page.click('#go');await page.waitForTimeout(600);
    const snapshot=()=>page.evaluate(()=>({time:window.__gta.state.time,pos:{...window.__gta.player.pos},phase:window.__gta.state.phase}));
    assert.equal((await page.locator('#hud [data-feedback-open]').textContent()).trim(),'Colabore');
    await page.click('#hud [data-feedback-open]');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'feedback-heading');
    assert.equal(await page.locator('#community-ideas-tab').getAttribute('aria-selected'),'true');
    const frozen=await snapshot();
    const draft='Queria encontrar mais caminhos entre as casas de Cafarnaum.';
    await page.fill('#feedback-title','Caminhos entre as casas');
    await page.fill('#feedback-description',draft);await page.check('#feedback-public');
    assert.equal(metricRequests.length,0,'the ideas tab must not poll telemetry');
    await page.locator('#community-ideas-tab').focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'community-support-tab');
    assert.equal(await page.locator('#community-support-tab').getAttribute('aria-selected'),'true');
    assert.equal(await page.locator('#community-support-tab').getAttribute('tabindex'),'0');
    assert.equal(await page.locator('#community-ideas-tab').getAttribute('tabindex'),'-1');
    assert.equal(await page.locator('#community-ideas').isVisible(),false);
    assert.equal(await page.locator('#community-support').isVisible(),true);
    assert.equal(await page.inputValue('#support-pix-key'),key);
    assert.equal(await page.locator('#support-pix-key').evaluate(input=>input.readOnly),true);
    assert.equal(await page.locator('#community-diary').getAttribute('href'),diary);
    assert.match(await page.locator('#community-support').innerText(),/O jogo continua livre/);
    assert.match(await page.locator('#community-support').innerText(),/não oferece vantagens/);
    assert.equal(await page.locator('#support-pix-help').innerText(),'No app do seu banco, confira o recebedor antes de confirmar.');
    const writesBeforeCopy=writes.length;
    await page.click('#support-copy');
    await page.waitForFunction(()=>document.getElementById('support-status').textContent.startsWith('Chave Pix copiada.'));
    assert.deepEqual(await page.evaluate(()=>window.__supportCopied),[key]);
    const successMessage=await page.locator('#support-status').innerText();
    assert.doesNotMatch(successMessage,/pagamento recebido|transferência confirmada/i);
    await page.evaluate(()=>{window.__supportClipboardMode='blocked';});
    await page.click('#support-copy');
    await page.waitForFunction(()=>document.getElementById('support-status').textContent.startsWith('Não foi possível copiar'));
    const selection=await page.locator('#support-pix-key').evaluate(input=>({start:input.selectionStart,end:input.selectionEnd,focused:document.activeElement===input}));
    assert.deepEqual(selection,{start:0,end:key.length,focused:true});
    assert.deepEqual(await page.evaluate(()=>window.__supportCopied),[key]);
    await page.waitForTimeout(400);
    assert.deepEqual(await snapshot(),frozen,'modal tabs, copying and keyboard cannot move the player or advance time');
    assert.equal(writes.length,writesBeforeCopy,'copying performs no network write');
    assert.deepEqual(await page.evaluate(()=>window.__supportOpens),[],'support does not open payment or GitHub automatically');
    const accountability=await inspectAccountability(page,out,viewport.width);
    const effort=await inspectRealEffort(page,observedMetrics,pendingMetricReads,out,viewport.width);
    await page.evaluate(()=>{document.getElementById('feedback').scrollTop=0;});
    await page.screenshot({path:`${out}/${viewport.width}-support.png`});
    const layout=await page.locator('#feedback').evaluate(dialog=>{
      const rect=dialog.getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,height:rect.height,scrollWidth:dialog.scrollWidth,clientWidth:dialog.clientWidth,viewWidth:innerWidth,viewHeight:innerHeight};
    });
    assert.ok(layout.x>=0&&layout.y>=0&&layout.x+layout.width<=layout.viewWidth+1&&layout.y+layout.height<=layout.viewHeight+1,'dialog fits viewport');
    assert.ok(layout.scrollWidth<=layout.clientWidth+1,'no horizontal overflow');
    await page.locator('#community-support-tab').focus();await page.keyboard.press('Home');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'community-ideas-tab');
    assert.equal(await page.inputValue('#feedback-description'),draft);
    assert.equal(await page.locator('#feedback-public').isChecked(),true);
    await page.keyboard.press('End');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'community-support-tab');
    await page.evaluate(()=>{window.__supportClipboardMode='deferred';});
    await page.click('#support-copy');await page.keyboard.press('Escape');
    assert.equal(await page.locator('#feedback').evaluate(dialog=>dialog.open),false);
    await page.evaluate(()=>window.__supportRejectCopy());
    await page.waitForFunction(()=>!document.getElementById('support-copy').disabled);
    assert.equal(await page.evaluate(()=>document.activeElement.matches('[data-feedback-open]')),true,'late clipboard rejection does not steal focus after Escape');
    await page.click('#hud [data-feedback-open]');
    assert.equal(await page.locator('#community-ideas-tab').getAttribute('aria-selected'),'true');
    assert.equal(await page.inputValue('#feedback-description'),draft);
    assert.equal(await page.locator('#feedback-public').isChecked(),true);
    await page.click('#community-support-tab');await page.click('#feedback-close');
    assert.equal(await page.locator('#feedback').evaluate(dialog=>dialog.open),false,'close button works from support tab');
    assert.equal(await page.evaluate(()=>document.activeElement.matches('[data-feedback-open]')),true);
    assert.deepEqual(errors,[]);
    assert.ok(metricRequests.every(r=>r.method==='GET'),'telemetry only reads public records');
    report.tests.push({viewport,passed:true,layout,key,successMessage,manualSelection:selection,accountability,effort,
      networkWritesDuringCopy:writes.length-writesBeforeCopy,errors});
    await context.close();
  }
  if(process.argv.includes('--mock-refresh'))report.mockedTelemetry=await checkMockRefresh(browser);
} finally {await browser.close();writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));

// Explicitly synthetic regression, separate from real totals and deliverable screenshots.
async function checkMockRefresh(browser) {
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
  try {
    assert.ok(page.clock?.install,'Playwright Clock is required for optional --mock-refresh');
    const initial=Date.now();await page.clock.install({time:new Date(initial)});
    let mode='fallback',remoteReads=0,fallbackReads=0;
    const fixture=now=>({version:1,generatedAt:new Date(now).toISOString(),coverageStart:new Date(now-120000).toISOString(),
      source:'local-usage-metadata',sessions:[{id:'synthetic-only',label:'Fixture <img src=x onerror=alert(1)>',agent:'codex',model:'test-only',
        startedAtISO:new Date(now-120000).toISOString(),lastActivityAtISO:new Date(now-1000).toISOString(),endedAtISO:null,activeSeconds:30,
        inputTokens:mode==='fresh'?2000:1000,cachedInputTokens:mode==='fresh'?1800:900,outputTokens:mode==='fresh'?200:100,
        estimatedApiCostUsd:null,estimateBasis:null}],notes:['Dado sintético exclusivo da regressão; não é medição de desenvolvimento.']});
    const original=fixture(initial);
    await page.route(`${EFFORT_REMOTE_URL}*`,async route=>{
      remoteReads++;
      if(mode==='fallback')await route.fulfill({status:503,contentType:'application/json',body:'{}'});
      else await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture(await page.evaluate(()=>Date.now())))});
    });
    await page.route('**/metrics/development.json?*',async route=>{
      fallbackReads++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(original)});
    });
    await page.goto(base.href,{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__gta&&!document.getElementById('go').disabled,null,{timeout:60000});
    assert.equal(remoteReads+fallbackReads,0);
    await page.locator('[data-feedback-open]:visible').first().click();await page.click('#community-support-tab');
    const effort=page.locator('#community-support .effort');
    await page.waitForFunction(()=>document.querySelector('[data-effort-total="tokens"]')?.textContent==='1.100');
    assert.equal(remoteReads,1);assert.equal(fallbackReads,1);
    assert.equal(await effort.locator('img').count(),0,'remote labels are text, never executable HTML');
    assert.match(await effort.locator('.effort-source').innerText(),/cópia publicada com o jogo/);
    const initialHours=await effort.locator('[data-effort-total="agent-hours"]').innerText();
    await page.clock.fastForward(EFFORT_STALE_MS+1000);
    await page.waitForFunction(()=>document.querySelector('#community-support .effort').dataset.status==='stale');
    assert.equal(await effort.locator('[data-effort-total="tokens"]').innerText(),'1.100');
    assert.equal(await effort.locator('[data-effort-total="agent-hours"]').innerText(),initialHours);
    assert.equal(await effort.locator('[data-effort-total="api-estimate"]').innerText(),'Sem tarifa confirmada');
    await page.click('#community-ideas-tab');const hiddenBefore=remoteReads+fallbackReads;
    await page.clock.fastForward(180000);assert.equal(remoteReads+fallbackReads,hiddenBefore,'hidden tab must not poll even after three intervals');
    mode='fresh';await page.click('#community-support-tab');
    await page.waitForFunction(()=>document.querySelector('[data-effort-total="tokens"]')?.textContent==='2.200');
    assert.equal(await effort.getAttribute('data-status'),'fresh');
    assert.match(await effort.locator('.effort-source').innerText(),/registro público no GitHub/);
    await page.evaluate(()=>{
      Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__effortVisibility??'visible'});
      window.__effortVisibility='hidden';document.dispatchEvent(new Event('visibilitychange'));
    });
    const windowHiddenBefore=remoteReads+fallbackReads;
    await page.clock.fastForward(120000);assert.equal(remoteReads+fallbackReads,windowHiddenBefore,'hidden document must not poll');
    await page.evaluate(()=>{window.__effortVisibility='visible';document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForFunction(()=>document.querySelector('#community-support .effort').getAttribute('aria-busy')==='false');
    await page.click('#feedback-close');const closedBefore=remoteReads+fallbackReads;
    await page.clock.fastForward(120000);assert.equal(remoteReads+fallbackReads,closedBefore,'closed dialog must not poll');
    return {synthetic:true,passed:true,remoteReads,fallbackReads,hiddenTabPolls:0,hiddenDocumentPolls:0,closedDialogPolls:0,
      note:'Synthetic fallback/refresh/stale/XSS regression only. These token counts and durations are not development measurements.'};
  } finally {await context.close();}
}
