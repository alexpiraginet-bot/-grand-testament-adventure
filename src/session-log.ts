// A local diary of this tab's page loads, so a long phone soak can prove the game did not reload or crash: if a load
// ends without a clean pagehide (renderer crash, the OS killing the tab, a browser auto-reload), the next load finds its
// record still marked as running and says so. Kept in sessionStorage, which survives reloads of the same tab and goes
// away with it; nothing here is ever sent anywhere. The core (createSessionLog) takes its storage and clock from the
// caller and is tested in test/session-log.test.ts; installSessionLog only wires it to the window.
// One known blind spot: duplicating a tab copies its sessionStorage, so the copy sees a record that is still running.

export const SESSION_LOG_VERSION = 1;
export const SESSION_LOG_KEY = "gta:session";
export const BEAT_MS = 5000;          // heartbeat: how stale lastBeat may be while the page is alive and visible
export const MAX_EVENTS = 20;         // the last few events; counts keep the totals
export const MAX_MESSAGE = 200;       // characters per event message
const MAX_NAME = 40;                  // backend name, id

export const SESSION_EVENT_KINDS = ["error", "unhandledrejection", "device-lost", "context-lost", "shot"] as const;
export type SessionEventKind = (typeof SESSION_EVENT_KINDS)[number];
export type SessionEvent = { t: number; kind: SessionEventKind; msg: string };
export type SessionCounts = Record<SessionEventKind, number>;

export type SessionRecord = {
  v: typeof SESSION_LOG_VERSION;
  id: string;                         // this page load
  start: number;                      // ms since epoch
  lastBeat: number;
  backend: string | null;             // "WebGPU" / "WebGL2", set by the caller once the renderer is up
  loads: number;                      // page loads this tab has had, this one included
  uncleanEnds: number;                // earlier loads of this tab that ended without a clean pagehide
  counts: SessionCounts;              // events of this load, by kind (not capped)
  events: SessionEvent[];             // the last MAX_EVENTS of them
  cleanExit: boolean;                 // set on pagehide; still false on the next load means the page died
};

/** The load before this one in the same tab, as its record left it. */
export type PreviousLoad = Pick<SessionRecord, "id" | "start" | "lastBeat" | "backend" | "counts" | "events"> & { uncleanEnd: boolean };

type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min = 0): v is number => Number.isInteger(v) && (v as number) >= min;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isKind = (v: unknown): v is SessionEventKind => (SESSION_EVENT_KINDS as readonly unknown[]).includes(v);
const zeroCounts = (): SessionCounts => Object.fromEntries(SESSION_EVENT_KINDS.map((k) => [k, 0])) as SessionCounts;

function randomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// A stack frame line: V8 indents "    at f (url:1:2)", Gecko and WebKit write "f@url:1:2".
const FRAME = /^\s+at\s+\S|@\S+:\d+:\d+\s*$/;

/** Anything thrown or rejected -> one short line: the message only, never the stack (stack frames carry script URLs),
 * URLs without their query or fragment (they may hold a token), at most MAX_MESSAGE characters. */
