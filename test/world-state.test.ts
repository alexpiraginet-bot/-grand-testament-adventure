// The local record of what the player changed in the world (src/world-state.ts): read with suspicion, written without
// losing the previous good copy, never going backwards, and enough to bring an encounter back after a reload.
import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, restore, tick, type Effect, type Encounter, type Gestures } from "../src/encounters.ts";
import { newWorldState, parseWorldState, recordStage, savedStage, WORLD_STATE_LIMITS, WorldStateStore, worldStateKey, type WorldState } from "../src/world-state.ts";

const SAVE = "save-abc", REV = "ep1-r1";
function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  let failing = false;
  return { data, fail: (on: boolean) => { failing = on; },
    kv: { getItem: (k: string) => { if (failing) throw new Error("denied"); return data.get(k) ?? null; },
      setItem: (k: string, v: string) => { if (failing) throw new Error("denied"); data.set(k, v); },
      removeItem: (k: string) => { data.delete(k); } } };
}
const stored = (o: unknown) => JSON.stringify(o);
const good: WorldState = { v: 1, saveId: SAVE, contentRevision: REV, encounters: { rede: { stage: "accepted", at: 1000 } } };

test("the record's key names its version and its save", () => {
  assert.equal(worldStateKey("save-abc"), "gta:world-state:v1:save-abc");
});

test("a stored record is read only if every part of it is what it should be", () => {
  assert.deepEqual(parseWorldState(null, SAVE), { kind: "empty" });
  assert.deepEqual(parseWorldState("", SAVE), { kind: "empty" });
  assert.deepEqual(parseWorldState(stored(good), SAVE), { kind: "ok", state: good });
  const reason = (o: unknown) => { const r = parseWorldState(typeof o === "string" ? o : stored(o), SAVE); return r.kind === "corrupt" ? r.reason : r.kind; };
  assert.equal(reason("{not json"), "not JSON");
  assert.equal(reason([1, 2]), "no version");
  assert.equal(reason({ ...good, v: 0 }), "no version");
  assert.equal(reason({ ...good, v: 2 }), "newer", "a newer build's record is not read, and is not called corrupt");
  assert.equal(reason({ ...good, saveId: "outro" }), "another save's record");
  assert.equal(reason({ ...good, contentRevision: "" }), "contentRevision");
  assert.equal(reason({ ...good, encounters: [] }), "encounters");
  assert.equal(reason({ ...good, encounters: { rede: { stage: "carrying", at: 1 } } }), "encounter rede", "only stable stages are stored");
  assert.equal(reason({ ...good, encounters: { rede: { stage: "accepted", at: "ontem" } } }), "encounter rede");
  assert.equal(reason({ ...good, encounters: { ["x".repeat(WORLD_STATE_LIMITS.idLength + 1)]: { stage: "accepted", at: 1 } } }), "encounter id");
  const many = Object.fromEntries(Array.from({ length: WORLD_STATE_LIMITS.encounters + 1 }, (_, i) => [`e${i}`, { stage: "accepted", at: 1 }]));
  assert.equal(reason({ ...good, encounters: many }), "too many encounters");
  assert.equal(reason(stored({ ...good, pad: "x".repeat(WORLD_STATE_LIMITS.bytes) })), "too large");
  // fields nobody asked for are dropped on the way in
  const extra = parseWorldState(stored({ ...good, pose: [1, 2, 3], encounters: { rede: { stage: "accepted", at: 1000, timer: 0.4 } } }), SAVE);
  assert.deepEqual(extra, { kind: "ok", state: good });
});

test("stages only go forward: a repeat or an older fact changes nothing, not even the date", () => {
  let s = newWorldState(SAVE, REV);
  assert.equal(savedStage(s, "rede"), null);
  s = recordStage(s, "rede", "accepted", 1000);
  assert.deepEqual(s.encounters.rede, { stage: "accepted", at: 1000 });
  assert.equal(recordStage(s, "rede", "accepted", 2000), s, "the same fact again");
  s = recordStage(s, "rede", "returned", 3000);
  s = recordStage(s, "rede", "completed", 4000);
  assert.deepEqual(s.encounters.rede, { stage: "completed", at: 4000 });
  assert.equal(recordStage(s, "rede", "accepted", 5000), s, "a completion is never undone");
  assert.equal(recordStage(s, "rede", "returned", 5000), s);
  // a stage may be skipped forward (a record written by a build that saved less often), and others are untouched
  const t = recordStage(recordStage(newWorldState(SAVE, REV), "a", "completed", 1), "b", "accepted", 2);
  assert.deepEqual(t.encounters, { a: { stage: "completed", at: 1 }, b: { stage: "accepted", at: 2 } });
});

