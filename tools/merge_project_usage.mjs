// Pure merge of public metadata; no file access, Git operation or publication.
import {parseEffortSnapshot,unionActivitySeconds} from '../src/effort.ts';

const COVERAGE_NOTE='Cobertura parcial: somente sessões listadas possuem medição; ferramentas e gerações externas não são inferidas.';
const normalizeNote=note=>note.startsWith('Cobertura parcial: metadados da sessão Codex autorizada')?COVERAGE_NOTE:note;
const scopeError=(id,field)=>{throw Error(`Usage merge scope conflict for ${id}: ${field}`);};

function validateCoverage(snapshot) {
  if(snapshot.coverageStart&&snapshot.sessions.some(s=>s.startedAtISO<snapshot.coverageStart)){
    throw Error('Usage merge scope conflict: coverageStart excludes an observed session');
  }
}

// Match the existing parser: latest activity, then closure time, then later occurrence.
function replaces(previous,next) {
  if(next.lastActivityAtISO!==previous.lastActivityAtISO)return next.lastActivityAtISO>previous.lastActivityAtISO;
  return (next.endedAtISO??next.lastActivityAtISO)>=(previous.endedAtISO??previous.lastActivityAtISO);
}

function validateUpdate(previous,next) {
  if(previous.agent!==next.agent||previous.model!==next.model)scopeError(next.id,'agent/model changed');
  if(!replaces(previous,next))return;
  if(next.startedAtISO>previous.startedAtISO)scopeError(next.id,'startedAtISO moved forward');
  for(const field of ['inputTokens','cachedInputTokens','outputTokens']){
    if(previous[field]!==null&&(next[field]===null||next[field]<previous[field])){
      throw Error(`Usage merge would reduce known ${field} for ${next.id}`);
    }
  }
  if(next.activeSeconds<previous.activeSeconds)throw Error(`Usage merge would reduce activity for ${next.id}`);
  if(previous.activityIntervals!==undefined){
    if(next.activityIntervals===undefined)throw Error(`Usage merge would remove interval coverage for ${next.id}`);
    const nextSeconds=unionActivitySeconds(next.activityIntervals);
    const combinedSeconds=unionActivitySeconds([...previous.activityIntervals,...next.activityIntervals]);
    // Compare coverage, not just duration: a shifted interval must not erase earlier work.
    if(combinedSeconds-nextSeconds>0.000001)throw Error(`Usage merge would reduce interval coverage for ${next.id}`);
  }
}

/**
 * Preserve remote sessions and reject a newer partial rerun under an existing ID.
 * Independent agents may cover different periods; global coverage is their earliest
 * declared boundary (or earliest observed start for legacy metadata without one).
 * API-price estimates may change; they are not cumulative usage or paid expenses.
 * The optional clock makes validation deterministic without changing production calls.
 */
export function mergePublicUsage(previousInput,localInput,now=Date.now()) {
  const local=parseEffortSnapshot(localInput,now);
  const previous=previousInput==null?null:parseEffortSnapshot(previousInput,now);
  validateCoverage(local);if(previous)validateCoverage(previous);
  const byId=new Map((previous?.sessions??[]).map(session=>[session.id,session]));
  for(const session of local.sessions){const old=byId.get(session.id);if(old)validateUpdate(old,session);}
  const snapshots=previous?[previous,local]:[local];
  const coverage=snapshots.flatMap(snapshot=>snapshot.coverageStart?[snapshot.coverageStart]:snapshot.sessions.map(s=>s.startedAtISO)).sort()[0];
  return parseEffortSnapshot({version:1,source:'local-usage-metadata',
    generatedAt:snapshots.map(snapshot=>snapshot.generatedAt).sort().at(-1),
    ...(coverage?{coverageStart:coverage}:{}),
    sessions:[...(previous?.sessions??[]),...local.sessions],
    notes:[...new Set(snapshots.flatMap(snapshot=>snapshot.notes.map(normalizeNote)))],
  },now);
}
