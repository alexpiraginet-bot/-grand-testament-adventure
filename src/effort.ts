// Observed local usage only: cached tokens are a subset of input, not extra tokens.
// USD is an optional theoretical API equivalent, never an invoice or subscription expense.
export const EFFORT_REMOTE_URL = 'https://raw.githubusercontent.com/alexpiraginet-bot/-grand-testament-adventure/metrics/development/development.json';
export const EFFORT_FALLBACK_URL = '/metrics/development.json';
export const EFFORT_STALE_MS = 150_000;
export const EFFORT_POLL_MS = 60_000;
export const EFFORT_TIMEOUT_MS = 8_000;

export type ActivityInterval = {start: string; end: string};
export type EffortSession = {
  id: string; label: string; agent: 'codex' | 'claude'; model: string;
  startedAtISO: string; lastActivityAtISO: string; endedAtISO: string | null;
  activeSeconds: number; activityIntervals?: ActivityInterval[];
  inputTokens: number | null; cachedInputTokens: number | null; outputTokens: number | null;
  estimatedApiCostUsd: number | null; estimateBasis: string | null;
};
export type EffortSnapshot = {
  version: 1; generatedAt: string; coverageStart?: string;
  source: 'local-usage-metadata'; sessions: EffortSession[]; notes: string[];
};
export type EffortSummary = {
  sessionCount: number; agentSeconds: number | null; unionSeconds: number | null;
  inputTokens: number | null; cachedInputTokens: number | null; outputTokens: number | null;
  totalTokens: number | null; tokensPartial: boolean;
  estimatedApiCostUsd: number | null; estimatePartial: boolean;
};
export type EffortRead = {snapshot: EffortSnapshot; origin: 'remote' | 'fallback'};
type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
const fail = (field: string): never => {throw new Error(`Invalid development usage: ${field}`);};
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return fail('object');
  return v as Record<string, unknown>;
};
const keysOnly = (o: Record<string, unknown>, keys: string[]) => {
  if (Object.keys(o).some(k => !keys.includes(k))) fail('unexpected field');
};
const text = (v: unknown, field: string, max = 200): string => {
  if (typeof v !== 'string' || !v.trim() || v.length > max) return fail(field);
  return v.trim();
};
const count = (v: unknown, field: string): number => {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) return fail(field);
  return v;
};
const nullableCount = (v: unknown, field: string) => v === null ? null : count(v, field);

/** ISO timestamps must include a timezone and a real calendar date; no future samples. */
function timestamp(v: unknown, field: string, latest: number): string {
  const s = text(v, field, 40);
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(s);
  if (!m) return fail(field);
  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const offset = m[7];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] || hour > 23 || minute > 59 || second > 59 ||
      (offset !== 'Z' && (Number(offset.slice(1, 3)) > 23 || Number(offset.slice(4)) > 59))) return fail(field);
  const ms = Date.parse(s);
  if (!Number.isFinite(ms) || ms > latest) return fail(field);
  return new Date(ms).toISOString();
}

/** Merge actual closed activity intervals; do not turn an open session into a running clock. */
export function unionActivitySeconds(intervals: readonly ActivityInterval[]): number {
  const sorted = intervals.map(i => [Date.parse(i.start), Date.parse(i.end)]).sort((a, b) => a[0] - b[0]);
  let seconds = 0, start = 0, end = 0, hasInterval = false;
  for (const [a, b] of sorted) {
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return fail('activity interval');
    if (!hasInterval) {start = a; end = b; hasInterval = true;}
    else if (a <= end) end = Math.max(end, b);
    else {seconds += (end - start) / 1000; start = a; end = b;}
  }
  return seconds + (hasInterval ? (end - start) / 1000 : 0);
}