test("the store writes without losing the last good copy and reads back what it wrote", () => {
  const m = memory(), store = new WorldStateStore(m.kv), key = worldStateKey(SAVE);
  assert.deepEqual(store.load(SAVE, REV, 1), newWorldState(SAVE, REV));
  assert.equal(store.write(good), true);
  assert.deepEqual(store.load(SAVE, REV, 2), good);
  assert.equal(m.data.has(`${key}:prev`), false, "nothing to keep aside on the first write");
  const later = recordStage(good, "rede", "returned", 2000);
  assert.equal(store.write(later, "ep1-r2"), true);
  assert.deepEqual(JSON.parse(m.data.get(`${key}:prev`)!), good, "the previous good copy is kept");
  assert.deepEqual(store.load(SAVE, REV, 3), { ...later, contentRevision: "ep1-r2" }, "written under the revision in use");
  assert.equal(store.status, "ok");
  // another save has another record
  assert.deepEqual(store.load("outro-save", REV, 4), newWorldState("outro-save", REV));
});

test("a corrupt record is kept aside and the previous good copy is used; with none, an empty record", () => {
  const key = worldStateKey(SAVE);
  const m = memory({ [key]: "{broken", [`${key}:prev`]: stored(good) }), store = new WorldStateStore(m.kv);
  assert.deepEqual(store.load(SAVE, REV, 777), good);
  assert.equal(m.data.get(`${key}:corrupt:777`), "{broken", "never deleted");
  const alone = memory({ [key]: "{broken" });
  assert.deepEqual(new WorldStateStore(alone.kv).load(SAVE, REV, 5), newWorldState(SAVE, REV));
});

test("a newer build's record is left exactly as it is", () => {
  const key = worldStateKey(SAVE), text = stored({ ...good, v: 2, novo: true });
  const m = memory({ [key]: text }), store = new WorldStateStore(m.kv);
  assert.deepEqual(store.load(SAVE, REV, 1), newWorldState(SAVE, REV));
  assert.equal(store.status, "newer");
  assert.equal(store.write(good), false);
  assert.equal(m.data.get(key), text);
});

test("when the browser refuses storage the store says so and nothing is claimed saved", () => {
  const none = new WorldStateStore(null);
  // with no storage object at all (and none global under node), it is unavailable from the start
  assert.equal(none.status, "unavailable");
  assert.equal(none.write(good), false);
  assert.deepEqual(none.load(SAVE, REV, 1), newWorldState(SAVE, REV));
  const m = memory(), store = new WorldStateStore(m.kv);
  m.fail(true);
  assert.equal(store.write(good), false);
  assert.equal(store.status, "unavailable");
  m.fail(false);
  assert.equal(store.write(good), false, "once refused, it does not pretend to recover within the visit");
});