export function shortMessage(input: unknown): string {
  let s: string;
  try {
    const o = input as { message?: unknown; name?: unknown } | null;
    if (typeof o === "object" && o !== null && typeof o.message === "string") {
      const name = typeof o.name === "string" ? o.name : "";
      s = name && o.message ? `${name}: ${o.message}` : o.message || name;
    } else s = typeof input === "string" ? input : String(input);
  } catch { s = "(unreadable)"; }   // a hostile toString, a revoked proxy
  const lines = s.split(/\r?\n/);
  const frame = lines.findIndex((l) => FRAME.test(l));
  s = (frame < 0 ? lines : lines.slice(0, frame)).join(" ")
    .replace(/\b(https?:\/\/[^\s?#]+)[?#]\S*/g, "$1").replace(/\s+/g, " ").trim() || "(no message)";
  return s.length > MAX_MESSAGE ? `${s.slice(0, MAX_MESSAGE - 1)}…` : s;
}

/** A record as stored (JSON text) -> a checked record, or null when missing, corrupt or from another version. Bad
 * events and counters are dropped one by one so a half-broken diary still tells that the last load did not end well. */
export function parseSessionRecord(text: string | null): SessionRecord | null {
  if (!text) return null;
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!isObj(raw) || raw.v !== SESSION_LOG_VERSION) return null;
  if (typeof raw.id !== "string" || !raw.id || !isNum(raw.start) || !isNum(raw.lastBeat)) return null;
  const counts = zeroCounts();
  if (isObj(raw.counts)) for (const k of SESSION_EVENT_KINDS) { const n = raw.counts[k]; if (isInt(n)) counts[k] = n; }
  const events = (Array.isArray(raw.events) ? raw.events : [])
    .filter((e): e is SessionEvent => isObj(e) && isNum(e.t) && isKind(e.kind) && typeof e.msg === "string")
    .slice(-MAX_EVENTS).map((e) => ({ t: e.t, kind: e.kind, msg: shortMessage(e.msg) }));
  return {
    v: SESSION_LOG_VERSION, id: raw.id.slice(0, MAX_NAME), start: raw.start, lastBeat: raw.lastBeat,
    backend: typeof raw.backend === "string" ? raw.backend.slice(0, MAX_NAME) : null,
    loads: isInt(raw.loads, 1) ? raw.loads : 1, uncleanEnds: isInt(raw.uncleanEnds) ? raw.uncleanEnds : 0,
    counts, events, cleanExit: raw.cleanExit === true,
  };
}

export type SessionLogOptions = { storage?: KV | null; now?: () => number; id?: string };

export type SessionLog = {
  /** Reads the previous load's record, then writes this one's. Idempotent; the other methods call it if needed. */
  start(): SessionLog;
  beat(): void;
  mark(kind: SessionEventKind, message: unknown): void;
  setBackend(name: string): void;
  /** pagehide: this load ended as a page should (navigation, reload, tab closed, or into the back/forward cache). */
  endClean(): void;
  /** pageshow from the back/forward cache: the same load is alive again. */
  resume(): void;
  snapshot(): SessionRecord;
  readonly previous: PreviousLoad | null;
  /** "unavailable" when the last storage access failed (private mode, blocked site data, quota): the diary then
   * lives in memory only and the next load will not find it. */
  readonly status: "ok" | "unavailable";
};

export function createSessionLog(opts: SessionLogOptions = {}): SessionLog {
  let storage: KV | null = null;
  if (opts.storage !== undefined) storage = opts.storage;
  else try { storage = (globalThis as { sessionStorage?: KV }).sessionStorage ?? null; } catch { storage = null; }
  const now = opts.now ?? (() => Date.now());
  const id = (opts.id ?? randomId()).slice(0, MAX_NAME);
  let status: "ok" | "unavailable" = storage ? "ok" : "unavailable";
  let rec: SessionRecord | null = null;
  let previous: PreviousLoad | null = null;

  const write = () => {
    if (!storage || !rec) return;
    try { storage.setItem(SESSION_LOG_KEY, JSON.stringify(rec)); status = "ok"; } catch { status = "unavailable"; }
  };
  const cur = (): SessionRecord => { if (!rec) log.start(); return rec!; };

  const log: SessionLog = {
    start() {
      if (rec) return log;
      let text: string | null = null;
      if (storage) try { text = storage.getItem(SESSION_LOG_KEY); } catch { status = "unavailable"; }
      const p = parseSessionRecord(text);
      if (p) previous = { id: p.id, start: p.start, lastBeat: p.lastBeat, backend: p.backend, counts: p.counts, events: p.events, uncleanEnd: !p.cleanExit };
      const t = now();
      rec = { v: SESSION_LOG_VERSION, id, start: t, lastBeat: t, backend: null, loads: (p?.loads ?? 0) + 1,
        uncleanEnds: (p?.uncleanEnds ?? 0) + (previous?.uncleanEnd ? 1 : 0), counts: zeroCounts(), events: [], cleanExit: false };
      write();
      return log;
    },
    beat() { cur().lastBeat = now(); write(); },
    mark(kind, message) {
      if (!isKind(kind)) return;   // callers in plain JS: an unknown kind must not add a counter
      const r = cur();
      r.counts[kind] += 1;
      r.events.push({ t: now(), kind, msg: shortMessage(message) });
      if (r.events.length > MAX_EVENTS) r.events.splice(0, r.events.length - MAX_EVENTS);
      write();
    },
    setBackend(name) { cur().backend = String(name).slice(0, MAX_NAME); write(); },
    endClean() { const r = cur(); r.cleanExit = true; r.lastBeat = now(); write(); },
    resume() { const r = cur(); r.cleanExit = false; r.lastBeat = now(); write(); },
    snapshot() { const r = cur(); return { ...r, counts: { ...r.counts }, events: r.events.map((e) => ({ ...e })) }; },
    get previous() { return previous; },
    get status() { return status; },
  };
  return log;
}

// ---------------------------------------------------------------- the browser's side

type WinLike = Pick<EventTarget, "addEventListener" | "removeEventListener"> & { sessionStorage?: KV };

export type InstallOptions = SessionLogOptions & {
  intervalMs?: number;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (handle: unknown) => void;
};

/** Starts the diary for this page load: window errors, unhandled rejections and pagehide are recorded, and a
 * heartbeat writes lastBeat every intervalMs. uninstall() undoes all of it (for tests and hot reload). */
export function installSessionLog(win: WinLike, opts: InstallOptions = {}): SessionLog & { uninstall(): void } {
  let storage: KV | null = null;
  if (opts.storage !== undefined) storage = opts.storage;
  else try { storage = win.sessionStorage ?? null; } catch { storage = null; }   // the getter itself throws when blocked
  const log = createSessionLog({ ...opts, storage }).start();
  // ErrorEvent.message is the browser's one-line summary; the thrown value stands in only when it is empty (and even
  // then shortMessage keeps its name and message, not its stack)
  const onError = (e: Event) => { const ev = e as Partial<ErrorEvent>; log.mark("error", ev.message || ev.error || "error"); };
  const onRejection = (e: Event) => log.mark("unhandledrejection", (e as Partial<PromiseRejectionEvent>).reason);
  const onHide = () => log.endClean();
  const onShow = (e: Event) => { if ((e as Partial<PageTransitionEvent>).persisted) log.resume(); };
  const listeners: [string, (e: Event) => void][] = [["error", onError], ["unhandledrejection", onRejection], ["pagehide", onHide], ["pageshow", onShow]];
  for (const [type, fn] of listeners) win.addEventListener(type, fn);
  const every = opts.setInterval ?? ((fn: () => void, ms: number) => globalThis.setInterval(fn, ms));
  const stop = opts.clearInterval ?? ((h: unknown) => globalThis.clearInterval(h as ReturnType<typeof globalThis.setInterval>));
  const handle = every(() => log.beat(), opts.intervalMs ?? BEAT_MS);
  return Object.assign(log, {
    uninstall() { stop(handle); for (const [type, fn] of listeners) win.removeEventListener(type, fn); },
  });
}