function parseSession(input: unknown, generatedAt: number): EffortSession {
  const s = record(input);
  keysOnly(s, ['id', 'label', 'agent', 'model', 'startedAtISO', 'lastActivityAtISO', 'endedAtISO', 'activeSeconds',
    'activityIntervals', 'inputTokens', 'cachedInputTokens', 'outputTokens', 'estimatedApiCostUsd', 'estimateBasis']);
  if (s.agent !== 'codex' && s.agent !== 'claude') return fail('agent');
  const startedAtISO = timestamp(s.startedAtISO, 'startedAtISO', generatedAt);
  const lastActivityAtISO = timestamp(s.lastActivityAtISO, 'lastActivityAtISO', generatedAt);
  const endedAtISO = s.endedAtISO === null ? null : timestamp(s.endedAtISO, 'endedAtISO', generatedAt);
  const start = Date.parse(startedAtISO), last = Date.parse(lastActivityAtISO);
  if (last < start || (endedAtISO !== null && Date.parse(endedAtISO) < last)) return fail('session chronology');
  const activeSeconds = count(s.activeSeconds, 'activeSeconds');
  if (activeSeconds > Math.ceil((last - start) / 1000)) return fail('activeSeconds exceeds observed span');
  const inputTokens = nullableCount(s.inputTokens, 'inputTokens');
  const cachedInputTokens = nullableCount(s.cachedInputTokens, 'cachedInputTokens');
  const outputTokens = nullableCount(s.outputTokens, 'outputTokens');
  if (cachedInputTokens !== null && (inputTokens === null || cachedInputTokens > inputTokens)) return fail('cachedInputTokens');
  const model = text(s.model, 'model', 120);
  const estimateBasis = s.estimateBasis === null ? null : text(s.estimateBasis, 'estimateBasis', 1000);
  let estimatedApiCostUsd: number | null = null;
  if (s.estimatedApiCostUsd !== null) {
    if (typeof s.estimatedApiCostUsd !== 'number' || !Number.isFinite(s.estimatedApiCostUsd) || s.estimatedApiCostUsd < 0 ||
        s.estimatedApiCostUsd > Number.MAX_SAFE_INTEGER || !estimateBasis ||
        /^(unknown|desconhecido|não informado|nao informado|n\/a)$/i.test(model)) return fail('estimatedApiCostUsd');
    estimatedApiCostUsd = s.estimatedApiCostUsd;
  }
  let activityIntervals: ActivityInterval[] | undefined;
  if (s.activityIntervals !== undefined) {
    if (!Array.isArray(s.activityIntervals) || s.activityIntervals.length > 10_000) return fail('activityIntervals');
    activityIntervals = s.activityIntervals.map(raw => {
      const interval = record(raw); keysOnly(interval, ['start', 'end']);
      const a = timestamp(interval.start, 'interval start', last), b = timestamp(interval.end, 'interval end', last);
      if (Date.parse(a) < start || Date.parse(b) < Date.parse(a)) return fail('interval chronology');
      return {start: a, end: b};
    });
    // Permit integer-second rounding, not contradictory independent time totals.
    if (Math.abs(unionActivitySeconds(activityIntervals) - activeSeconds) > 1) return fail('interval duration');
  }
  return {id: text(s.id, 'id', 200), label: text(s.label, 'label', 240), agent: s.agent, model,
    startedAtISO, lastActivityAtISO, endedAtISO, activeSeconds,
    ...(activityIntervals === undefined ? {} : {activityIntervals}),
    inputTokens, cachedInputTokens, outputTokens, estimatedApiCostUsd, estimateBasis};
}

/** A partial snapshot is valid; missing required fields and unknown versions are not. */
export function parseEffortSnapshot(input: unknown, now = Date.now()): EffortSnapshot {
  if (!Number.isFinite(now)) return fail('clock');
  const raw = record(input);
  keysOnly(raw, ['version', 'generatedAt', 'coverageStart', 'source', 'sessions', 'notes']);
  if (raw.version !== 1 || raw.source !== 'local-usage-metadata') return fail('version/source');
  const generatedAt = timestamp(raw.generatedAt, 'generatedAt', now), generated = Date.parse(generatedAt);
  const coverageStart = raw.coverageStart === undefined ? undefined : timestamp(raw.coverageStart, 'coverageStart', generated);
  if (!Array.isArray(raw.sessions) || raw.sessions.length > 2000) return fail('sessions');
  if (!Array.isArray(raw.notes) || raw.notes.length > 40) return fail('notes');
  const notes = raw.notes.map(n => text(n, 'note', 1000)), byId = new Map<string, EffortSession>();
  for (const entry of raw.sessions) {
    const session = parseSession(entry, generated), previous = byId.get(session.id);
    // Latest observed activity wins. A closed record wins a tie; then the later occurrence wins.
    const order = (s: EffortSession) => [Date.parse(s.lastActivityAtISO), Date.parse(s.endedAtISO ?? s.lastActivityAtISO)];
    const next = order(session), old = previous ? order(previous) : null;
    if (!old || next[0] > old[0] || (next[0] === old[0] && next[1] >= old[1])) byId.set(session.id, session);
  }
  const snapshot: EffortSnapshot = {version: 1, generatedAt, source: 'local-usage-metadata', sessions: [...byId.values()], notes,
    ...(coverageStart === undefined ? {} : {coverageStart})};
  summarizeEffort(snapshot); // Reject arithmetic overflow before any DOM consumer sees it.
  return snapshot;
}

