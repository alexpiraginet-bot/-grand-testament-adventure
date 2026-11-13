import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EFFORT_REMOTE_URL, EFFORT_FALLBACK_URL, EFFORT_STALE_MS, parseEffortSnapshot, summarizeEffort,
  unionActivitySeconds, isEffortStale, fetchEffortSnapshot} from '../src/effort.ts';

const NOW = Date.parse('2026-11-13T16:00:00.000Z');
const at = (seconds: number) => new Date(NOW + seconds * 1000).toISOString();
const session = (overrides: Record<string, unknown> = {}) => ({
  id: 'codex-main', label: 'Desenvolvimento visual', agent: 'codex', model: 'gpt-6-astra',
  startedAtISO: at(-600), lastActivityAtISO: at(-10), endedAtISO: null, activeSeconds: 100,
  inputTokens: 1000, cachedInputTokens: 800, outputTokens: 100, estimatedApiCostUsd: null, estimateBasis: null,
  ...overrides,
});
const snapshot = (overrides: Record<string, unknown> = {}) => ({
  version: 1, generatedAt: at(0), coverageStart: at(-600), source: 'local-usage-metadata', sessions: [session()],
  notes: ['Registro parcial; outras sessões podem não estar incluídas.'], ...overrides,
});
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status});

test('missing usage remains unknown, including an empty snapshot; explicit observed zero stays zero', () => {
  const empty = summarizeEffort(parseEffortSnapshot(snapshot({sessions: []}), NOW));
  assert.equal(empty.sessionCount, 0);
  for (const key of ['agentSeconds', 'unionSeconds', 'inputTokens', 'cachedInputTokens', 'outputTokens', 'totalTokens', 'estimatedApiCostUsd'] as const) {
    assert.equal(empty[key], null, key);
  }
  const unknown = summarizeEffort(parseEffortSnapshot(snapshot({sessions: [session({inputTokens: null, cachedInputTokens: null, outputTokens: null})]}), NOW));
  assert.equal(unknown.totalTokens, null); assert.equal(unknown.estimatedApiCostUsd, null); assert.equal(unknown.tokensPartial, true);
  const zero = summarizeEffort(parseEffortSnapshot(snapshot({sessions: [session({activeSeconds: 0, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0})]}), NOW));
  assert.equal(zero.totalTokens, 0); assert.equal(zero.agentSeconds, 0); assert.equal(zero.estimatedApiCostUsd, null);
});

test('deduplication keeps the newest observed session instead of adding repeated cumulative counters', () => {
  const old = session({lastActivityAtISO: at(-100), inputTokens: 100, cachedInputTokens: 80});
  const fresh = session({lastActivityAtISO: at(-10), inputTokens: 1400, cachedInputTokens: 900});
  const s = parseEffortSnapshot(snapshot({sessions: [fresh, old, fresh]}), NOW);
  assert.equal(s.sessions.length, 1); assert.equal(s.sessions[0].inputTokens, 1400);
  assert.equal(summarizeEffort(s).totalTokens, 1500);
  const closed = session({endedAtISO: at(-5)});
  assert.equal(parseEffortSnapshot(snapshot({sessions: [closed, session()]}), NOW).sessions[0].endedAtISO, at(-5));
});

test('tokens count input plus output once, with cache as input subset and missing subtotals labelled partial', () => {
  const observed = session({inputTokens: 8_400_000, cachedInputTokens: 8_300_000, outputTokens: 16_000});
  const full = summarizeEffort(parseEffortSnapshot(snapshot({sessions: [observed]}), NOW));
  assert.equal(full.totalTokens, 8_416_000); assert.equal(full.cachedInputTokens, 8_300_000); assert.equal(full.tokensPartial, false);
  const partial = summarizeEffort(parseEffortSnapshot(snapshot({sessions: [observed, session({id: 'claude-main', agent: 'claude', inputTokens: 50, cachedInputTokens: null, outputTokens: null})]}), NOW));
  assert.equal(partial.totalTokens, 8_416_050); assert.equal(partial.tokensPartial, true);
});

