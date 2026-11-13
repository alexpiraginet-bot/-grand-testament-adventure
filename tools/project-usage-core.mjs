// Pure, allowlisted usage aggregation. Transcript text, last_token_usage, rate limits,
// authentication and local paths never enter the public snapshot.
import {createHash} from 'node:crypto';

export const PRICE_SOURCE='https://developers.openai.com/api/docs/pricing';
export const PRICE_DATE='2026-11-13';
const FIELDS=['input_tokens','cached_input_tokens','output_tokens','total_tokens'];
const BASE_NOTES=[
  'Cobertura parcial: somente sessões listadas possuem medição; ferramentas e gerações externas não são inferidas.',
  'Tokens de entrada incluem contexto reutilizado. Tokens em cache são parte da entrada, não uma segunda contagem. Raciocínio é parte da saída.',
  'Horas são atividade estimada da sessão: intervalos entre incrementos de tokens, limitados a 5 minutos, unidos sem sobreposição. Não são horas humanas comprovadas.',
  'Valores em USD representam somente um equivalente hipotético de API Standard; não são fatura, cobrança da assinatura, arrecadação ou custo efetivamente pago.',
  'O painel recebe snapshots publicados. Ausência de nova atividade não faz o contador nem a data de atualização avançarem.',
];
const iso=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const cleanModel=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9._:-]{0,79}$/i.test(value)?value:'unknown';

export function isUsageMetadataHeader(header) {
  // Codex may insert an ordinal between timestamp and type. JSON parsing below
  // still validates the record type before any counter is accepted.
  const type=header.match(/"type"\s*:\s*"([^"]+)"/)?.[1];
  return type==='turn_context'||(type==='event_msg'&&/"payload"\s*:\s*\{\s*"type"\s*:\s*"token_count"/.test(header));
}

/** Return only permitted metadata; discard the rest of a selected JSONL record. */
export function parseUsageMetadata(line) {
  let record;try{record=JSON.parse(line);}catch{return null;}
  const timestamp=iso(record.timestamp),payload=record.payload;
  if(!timestamp||!payload)return null;
  if(record.type==='turn_context')return {kind:'model',timestamp,model:cleanModel(payload.model)};
  if(record.type!=='event_msg'||payload.type!=='token_count')return null;
  const source=payload.info?.total_token_usage;
  if(!source)return null;
  const counters=Object.fromEntries(FIELDS.map(key=>[key,source[key]]));
  counters.cache_write_input_tokens=source.cache_write_input_tokens??0;
  return {kind:'usage',timestamp,counters};
}

export function validCounters(value) {
  return value&&[...FIELDS,'cache_write_input_tokens'].every(key=>Number.isSafeInteger(value[key])&&value[key]>=0)
    &&value.total_tokens===value.input_tokens+value.output_tokens
    &&value.cached_input_tokens<=value.input_tokens;
}

export function createUsageState({sessionId,since}) {
  const coverageStart=iso(since);if(!coverageStart)throw new Error('Invalid coverage timestamp');
  return {version:1,sessionId,coverageStart,currentModel:'unknown',currentModelAt:null,previous:null,
    previousEventAt:null,activityAnchorAt:null,lastActivityAt:null,groups:{},revision:0,
    diagnostics:{duplicates:0,resets:0,invalidCounters:0,outOfOrder:0,missingBaseline:false}};
}

export function mergeActivityIntervals(intervals) {
  const sorted=intervals.map(({start,end})=>({start:iso(start),end:iso(end)}))
    .filter(item=>item.start&&item.end&&item.end>item.start).sort((a,b)=>a.start.localeCompare(b.start));
  const merged=[];
  for(const item of sorted){const last=merged.at(-1);if(last&&item.start<=last.end){if(item.end>last.end)last.end=item.end;}else merged.push({...item});}
  return merged;
}

export function activeSeconds(intervals) {
  return Math.floor(mergeActivityIntervals(intervals).reduce((sum,{start,end})=>sum+Date.parse(end)-Date.parse(start),0)/1000);
}