test("an encounter comes back from the record at each saved fact, and a reload mid-carry loses nothing and doubles nothing", () => {
  const G: Gestures = { pick: { length: 1.2, contact: 0.8 }, place: { length: 1, contact: 0.6 } };
  const m = memory(), store = new WorldStateStore(m.kv);
  let world = store.load(SAVE, REV, 0), now = 1000;
  const run = (r: { next: Encounter; effects: Effect[] }) => {
    for (const ef of r.effects) if (ef.type === "save") { world = recordStage(world, r.next.id, ef.stage, now++); assert.equal(store.write(world), true); }
    return r.next;
  };
  const reload = () => restore("rede", savedStage(new WorldStateStore(m.kv).load(SAVE, REV, 9), "rede"));
  let e = restore("rede", savedStage(world, "rede"));
  assert.equal(e.stage, "available");
  e = run(apply(e, { type: "talk" }));
  assert.equal(reload().stage, "available", "a conversation is not a fact");
  e = run(apply(e, { type: "accept" }));
  e = run(apply(e, { type: "pick" })); e = run(tick(e, 2, G));
  assert.equal(`${e.stage}/${e.object}`, "carrying/hands");
  assert.deepEqual(reload(), { id: "rede", stage: "accepted", object: "origin", gesture: 0, thanked: false }, "reloaded while carrying");
  e = run(apply(e, { type: "place" }, { atSupport: true })); e = run(tick(e, 2, G));
  assert.deepEqual(reload(), { id: "rede", stage: "resolved", object: "destination", gesture: 0, thanked: false });
  e = run(apply(e, { type: "thank" }));
  assert.deepEqual(reload(), { id: "rede", stage: "resolved", object: "destination", gesture: 0, thanked: true });
  assert.deepEqual(world.encounters.rede, { stage: "completed", at: 1002 }, "three facts saved, in order: accepted, returned, completed");
});

test("write rechecks a future version created by another tab after load and preserves both keys", () => {
  const key = worldStateKey(SAVE), m = memory({ [key]: stored(good), [`${key}:prev`]: "previous-copy" });
  const store = new WorldStateStore(m.kv), stale = store.load(SAVE, REV, 1);
  const future = stored({ ...good, v: 2, futureField: [1, 2, 3] });
  m.kv.setItem(key, future);
  assert.equal(store.write(recordStage(stale, "rede", "returned", 2)), false);
  assert.equal(store.status, "newer");assert.equal(m.data.get(key), future);
  assert.equal(m.data.get(`${key}:prev`), "previous-copy", "even the backup must remain untouched");
});

test("arbitrary encounter IDs round trip as own data without replacing prototypes", () => {
  const ids = ["__proto__", "constructor", "toString", "hasOwnProperty"];
  const encounters = Object.fromEntries(ids.map(id => [id, { stage: "accepted", at: 1 }]));
  const parsed = parseWorldState(stored({ ...good, encounters }), SAVE);
  assert.equal(parsed.kind, "ok");if (parsed.kind !== "ok") return;
  assert.equal(Object.getPrototypeOf(parsed.state.encounters), Object.prototype);
  assert.equal(Object.hasOwn(parsed.state.encounters, "__proto__"), true);
  for (const id of ids) assert.equal(savedStage(parsed.state, id), "accepted");
  assert.equal(savedStage(parsed.state, "stage"), null);assert.equal(savedStage(newWorldState(SAVE, REV), "__proto__"), null);
  const completed = recordStage(parsed.state, "__proto__", "completed", 2);
  assert.equal(savedStage(completed, "__proto__"), "completed");
  assert.equal(Object.getPrototypeOf(completed.encounters), Object.prototype);
  const m = memory(), store = new WorldStateStore(m.kv);assert.equal(store.write(completed), true);
  assert.deepEqual(store.load(SAVE, REV, 3), completed);
});

test("inherited encounter facts are never treated as saved own facts", () => {
  const state = newWorldState(SAVE, REV);
  state.encounters = Object.create({ phantom: { stage: "completed", at: 1 } });
  assert.equal(savedStage(state, "phantom"), null);
  const next = recordStage(state, "phantom", "accepted", 2);
  assert.equal(Object.hasOwn(next.encounters, "phantom"), true);assert.equal(savedStage(next, "phantom"), "accepted");
  assert.equal(Object.hasOwn(state.encounters, "phantom"), false);
});