test('agent-hours and union activity are different, with overlapping and repeated intervals merged', () => {
  const a = session({id: 'a', activeSeconds: 60, activityIntervals: [{start: at(-120), end: at(-60)}]});
  const b = session({id: 'b', agent: 'claude', activeSeconds: 60, activityIntervals: [{start: at(-90), end: at(-30)}]});
  const summary = summarizeEffort(parseEffortSnapshot(snapshot({sessions: [a, b]}), NOW));
  assert.equal(summary.agentSeconds, 120); assert.equal(summary.unionSeconds, 90);
  const overlap = [{start: at(-120), end: at(-60)}, {start: at(-90), end: at(-30)}, {start: at(-120), end: at(-60)}];
  assert.equal(unionActivitySeconds(overlap), 90);
  assert.equal(unionActivitySeconds([...overlap, {start: at(-20), end: at(-10)}]), 100);
  const missing = summarizeEffort(parseEffortSnapshot(snapshot({sessions: [a, session({id: 'b'})]}), NOW));
  assert.equal(missing.agentSeconds, 160); assert.equal(missing.unionSeconds, null);
  assert.equal(unionActivitySeconds([]), 0);
});

test('elapsed wall time never increases usage; staleness starts strictly after 150 seconds', () => {
  const s = parseEffortSnapshot(snapshot(), NOW), before = summarizeEffort(s);
  assert.equal(isEffortStale(s, NOW + EFFORT_STALE_MS), false);
  assert.equal(isEffortStale(s, NOW + EFFORT_STALE_MS + 1), true);
  assert.deepEqual(summarizeEffort(s), before);
  assert.equal(isEffortStale(null, NOW), true); assert.equal(isEffortStale(s, NOW - 1), true);
});

test('API equivalent requires a supplied basis, never derives cost from a model or subscription', () => {
  const unknown = summarizeEffort(parseEffortSnapshot(snapshot(), NOW));
  assert.equal(unknown.estimatedApiCostUsd, null);
  const priced = session({estimatedApiCostUsd: .123, estimateBasis: 'Tarifa publicada; comparação hipotética, não cobrada.'});
  const s = summarizeEffort(parseEffortSnapshot(snapshot({sessions: [priced, session({id: 'other'})]}), NOW));
  assert.equal(s.estimatedApiCostUsd, .123); assert.equal(s.estimatePartial, true);
  assert.throws(() => parseEffortSnapshot(snapshot({sessions: [session({estimatedApiCostUsd: .123})]}), NOW));
  assert.throws(() => parseEffortSnapshot(snapshot({sessions: [session({model: 'unknown', estimatedApiCostUsd: 1, estimateBasis: 'guess'})]}), NOW));
  assert.throws(() => parseEffortSnapshot(snapshot({subscriptionCost: 999}), NOW));
});

test('strict numeric, calendar and chronology validation rejects fabricated or impossible values', () => {
  const badSessions: Record<string, unknown>[] = [
    {activeSeconds: -1}, {activeSeconds: 1.5}, {activeSeconds: Infinity}, {activeSeconds: 1000},
    {inputTokens: NaN}, {inputTokens: -1}, {inputTokens: 1.1}, {inputTokens: true}, {inputTokens: Number.MAX_SAFE_INTEGER + 1},
    {cachedInputTokens: 1001}, {inputTokens: null, cachedInputTokens: 1}, {outputTokens: undefined},
    {estimatedApiCostUsd: Infinity}, {estimatedApiCostUsd: -1}, {estimateBasis: undefined},
    {startedAtISO: at(1)}, {lastActivityAtISO: at(1)}, {endedAtISO: at(1)}, {endedAtISO: at(-20)},
    {lastActivityAtISO: at(-700)}, {startedAtISO: '2026-02-30T00:00:00Z'}, {startedAtISO: '2026-11-13'},
    {startedAtISO: '2026-11-13T00:00:00+99:99'}, {agent: 'other'}, {id: ''}, {model: ''},
    {activityIntervals: [{start: at(-601), end: at(-500)}]},
    {activityIntervals: [{start: at(-20), end: at(-30)}]},
    {activityIntervals: [{start: at(-20), end: at(1)}]},
    {activityIntervals: []}, {activityIntervals: [{start: at(-100), end: at(-99)}]},
    {reasoningTokens: 42},
  ];
  for (const change of badSessions) assert.throws(() => parseEffortSnapshot(snapshot({sessions: [session(change)]}), NOW), JSON.stringify(change));
  for (const change of [{version: 2}, {generatedAt: at(1)}, {coverageStart: at(1)}, {source: 'estimate'}, {notes: [false]}, {sessions: null}]) {
    assert.throws(() => parseEffortSnapshot(snapshot(change), NOW), JSON.stringify(change));
  }
  const huge = session({inputTokens: Number.MAX_SAFE_INTEGER, cachedInputTokens: 0, outputTokens: 1});
  assert.throws(() => parseEffortSnapshot(snapshot({sessions: [huge]}), NOW), /overflow/);
});

