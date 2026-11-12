// Saved progress: validation, the browser copy, merging two copies, resuming an episode.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LocalSaveStore, SAVE_KEY, mergeSaves, newSave, parseSave, recordMission, restartEpisode, type Save } from "../src/save.ts";
import { restoreState, step, type EpisodeData, type Goal } from "../src/missions.ts";

const ep = JSON.parse(readFileSync(new URL("../src/data/mc-pescadores.json", import.meta.url)).toString()) as EpisodeData;
const goals: Goal[] = [
  { kind: "reach", at: { x: 0, z: 100 }, radius: 18, below: 0.6 },
  { kind: "call", at: { x: -100, z: 120 }, radius: 7, npcs: ["simao", "andre"] },
  { kind: "call", at: { x: -200, z: 150 }, radius: 13, npcs: ["tiago", "joao"] },
];

class MemKV {
  m = new Map<string, string>();
  failWrites = false;
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { if (this.failWrites) throw new Error("QuotaExceededError"); this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

test("a save survives the round trip through storage", () => {
  const kv = new MemKV(), store = new LocalSaveStore(kv);
  let s = store.load(1000);
  s = recordMission(s, "mc-pescadores", 0, 3, 2000);
  s = { ...s, current: { episode: "mc-pescadores", mission: 1, pos: { x: -12, z: 330 }, heading: 1.2 }, playSeconds: 42 };
  assert.equal(store.write(s), true);
  const back = new LocalSaveStore(kv).load(3000);
  assert.deepEqual(back, s);
});

test("broken or foreign data never crashes the game and is kept aside, not deleted", () => {
  for (const text of ["{", "[]", '{"v":1}', '{"v":1,"id":"x","createdAt":1,"updatedAt":1,"playSeconds":-5,"episodes":{},"current":null}',
    '{"v":1,"id":"x","createdAt":1,"updatedAt":1,"playSeconds":0,"episodes":{"a":{"missionsDone":1.5,"completions":0,"firstCompletedAt":null,"lastCompletedAt":null}},"current":null}']) {
    assert.equal(parseSave(text).kind, "corrupt", text);
    const kv = new MemKV(); kv.setItem(SAVE_KEY, text);
    const s = new LocalSaveStore(kv).load(5000);
    assert.deepEqual(s.episodes, {});
    assert.equal(kv.getItem(`${SAVE_KEY}:corrupt:5000`), text);
  }
});

test("a corrupt save falls back to the previous good copy", () => {
  const kv = new MemKV(), store = new LocalSaveStore(kv);
  const a = recordMission(newSave(1), "mc-pescadores", 0, 3, 2);
  store.write(a);
  store.write(recordMission(a, "mc-pescadores", 1, 3, 3));     // a goes to the previous-copy slot
  kv.setItem(SAVE_KEY, "{garbage");
  const s = new LocalSaveStore(kv).load(9);
  assert.equal(s.episodes["mc-pescadores"].missionsDone, 1);
});

test("a save from a newer build is neither read nor overwritten", () => {
  const kv = new MemKV(); const text = '{"v":99,"anything":true}';
  kv.setItem(SAVE_KEY, text);
  const store = new LocalSaveStore(kv);
  store.load(1);
  assert.equal(store.status, "newer");
  assert.equal(store.write(newSave(2)), false);
  assert.equal(kv.getItem(SAVE_KEY), text);
});

test("when the browser refuses storage the game goes on and says so", () => {
  const kv = new MemKV(); kv.failWrites = true;
  const store = new LocalSaveStore(kv);
  assert.equal(store.write(newSave(1)), false);
  assert.equal(store.status, "unavailable");
  assert.equal(new LocalSaveStore(null).status, "unavailable");
});

test("finishing and replaying keeps the record", () => {
  let s = newSave(0);
  for (let m = 0; m < 3; m++) s = recordMission(s, "mc-pescadores", m, 3, 10 + m);
  assert.deepEqual(s.episodes["mc-pescadores"], { missionsDone: 3, completions: 1, firstCompletedAt: 12, lastCompletedAt: 12 });
  s = restartEpisode(s, "mc-pescadores", 20);
  assert.equal(s.episodes["mc-pescadores"].missionsDone, 0);
  assert.equal(s.episodes["mc-pescadores"].completions, 1);
  for (let m = 0; m < 3; m++) s = recordMission(s, "mc-pescadores", m, 3, 30 + m);
  assert.deepEqual(s.episodes["mc-pescadores"], { missionsDone: 3, completions: 2, firstCompletedAt: 12, lastCompletedAt: 32 });
});

test("merging two copies never loses a finished mission and continues from the newer place", () => {
  const phone: Save = { ...recordMission(newSave(100), "mc-pescadores", 1, 3, 200), current: { episode: "mc-pescadores", mission: 2, pos: { x: 1, z: 2 }, heading: 0 } };
  const pc: Save = { ...recordMission(newSave(50), "mc-pescadores", 0, 3, 300), current: { episode: "mc-pescadores", mission: 1, pos: { x: 9, z: 9 }, heading: 1 }, playSeconds: 500 };
  const m = mergeSaves(phone, pc);
  assert.equal(m.episodes["mc-pescadores"].missionsDone, 2);
  assert.deepEqual(m.current?.pos, { x: 9, z: 9 });   // the pc copy is newer
  assert.equal(m.playSeconds, 500);
  assert.equal(m.createdAt, 50);
  assert.equal(m.id, phone.id);
  assert.deepEqual(mergeSaves(m, m), m);
});

test("resuming an episode puts the right mission in play with the right people following", () => {
  const s0 = restoreState(ep, goals, 0);
  assert.equal(s0.mission, 0); assert.equal(s0.filled, 0); assert.deepEqual(s0.followers, []);
  const s2 = restoreState(ep, goals, 2);
  assert.equal(s2.phase, "play"); assert.equal(s2.mission, 2); assert.equal(s2.filled, 2);
  assert.deepEqual(s2.followers, ["simao", "andre"]); assert.equal(s2.completedAt.length, 2);
  // and the resumed mission plays to the end as usual
  step(s2, ep, goals, { pos: { x: -200, z: 150 }, groundHeight: 0.2, action: false }, 0.1);
  step(s2, ep, goals, { pos: { x: -200, z: 150 }, groundHeight: 0.2, action: true }, 0.1);
  const phase = () => s2.phase as string;            // step() changes it; keep the compiler from narrowing it
  for (let t = 0; t < 30 && phase() !== "done"; t += 0.1) step(s2, ep, goals, { pos: { x: -200, z: 150 }, groundHeight: 0.2, action: false }, 0.1);
  assert.equal(phase(), "done"); assert.equal(s2.filled, 4);
  assert.deepEqual(s2.followers, ["simao", "andre", "tiago", "joao"]);
});
