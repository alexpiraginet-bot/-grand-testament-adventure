// The session diary: unclean ends found on the next load, reload counts, broken or refused storage, capped events,
// the heartbeat. A Map stands in for sessionStorage, an EventTarget for the window, a variable for the clock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BEAT_MS, MAX_EVENTS, MAX_MESSAGE, SESSION_EVENT_KINDS, SESSION_LOG_KEY, SESSION_LOG_VERSION, createSessionLog,
  installSessionLog, parseSessionRecord, shortMessage, type InstallOptions } from "../src/session-log.ts";

class MapStorage {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
}
class RefusingStorage {
  getItem(): string | null { throw new Error("SecurityError"); }
  setItem() { throw new Error("QuotaExceededError"); }
}
const event = (type: string, props: Record<string, unknown> = {}) => Object.assign(new Event(type), props);

/** A fake page: its window (an EventTarget holding the tab's storage), a clock it controls, a heartbeat it fires. */
function page(storage: unknown, t0: number, id: string, extra: Partial<InstallOptions> = {}) {
  const win = Object.assign(new EventTarget(), { sessionStorage: storage as Storage });
  const clock = { t: t0 };
  const timer = { fn: null as (() => void) | null, ms: 0, cleared: false };
  const log = installSessionLog(win, {
    now: () => clock.t, id,
    setInterval: (fn, ms) => { timer.fn = fn; timer.ms = ms; return timer; },
    clearInterval: (h) => { if (h === timer) timer.cleared = true; },
    ...extra,
  });
  return { win, clock, timer, log };
}

test("a load that ends without pagehide is reported as an unclean end by the next load", () => {
  const tab = new MapStorage();
  const a = page(tab, 1_000, "load-a");
  assert.equal(a.log.previous, null);
  a.log.setBackend("WebGPU");
  a.win.dispatchEvent(event("error", { message: "Uncaught TypeError: x is undefined" }));
  a.win.dispatchEvent(event("unhandledrejection", { reason: new RangeError("bad length") }));
  a.log.mark("device-lost", { message: "GPU device was lost" });
  a.clock.t += BEAT_MS; a.timer.fn!();
  const last = a.log.snapshot();
  // the tab dies here: no pagehide
  const b = page(tab, last.lastBeat + BEAT_MS, "load-b");
  assert.deepEqual(b.log.previous, { id: "load-a", start: last.start, lastBeat: last.lastBeat, backend: "WebGPU",
    counts: last.counts, events: last.events, uncleanEnd: true });
  assert.deepEqual(b.log.previous!.events.map((e) => [e.kind, e.msg]), [
    ["error", "Uncaught TypeError: x is undefined"], ["unhandledrejection", "RangeError: bad length"], ["device-lost", "GPU device was lost"]]);
  const now = b.log.snapshot();
  assert.equal(now.id, "load-b"); assert.equal(now.loads, 2); assert.equal(now.uncleanEnds, 1);
  assert.equal(now.cleanExit, false); assert.equal(now.backend, null);
  assert.deepEqual(now.events, []);
  assert.deepEqual(parseSessionRecord(tab.getItem(SESSION_LOG_KEY)), now);
  a.log.uninstall(); b.log.uninstall();
});

test("pagehide makes the end clean, and a page back from the back/forward cache is running again", () => {
  const tab = new MapStorage();
  const a = page(tab, 50, "a");
  a.win.dispatchEvent(event("pagehide", { persisted: true }));
  assert.equal(a.log.snapshot().cleanExit, true);
  assert.equal(parseSessionRecord(tab.getItem(SESSION_LOG_KEY))!.cleanExit, true);
  a.win.dispatchEvent(event("pageshow", { persisted: true }));
  assert.equal(parseSessionRecord(tab.getItem(SESSION_LOG_KEY))!.cleanExit, false);
  a.win.dispatchEvent(event("pageshow", { persisted: false }));   // a first show changes nothing
  a.win.dispatchEvent(event("pagehide", { persisted: false }));
  a.clock.t += BEAT_MS; a.timer.fn!();                              // a late beat does not undo the clean end
  assert.equal(parseSessionRecord(tab.getItem(SESSION_LOG_KEY))!.cleanExit, true);
  const b = page(tab, a.clock.t, "b");
  assert.equal(b.log.previous!.uncleanEnd, false);
  assert.equal(b.log.previous!.lastBeat, a.clock.t);
  assert.equal(b.log.snapshot().uncleanEnds, 0);
  a.log.uninstall(); b.log.uninstall();
});