test('public fetch uses minute cache busting and no credentials, accepting a valid remote without fallback', async () => {
  const calls: {url: string; init?: RequestInit}[] = [];
  const r = await fetchEffortSnapshot({now: () => NOW, fetchImpl: async (url, init) => {calls.push({url, init}); return json(snapshot());}});
  assert.equal(r.origin, 'remote'); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${EFFORT_REMOTE_URL}?minute=${Math.floor(NOW / 60000)}`);
  assert.equal(calls[0].init?.credentials, 'omit'); assert.equal(calls[0].init?.cache, 'no-store');
});

test('invalid or unavailable remote falls back to a validated local snapshot; absence is never converted to zero', async () => {
  let calls = 0;
  const r = await fetchEffortSnapshot({now: () => NOW, fetchImpl: async url => {
    calls++;
    return url.startsWith(EFFORT_REMOTE_URL) ? json(snapshot({sessions: [session({cachedInputTokens: 9999})]})) : json(snapshot({sessions: []}));
  }});
  assert.equal(calls, 2); assert.equal(r.origin, 'fallback'); assert.equal(summarizeEffort(r.snapshot).totalTokens, null);
  await assert.rejects(fetchEffortSnapshot({now: () => NOW, fetchImpl: async () => json({}, 503)}), /No valid/);
});

test('stale remote and fallback are compared by timestamp rather than silently replacing newer records', async () => {
  const old = snapshot({generatedAt: at(-300), sessions: [], coverageStart: at(-600)});
  const older = snapshot({generatedAt: at(-400), sessions: [], coverageStart: at(-600)});
  const retained = await fetchEffortSnapshot({now: () => NOW, fetchImpl: async url => json(url.startsWith(EFFORT_REMOTE_URL) ? old : older)});
  assert.equal(retained.origin, 'remote'); assert.equal(retained.snapshot.generatedAt, at(-300));
  const fresh = await fetchEffortSnapshot({now: () => NOW, fetchImpl: async url => json(url.startsWith(EFFORT_REMOTE_URL) ? old : snapshot())});
  assert.equal(fresh.origin, 'fallback'); assert.equal(isEffortStale(fresh.snapshot, NOW), false);
});

test('request timeout aborts remote before fallback, while caller abort cancels the whole read', async () => {
  let timedOut = false;
  const result = await fetchEffortSnapshot({now: () => NOW, timeoutMs: 5, fetchImpl: (url, init) => {
    if (url.startsWith(EFFORT_FALLBACK_URL)) return Promise.resolve(json(snapshot()));
    return new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => {timedOut = true; reject(new DOMException('Aborted', 'AbortError'));}, {once: true}));
  }});
  assert.equal(timedOut, true); assert.equal(result.origin, 'fallback');
  const external = new AbortController(); let requests = 0;
  await assert.rejects(fetchEffortSnapshot({now: () => NOW, signal: external.signal, fetchImpl: (_url, init) => {
    requests++; queueMicrotask(() => external.abort());
    return new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {once: true}));
  }}), {name: 'AbortError'});
  assert.equal(requests, 1);
  await assert.rejects(fetchEffortSnapshot({signal: external.signal, fetchImpl: async () => {throw new Error('Must not request');}}), {name: 'AbortError'});
});
