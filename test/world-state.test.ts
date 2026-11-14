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
