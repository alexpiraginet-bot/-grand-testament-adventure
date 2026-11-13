import test from 'node:test';
import assert from 'node:assert/strict';
const corePath=new URL('../tools/project-usage-core.mjs',import.meta.url).href;
const {isUsageMetadataHeader,parseUsageMetadata,createUsageState,consumeUsageMetadata,publicUsageSnapshot,mergeActivityIntervals,activeSeconds,estimateApiEquivalent}=await import(corePath);
const start='2026-11-12T19:28:52.842Z';
const timestamp=(seconds:number)=>new Date(Date.parse(start)+seconds*1000).toISOString();
const state=()=>createUsageState({sessionId:'private-session-id',since:start});
const usage=(seconds:number,input:number,cached:number,output:number)=>({kind:'usage',timestamp:timestamp(seconds),counters:{input_tokens:input,cached_input_tokens:cached,output_tokens:output,total_tokens:input+output,cache_write_input_tokens:0}});
const model=(seconds:number,name='gpt-6-astra')=>({kind:'model',timestamp:timestamp(seconds),model:name});

test('usage metadata excludes transcripts, rate limits, auth and misleading compaction last totals',()=>{
  assert.equal(parseUsageMetadata(JSON.stringify({timestamp:start,type:'response_item',payload:{text:'secret-transcript'}})),null);
  const record={timestamp:start,type:'event_msg',payload:{type:'token_count',rate_limits:{secret:'not-for-public'},info:{total_token_usage:usage(0,100,90,10).counters,last_token_usage:{total_tokens:999999999}}}};
  const extracted=parseUsageMetadata(JSON.stringify(record));
  assert.deepEqual(extracted,usage(0,100,90,10));assert.doesNotMatch(JSON.stringify(extracted),/secret|last_token_usage|rate_limits|999999999/);
});

test('metadata header accepts current Codex ordinal field and rejects transcript records',()=>{
  const line=JSON.stringify({timestamp:start,ordinal:123,type:'event_msg',payload:{type:'token_count',info:{total_token_usage:usage(0,100,90,10).counters}}});
  assert.equal(isUsageMetadataHeader(line.slice(0,512)),true);assert.deepEqual(parseUsageMetadata(line),usage(0,100,90,10));
  assert.equal(isUsageMetadataHeader(JSON.stringify({timestamp:start,ordinal:124,type:'response_item',payload:{type:'message',text:'ignored'}})),false);
});

test('cumulative deltas use pre-window baseline, ignore duplicates and never add cached input twice',()=>{
  const s=state();consumeUsageMetadata(s,model(-1));consumeUsageMetadata(s,usage(-1,1000,900,100));
  consumeUsageMetadata(s,usage(10,1200,1080,120));consumeUsageMetadata(s,usage(10,1200,1080,120));consumeUsageMetadata(s,usage(20,1300,1170,130));
  const snapshot=publicUsageSnapshot(s,timestamp(30)),session=snapshot.sessions[0];
  assert.equal(session.inputTokens,300);assert.equal(session.cachedInputTokens,270);assert.equal(session.outputTokens,30);assert.equal(session.activeSeconds,20);
  assert.equal(session.estimatedApiCostUsd,(30*10+270+30*50)/1e6);assert.equal(s.diagnostics.duplicates,1);
  assert.equal(snapshot.version,1);assert.equal(snapshot.generatedAt,timestamp(30));assert.equal(snapshot.coverageStart,start);
  assert.doesNotMatch(JSON.stringify(snapshot),/private-session-id|sourcePath|rate_limits|auth|previousEventAt/);
});

test('missing baseline and counter reset are excluded conservatively instead of re-counting history',()=>{
  const s=state();consumeUsageMetadata(s,model(0));consumeUsageMetadata(s,usage(1,10000,9000,1000));
  consumeUsageMetadata(s,usage(2,10100,9090,1010));consumeUsageMetadata(s,usage(3,20,10,2));consumeUsageMetadata(s,usage(4,50,30,5));
  const snapshot=publicUsageSnapshot(s),session=snapshot.sessions[0];
  assert.equal(session.inputTokens,130);assert.equal(session.outputTokens,13);assert.equal(s.diagnostics.resets,1);
  assert.equal(s.diagnostics.missingBaseline,true);assert.ok(snapshot.notes.some((note:string)=>note.includes('reinício')));
});

test('cached delta cannot exceed input delta and invalid records cannot fabricate cost',()=>{
  const s=state();consumeUsageMetadata(s,model(-1));consumeUsageMetadata(s,usage(-1,100,10,10));
  consumeUsageMetadata(s,usage(10,110,40,11));
  assert.equal(s.revision,0);assert.equal(s.diagnostics.invalidCounters,1);
  assert.equal(estimateApiEquivalent({model:'gpt-6-astra',inputTokens:10,cachedInputTokens:20,outputTokens:1}).cost,null);
});

test('activity ignores overnight idle time and merging intervals does not double-count concurrent work',()=>{
  const s=state();consumeUsageMetadata(s,model(-1));consumeUsageMetadata(s,usage(-1,100,90,10));
  consumeUsageMetadata(s,usage(60,200,180,20));consumeUsageMetadata(s,usage(8*3600+60,300,270,30));
  const session=publicUsageSnapshot(s).sessions[0];assert.equal(session.activeSeconds,360);
  const merged=mergeActivityIntervals([{start:timestamp(0),end:timestamp(60)},{start:timestamp(30),end:timestamp(120)}]);
  assert.deepEqual(merged,[{start:timestamp(0),end:timestamp(120)}]);assert.equal(activeSeconds(merged),120);
});

test('model changes attribute deltas to the current model and unknown model price remains unavailable',()=>{
  const s=state();consumeUsageMetadata(s,model(-1));consumeUsageMetadata(s,usage(-1,100,90,10));consumeUsageMetadata(s,usage(10,200,180,20));
  consumeUsageMetadata(s,model(20,'unknown-priced-model'));consumeUsageMetadata(s,usage(30,400,360,40));
  const sessions=publicUsageSnapshot(s).sessions;assert.equal(sessions.length,2);
  assert.equal(sessions[0].inputTokens,100);assert.equal(sessions[1].inputTokens,200);assert.equal(sessions[1].activeSeconds,10);
  assert.equal(sessions[1].estimatedApiCostUsd,null);assert.equal(sessions[1].estimateBasis,null);
  assert.notEqual(sessions[0].id,sessions[1].id);
});