/** Mutates only private numeric aggregation state. True means genuine token activity. */
export function consumeUsageMetadata(state,metadata) {
  if(!metadata)return false;
  const timestamp=iso(metadata.timestamp);if(!timestamp)return false;
  if(metadata.kind==='model') {
    const model=cleanModel(metadata.model);
    if(model!==state.currentModel){state.currentModel=model;state.currentModelAt=timestamp;}
    return false;
  }
  if(metadata.kind!=='usage')return false;
  const current=metadata.counters,inScope=timestamp>=state.coverageStart;
  if(!validCounters(current)){if(inScope)state.diagnostics.invalidCounters++;return false;}
  if(state.previousEventAt&&timestamp<state.previousEventAt){if(inScope)state.diagnostics.outOfOrder++;return false;}
  if(!inScope) {state.previous={...current};state.previousEventAt=timestamp;state.activityAnchorAt=timestamp;return false;}
  if(!state.previous) {
    // Never assume the first cumulative total belongs to this project.
    state.previous={...current};state.previousEventAt=timestamp;state.activityAnchorAt=timestamp;
    state.diagnostics.missingBaseline=true;return false;
  }
  const delta=Object.fromEntries([...FIELDS,'cache_write_input_tokens'].map(key=>[key,current[key]-state.previous[key]]));
  state.previous={...current};state.previousEventAt=timestamp;
  if(Object.values(delta).some(value=>value<0)) {
    // A reset starts a new baseline; adding its value could double count older work.
    state.diagnostics.resets++;state.activityAnchorAt=timestamp;return false;
  }
  if(delta.total_tokens===0){state.diagnostics.duplicates++;return false;}
  if(!validCounters(delta)){state.diagnostics.invalidCounters++;state.activityAnchorAt=timestamp;return false;}
  const startMs=Math.max(Date.parse(state.coverageStart),Date.parse(state.activityAnchorAt??timestamp),
    Date.parse(timestamp)-300000,state.currentModelAt?Date.parse(state.currentModelAt):0);
  const start=new Date(Math.min(startMs,Date.parse(timestamp))).toISOString();
  const model=state.currentModel;
  let group=Object.hasOwn(state.groups,model)?state.groups[model]:null;
  if(!group)group=state.groups[model]={model,startedAtISO:start,lastActivityAtISO:timestamp,inputTokens:0,
    cachedInputTokens:0,outputTokens:0,cacheWriteInputTokens:0,activityIntervals:[]};
  group.inputTokens+=delta.input_tokens;group.cachedInputTokens+=delta.cached_input_tokens;
  group.outputTokens+=delta.output_tokens;group.cacheWriteInputTokens+=delta.cache_write_input_tokens;
  group.lastActivityAtISO=timestamp;
  group.activityIntervals=mergeActivityIntervals([...group.activityIntervals,{start,end:timestamp}]);
  state.activityAnchorAt=timestamp;state.lastActivityAt=timestamp;state.revision++;
  return true;
}

export function estimateApiEquivalent({model,inputTokens,cachedInputTokens,outputTokens,cacheWriteInputTokens=0}) {
  if(model!=='gpt-6-astra'||cacheWriteInputTokens>0||![inputTokens,cachedInputTokens,outputTokens].every(Number.isSafeInteger)
    ||inputTokens<0||cachedInputTokens<0||outputTokens<0||cachedInputTokens>inputTokens)return {cost:null,basis:null};
  const cost=((inputTokens-cachedInputTokens)*10+cachedInputTokens+outputTokens*50)/1e6;
  return {cost:Math.round(cost*1e6)/1e6,basis:`Equivalente hipotético em USD, API Standard: US$10/1M entrada sem cache, US$1/1M entrada cacheada e US$50/1M saída. Referência ${PRICE_DATE}: ${PRICE_SOURCE}. Não é cobrança real nem preço da assinatura; exclui ferramentas, impostos e outros encargos.`};
}

export function publicUsageSnapshot(state,generatedAt=new Date().toISOString()) {
  const notes=[...BASE_NOTES];
  if(state.diagnostics.missingBaseline)notes.push('O primeiro contador disponível foi usado apenas como baseline; a cobertura de tokens é uma contagem parcial conservadora.');
  if(state.diagnostics.resets)notes.push(`${state.diagnostics.resets} redução(ões)/reinício(s) de contador: o intervalo de reinício foi excluído e o seguinte começou com novo baseline.`);
  if(state.diagnostics.invalidCounters)notes.push(`${state.diagnostics.invalidCounters} registro(s) de uso inconsistente(s) foram excluídos.`);
  if(state.diagnostics.outOfOrder)notes.push(`${state.diagnostics.outOfOrder} registro(s) fora de ordem foram excluídos.`);
  const sessions=Object.values(state.groups).map(group=>{
    const estimate=estimateApiEquivalent(group);
    const id=`codex-${createHash('sha256').update(`${state.sessionId}|${group.model}`).digest('hex').slice(0,16)}`;
    return {id,label:`Codex · ${group.model}`,agent:'codex',model:group.model,startedAtISO:group.startedAtISO,
      lastActivityAtISO:group.lastActivityAtISO,endedAtISO:null,activeSeconds:activeSeconds(group.activityIntervals),
      inputTokens:group.inputTokens,cachedInputTokens:group.cachedInputTokens,outputTokens:group.outputTokens,
      estimatedApiCostUsd:estimate.cost,estimateBasis:estimate.basis,activityIntervals:group.activityIntervals.map(interval=>({...interval}))};
  });
  if(Object.values(state.groups).some(group=>group.cacheWriteInputTokens>0))notes.push('Houve escrita de cache sem duração de retenção informada; o equivalente financeiro desse grupo permanece indisponível.');
  return {version:1,generatedAt:iso(generatedAt),coverageStart:state.coverageStart,source:'local-usage-metadata',sessions,notes};
}