const total = (values: readonly (number | null)[], integer = true): number | null => {
  const known = values.filter((n): n is number => n !== null);
  if (!known.length) return null;
  const sum = known.reduce((a, b) => a + b, 0);
  if (!Number.isFinite(sum) || (integer && !Number.isSafeInteger(sum)) || sum > Number.MAX_SAFE_INTEGER) return fail('aggregate overflow');
  return sum;
};

export function summarizeEffort(snapshot: EffortSnapshot): EffortSummary {
  const sessions = snapshot.sessions;
  const inputTokens = total(sessions.map(s => s.inputTokens)), outputTokens = total(sessions.map(s => s.outputTokens));
  return {sessionCount: sessions.length, agentSeconds: total(sessions.map(s => s.activeSeconds)),
    unionSeconds: sessions.length && sessions.every(s => s.activityIntervals !== undefined || s.activeSeconds === 0)
      ? unionActivitySeconds(sessions.flatMap(s => s.activityIntervals ?? [])) : null,
    inputTokens, outputTokens, cachedInputTokens: total(sessions.map(s => s.cachedInputTokens)),
    totalTokens: total([inputTokens, outputTokens]),
    tokensPartial: !sessions.length || sessions.some(s => s.inputTokens === null || s.outputTokens === null),
    estimatedApiCostUsd: total(sessions.map(s => s.estimatedApiCostUsd), false),
    estimatePartial: !sessions.length || sessions.some(s => s.estimatedApiCostUsd === null)};
}

export function isEffortStale(snapshot: EffortSnapshot | null, now = Date.now()): boolean {
  if (!snapshot || !Number.isFinite(now)) return true;
  const age = now - Date.parse(snapshot.generatedAt);
  return !Number.isFinite(age) || age < 0 || age > EFFORT_STALE_MS;
}

/** No credentials, private logs, prompts or local storage are sent by this public reader. */
export async function fetchEffortSnapshot(options: {
  signal?: AbortSignal; fetchImpl?: Fetch; now?: () => number; timeoutMs?: number;
} = {}): Promise<EffortRead> {
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init)), now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? EFFORT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return fail('timeout');
  let best: EffortRead | null = null;
  for (const [base, origin] of [[EFFORT_REMOTE_URL, 'remote'], [EFFORT_FALLBACK_URL, 'fallback']] as const) {
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const controller = new AbortController(), relay = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', relay, {once: true});
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${base}?minute=${Math.floor(now() / EFFORT_POLL_MS)}`, {
        signal: controller.signal, credentials: 'omit', cache: 'no-store', headers: {accept: 'application/json'},
      });
      if (!response.ok) throw new Error('Usage snapshot unavailable');
      const raw = await response.text();
      if (controller.signal.aborted || options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (raw.length > 2_000_000) throw new Error('Usage snapshot too large');
      const snapshot = parseEffortSnapshot(JSON.parse(raw), now());
      if (!best || Date.parse(snapshot.generatedAt) > Date.parse(best.snapshot.generatedAt)) best = {snapshot, origin};
      if (origin === 'remote' && !isEffortStale(snapshot, now())) return best;
    } catch {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      // A failed or invalid remote does not prevent reading the validated build snapshot.
    } finally {
      clearTimeout(timer); options.signal?.removeEventListener('abort', relay);
    }
  }
  if (!best) throw new Error('No valid development usage snapshot');
  return best;
}