test("every load of the tab is counted, and so is every one that died", () => {
  const tab = new MapStorage();
  const ends = [true, false, true, false, false];   // whether each load got its pagehide
  let t = 0;
  for (const [i, clean] of ends.entries()) {
    const p = page(tab, t, `load-${i}`);
    assert.equal(p.log.snapshot().loads, i + 1);
    assert.equal(p.log.snapshot().uncleanEnds, ends.slice(0, i).filter((c) => !c).length);
    if (i > 0) assert.equal(p.log.previous!.uncleanEnd, !ends[i - 1]);
    if (clean) p.win.dispatchEvent(event("pagehide"));
    p.log.uninstall();
    t += BEAT_MS;
  }
  // another tab has its own sessionStorage, so it starts from one
  assert.equal(page(new MapStorage(), t, "other").log.snapshot().loads, 1);
});

test("missing, corrupt or foreign records are ignored and replaced by a good one", () => {
  const good = { v: SESSION_LOG_VERSION, id: "x", start: 1, lastBeat: 2 };
  for (const text of [null, "", "{", "[]", "null", '"text"', "{}", JSON.stringify({ ...good, v: SESSION_LOG_VERSION + 1 }),
    JSON.stringify({ ...good, id: "" }), JSON.stringify({ ...good, start: "1" }), JSON.stringify({ ...good, lastBeat: null })]) {
    assert.equal(parseSessionRecord(text), null, String(text));
    const tab = new MapStorage(); if (text !== null) tab.setItem(SESSION_LOG_KEY, text);
    const log = createSessionLog({ storage: tab, now: () => 7, id: "fresh" }).start();
    assert.equal(log.previous, null);
    assert.equal(log.snapshot().loads, 1);
    assert.deepEqual(parseSessionRecord(tab.getItem(SESSION_LOG_KEY)), log.snapshot());
  }
  // a half-broken record still tells how the last load ended; its bad parts are dropped one by one
  const tab = new MapStorage();
  tab.setItem(SESSION_LOG_KEY, JSON.stringify({ ...good, loads: -3, uncleanEnds: 1.5, backend: 9, counts: { error: 2, shot: "many", nope: 4 },
    events: [{ t: 1, kind: "error", msg: "kept" }, { t: 2, kind: "nope", msg: "unknown kind" }, { kind: "shot", msg: "no time" }, 5, null] }));
  const log = createSessionLog({ storage: tab, now: () => 9, id: "next" }).start();
  const prev = log.previous!;
  assert.equal(prev.uncleanEnd, true); assert.equal(prev.backend, null);
  assert.deepEqual(prev.events, [{ t: 1, kind: "error", msg: "kept" }]);
  assert.deepEqual(Object.keys(prev.counts), [...SESSION_EVENT_KINDS]);
  assert.equal(prev.counts.error, 2); assert.equal(prev.counts.shot, 0);
  assert.equal(log.snapshot().loads, 2); assert.equal(log.snapshot().uncleanEnds, 1);
});

test("storage that throws, or a window whose storage cannot even be reached, never breaks the page", () => {
  const p = page(new RefusingStorage(), 10, "r");
  assert.equal(p.log.status, "unavailable");
  assert.equal(p.log.previous, null);
  assert.doesNotThrow(() => {
    p.win.dispatchEvent(event("error", { message: "boom" }));
    p.clock.t += BEAT_MS; p.timer.fn!();
    p.log.setBackend("WebGL2");
    p.win.dispatchEvent(event("pagehide"));
  });
  const s = p.log.snapshot();   // still kept in memory for this load
  assert.equal(s.counts.error, 1); assert.equal(s.lastBeat, p.clock.t); assert.equal(s.backend, "WebGL2"); assert.equal(s.cleanExit, true);
  p.log.uninstall();

  const blocked = new EventTarget();
  Object.defineProperty(blocked, "sessionStorage", { get() { throw new Error("SecurityError"); } });
  const log = installSessionLog(blocked, { now: () => 1, id: "b", setInterval: () => 0, clearInterval: () => {} });
  assert.equal(log.status, "unavailable");
  log.mark("shot", "still counted"); assert.equal(log.snapshot().counts.shot, 1);
  log.uninstall();
  assert.equal(createSessionLog({ storage: null }).start().status, "unavailable");
});

