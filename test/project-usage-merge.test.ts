import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeEffort} from '../src/effort.ts';
const {mergePublicUsage}=await import(new URL('../tools/merge_project_usage.mjs',import.meta.url).href);
const NOW=Date.parse('2026-11-13T16:00:00.000Z');
const at=(seconds:number)=>new Date(NOW+seconds*1000).toISOString();
const session=(overrides:Record<string,unknown>={})=>({
  id:'codex-observed',label:'Codex',agent:'codex',model:'gpt-6-astra',startedAtISO:at(-1200),
  lastActivityAtISO:at(-100),endedAtISO:null,activeSeconds:100,
  activityIntervals:[{start:at(-500),end:at(-400)}],
  inputTokens:1000,cachedInputTokens:400,outputTokens:100,estimatedApiCostUsd:null,estimateBasis:null,...overrides,
});
const snapshot=(overrides:Record<string,unknown>={})=>({version:1,source:'local-usage-metadata',generatedAt:at(0),
  coverageStart:at(-1500),sessions:[session()],notes:[],...overrides});
const advanced=()=>session({lastActivityAtISO:at(-50),activeSeconds:150,
  activityIntervals:[{start:at(-500),end:at(-350)}],inputTokens:1400,cachedInputTokens:600,outputTokens:150});

test('Codex update preserves remote Claude and independent scope, with no input mutation or summed cumulative duplicate',()=>{
  const claude=session({id:'claude-independent',label:'Claude',agent:'claude',model:'claude-observed',startedAtISO:at(-2400)});
  const previous=snapshot({coverageStart:at(-3000),generatedAt:at(-90),sessions:[session(),claude]});
  const local=snapshot({sessions:[advanced()]});
  const beforePrevious=structuredClone(previous),beforeLocal=structuredClone(local);
  const merged=mergePublicUsage(previous,local,NOW);
  assert.equal(merged.sessions.length,2);
  assert.deepEqual(merged.sessions.find((s:{id:string})=>s.id===claude.id),claude);
  assert.equal(merged.sessions.find((s:{id:string})=>s.id==='codex-observed').inputTokens,1400);
  assert.equal(summarizeEffort(merged).inputTokens,2400);
  assert.equal(merged.coverageStart,at(-3000));
  assert.deepEqual(previous,beforePrevious);assert.deepEqual(local,beforeLocal);
});

test('new independent Claude session may start later and does not reset existing Codex history',()=>{
  const claude=session({id:'claude-new',agent:'claude',model:'claude-observed',startedAtISO:at(-300),
    activeSeconds:30,activityIntervals:[{start:at(-180),end:at(-150)}]});
  const merged=mergePublicUsage(snapshot(),snapshot({coverageStart:at(-350),sessions:[claude]}),NOW);
  assert.equal(merged.sessions.length,2);assert.equal(merged.coverageStart,at(-1500));
  assert.deepEqual(merged.sessions[0],session());
});

test('newer partial rerun under the same ID cannot lower known tokens or replace them with unknown',()=>{
  for(const field of ['inputTokens','cachedInputTokens','outputTokens'] as const){
    const old=session(),newer=advanced();
    assert.throws(()=>mergePublicUsage(snapshot(),snapshot({sessions:[{...newer,[field]:old[field]-1}]}),NOW),new RegExp(field));
    assert.throws(()=>mergePublicUsage(snapshot(),snapshot({sessions:[{...newer,[field]:null,...(field==='inputTokens'?{cachedInputTokens:null}:{})}]}),NOW),new RegExp(field));
  }
});

test('a new coverage window must not move an existing session start forward even with copied full counters',()=>{
  assert.throws(()=>mergePublicUsage(snapshot(),snapshot({coverageStart:at(-700),sessions:[{...advanced(),startedAtISO:at(-600)}]}),NOW),/startedAtISO moved forward/);
  assert.throws(()=>mergePublicUsage(snapshot(),snapshot({coverageStart:at(-700),sessions:[advanced()]}),NOW),/coverageStart excludes/);
  for(const changed of [{agent:'claude'},{model:'different-model'}]){
    assert.throws(()=>mergePublicUsage(snapshot(),snapshot({sessions:[{...advanced(),...changed}]}),NOW),/agent\/model changed/);
  }
});