test("a stale tab merges current completions and independent facts without moving equal-stage dates", () => {
  const key = worldStateKey(SAVE), m = memory({ [key]: stored(good) });
  const first = new WorldStateStore(m.kv), second = new WorldStateStore(m.kv);
  const a = first.load(SAVE, REV, 1), b = second.load(SAVE, REV, 1);
  const completed = recordStage(recordStage(a, "rede", "completed", 3), "banco", "returned", 4);
  assert.equal(first.write(completed), true);
  const stale = recordStage(recordStage(b, "rede", "returned", 5), "agua", "accepted", 6);
  assert.equal(second.write(stale, "ep1-r2"), true);
  const merged = second.load(SAVE, REV, 7);
  assert.deepEqual(merged.encounters, { rede: { stage: "completed", at: 3 }, banco: { stage: "returned", at: 4 }, agua: { stage: "accepted", at: 6 } } as const);
  assert.equal(merged.contentRevision, "ep1-r2");assert.deepEqual(JSON.parse(m.data.get(`${key}:prev`)!), completed);
  const repeated = { ...merged, encounters: { ...merged.encounters, rede: { stage: "completed" as const, at: 999 } } };
  assert.equal(first.write(repeated), true);assert.deepEqual(first.load(SAVE, REV, 8).encounters.rede, { stage: "completed", at: 3 });
  assert.deepEqual(b, good, "merging must not mutate the tab's stale snapshot");
});

test("stale merges also preserve special IDs with own-property semantics", () => {
  const key = worldStateKey(SAVE), done = recordStage(newWorldState(SAVE, REV), "__proto__", "completed", 8);
  const m = memory({ [key]: stored(done) }), store = new WorldStateStore(m.kv);
  const stale = recordStage(recordStage(newWorldState(SAVE, REV), "__proto__", "accepted", 9), "constructor", "returned", 10);
  assert.equal(store.write(stale), true);
  const readback = store.load(SAVE, REV, 11);assert.equal(savedStage(readback, "__proto__"), "completed");
  assert.equal(savedStage(readback, "constructor"), "returned");assert.equal(Object.getPrototypeOf(readback.encounters), Object.prototype);
});

test("invalid outgoing records fail before any storage mutation and do not disable a later valid write", () => {
  const key = worldStateKey(SAVE), m = memory({ [key]: stored(good), [`${key}:prev`]: "keep" }), store = new WorldStateStore(m.kv);
  const invalid: unknown[] = [null, { ...good, v: 2 }, { ...good, saveId: "" }, { ...good, saveId: 123 },
    { ...good, contentRevision: "" }, { ...good, encounters: { rede: { stage: "carrying", at: 1 } } },
    { ...good, encounters: { rede: { stage: "completed", at: NaN } } }, { ...good, encounters: { rede: { stage: "completed", at: Infinity } } }];
  const cyclic = { ...good, extra: {} };cyclic.extra = cyclic;invalid.push(cyclic);
  for (const payload of invalid) {
    assert.equal(store.write(payload as WorldState), false);assert.equal(store.status, "ok");
    assert.equal(m.data.get(key), stored(good));assert.equal(m.data.get(`${key}:prev`), "keep");
  }
  assert.equal(store.write(good, ""), false);assert.equal(m.data.get(`${key}:prev`), "keep");
  assert.equal(store.write(good), true);
});

test("a merged union over the encounter bound is rejected without losing either current key", () => {
  const facts = (prefix: string) => Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`${prefix}${i}`, { stage: "accepted" as const, at: 1 }]));
  const existing = { ...good, encounters: facts("a") }, incoming = { ...good, encounters: facts("b") };
  const key = worldStateKey(SAVE), m = memory({ [key]: stored(existing), [`${key}:prev`]: "keep" }), store = new WorldStateStore(m.kv);
  assert.equal(parseWorldState(stored(existing), SAVE).kind, "ok");assert.equal(parseWorldState(stored(incoming), SAVE).kind, "ok");
  assert.equal(store.write(incoming), false);assert.equal(store.status, "ok");
  assert.equal(m.data.get(key), stored(existing));assert.equal(m.data.get(`${key}:prev`), "keep");
});

test("the record size limit is UTF-8 bytes rather than only JavaScript code units", () => {
  const text = stored({ ...good, extra: "é".repeat(40000) });
  assert.ok(text.length < WORLD_STATE_LIMITS.bytes);assert.ok(new TextEncoder().encode(text).length > WORLD_STATE_LIMITS.bytes);
  assert.deepEqual(parseWorldState(text, SAVE), { kind: "corrupt", reason: "too large" });
  const m = memory(), store = new WorldStateStore(m.kv);assert.equal(store.write(JSON.parse(text)), false);assert.equal(m.data.size, 0);
});