test("events keep a short message without stack or query strings, and only the last few are kept", () => {
  const tab = new MapStorage();
  const log = createSessionLog({ storage: tab, now: () => 1, id: "e" });
  const long = "x".repeat(MAX_MESSAGE * 3);
  log.mark("error", long);
  const msg = log.snapshot().events[0].msg;
  assert.equal(msg.length, MAX_MESSAGE); assert.ok(msg.endsWith("…"));

  const thrown = new TypeError("cannot read hero");
  assert.ok(thrown.stack!.includes("session-log.test.ts"));   // the stack has this file's URL; the diary must not
  assert.equal(shortMessage(thrown), "TypeError: cannot read hero");
  assert.equal(shortMessage("boom\n    at f (https://game.test/assets/main.js:1:2)\n    at g (https://game.test/a.js:3:4)"), "boom");
  assert.equal(shortMessage("bad\nf@https://game.test/assets/main.js:10:20"), "bad");
  assert.equal(shortMessage("fetch failed https://api.test/rpc?apikey=secret#frag"), "fetch failed https://api.test/rpc");
  assert.equal(shortMessage({ toString() { throw new Error("no"); } }), "(unreadable)");
  assert.equal(shortMessage(""), "(no message)");
  assert.equal(shortMessage(undefined), "undefined");

  const extra = 5;
  for (let i = 0; i < MAX_EVENTS + extra; i++) log.mark("shot", `#${i}`);
  const s = log.snapshot();
  assert.equal(s.events.length, MAX_EVENTS);
  assert.equal(s.events[0].msg, `#${extra}`);   // 1 + extra too many: the long error and shots #0..#(extra-1) fell off
  assert.equal(s.events.at(-1)!.msg, `#${MAX_EVENTS + extra - 1}`);
  assert.equal(s.counts.shot, MAX_EVENTS + extra); assert.equal(s.counts.error, 1);
  assert.equal(parseSessionRecord(tab.getItem(SESSION_LOG_KEY))!.events.length, MAX_EVENTS);
  log.mark("nope" as never, "ignored");
  assert.equal(log.snapshot().counts.shot, MAX_EVENTS + extra);
  // a snapshot is a copy
  s.events.length = 0; s.counts.shot = 0;
  assert.equal(log.snapshot().events.length, MAX_EVENTS); assert.equal(log.snapshot().counts.shot, MAX_EVENTS + extra);
});

test("the heartbeat writes lastBeat through the injected interval, and uninstall stops everything", () => {
  const tab = new MapStorage();
  const p = page(tab, 2_000, "h");
  assert.equal(p.timer.ms, BEAT_MS);
  const start = p.log.snapshot().start;
  const beats = 3;
  for (let i = 1; i <= beats; i++) {
    p.clock.t += BEAT_MS; p.timer.fn!();
    assert.equal(p.log.snapshot().lastBeat, start + i * BEAT_MS);
    assert.equal(parseSessionRecord(tab.getItem(SESSION_LOG_KEY))!.lastBeat, start + i * BEAT_MS);
  }
  assert.equal(p.log.snapshot().start, start);
  const custom = page(new MapStorage(), 0, "c", { intervalMs: BEAT_MS * 2 });
  assert.equal(custom.timer.ms, BEAT_MS * 2);
  custom.log.uninstall();

  p.log.uninstall();
  assert.equal(p.timer.cleared, true);
  p.win.dispatchEvent(event("error", { message: "after uninstall" }));
  p.win.dispatchEvent(event("pagehide"));
  assert.equal(p.log.snapshot().counts.error, 0);
  assert.equal(parseSessionRecord(tab.getItem(SESSION_LOG_KEY))!.cleanExit, false);
});