test('stale local snapshot preserves the newer remote counters and observed activity',()=>{
  const remote=snapshot({sessions:[advanced()]});
  const stale=snapshot({generatedAt:at(-200),sessions:[session({lastActivityAtISO:at(-300),activeSeconds:10,
    activityIntervals:[{start:at(-500),end:at(-490)}],inputTokens:20,cachedInputTokens:0,outputTokens:5})]});
  assert.deepEqual(mergePublicUsage(remote,stale,NOW).sessions,[advanced()]);
});

test('activity may grow but cannot shrink, lose known intervals or shift away from already observed work',()=>{
  const fresh=advanced();
  assert.throws(()=>mergePublicUsage(snapshot(),snapshot({sessions:[{...fresh,activeSeconds:90,activityIntervals:[{start:at(-500),end:at(-410)}]}]}),NOW),/reduce activity/);
  assert.throws(()=>mergePublicUsage(snapshot(),snapshot({sessions:[{...fresh,activityIntervals:undefined}]}),NOW),/remove interval coverage/);
  assert.throws(()=>mergePublicUsage(snapshot(),snapshot({sessions:[{...fresh,activityIntervals:[{start:at(-300),end:at(-150)}]}]}),NOW),/reduce interval coverage/);
  const expanded={...fresh,startedAtISO:at(-1800),activeSeconds:200,
    activityIntervals:[{start:at(-1600),end:at(-1550)},{start:at(-500),end:at(-350)}]};
  const merged=mergePublicUsage(snapshot(),snapshot({coverageStart:at(-1900),sessions:[expanded]}),NOW);
  assert.equal(merged.coverageStart,at(-1900));assert.equal(merged.sessions[0].activeSeconds,200);
});

test('future timestamp and invalid public metadata fail rather than becoming a fresh published snapshot',()=>{
  assert.throws(()=>mergePublicUsage(snapshot(),snapshot({generatedAt:at(1)}),NOW),/generatedAt/);
  assert.throws(()=>mergePublicUsage(snapshot(),snapshot({sessions:[{...advanced(),lastActivityAtISO:at(1)}]}),NOW),/lastActivityAtISO/);
  assert.throws(()=>mergePublicUsage(snapshot(),snapshot({privateTranscript:'never publish'}),NOW),/unexpected field/);
});

test('normalize only the old collector coverage note, preserving arbitrary notes and idempotent merge',()=>{
  const old='Cobertura parcial: metadados da sessão Codex autorizada após o início do jogo; Claude, outros agentes, ferramentas e gerações externas não estão somados.';
  const generic='Cobertura parcial: somente sessões listadas possuem medição; ferramentas e gerações externas não são inferidas.';
  const other=`Nota do mantenedor: ${old}`;
  const merged=mergePublicUsage(snapshot({notes:[old,other]}),snapshot({notes:[generic]}),NOW);
  assert.deepEqual(merged.notes,[generic,other]);
  assert.deepEqual(mergePublicUsage(merged,snapshot({notes:[old]}),NOW),merged);
  assert.deepEqual(mergePublicUsage(null,snapshot({notes:[old]}),NOW).notes,[generic]);
});

test('an explicit closed record wins over an older local observation as in the existing snapshot parser',()=>{
  const closed=session({endedAtISO:at(-80)});
  const merged=mergePublicUsage(snapshot({sessions:[closed]}),snapshot(),NOW);
  assert.deepEqual(merged.sessions,[closed]);
  const legacy=snapshot({coverageStart:undefined});
  assert.equal(mergePublicUsage(legacy,legacy,NOW).coverageStart,session().startedAtISO);
});
