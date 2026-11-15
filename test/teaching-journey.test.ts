// The step after the boat, played through: first visit, walking away and coming back, one completion only, a pause,
// a reload at each saved fact, old / newer / corrupt records, and no reading required to act.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readingTime, type EpisodeData, type Fala, type Vec2 } from "../src/missions.ts";
import { epilogueLine } from "../src/freeroam.ts";
import { SCENE_DEVELOPMENT_NOTICE } from "../src/journey.ts";
import { LocalSaveStore, SAVE_KEY, newSave, recordMission } from "../src/save.ts";
import { WorldStateStore, newWorldState, savedStage, worldStateKey } from "../src/world-state.ts";
import {
  TEACHING, TEACHING_ACTION, TEACHING_ID, TEACHING_ONWARD_ID, beginTeaching, freshTeaching, onwardPlaceName, recordTeaching, restoreTeaching,
  stepTeaching, streetAhead, teachingLines, teachingStage, teachingView,
  type TeachingData, type TeachingEvent, type TeachingPlace, type TeachingState,
} from "../src/teaching-journey.ts";

const json = <T>(path: string): T => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));
const data = json<TeachingData>("src/data/mc-ensino.json");
const episode = json<EpisodeData>("src/data/mc-pescadores.json");
const lines = teachingLines(data)!;

// a street 60 m long running south to a court, and a house 40 m east of it
const place: TeachingPlace = { court: { x: 0, z: 60 }, street: [{ x: 0, z: 0 }, { x: 0, z: 30 }, { x: 0, z: 60 }], onward: { x: 40, z: 60 } };
const DT = 0.05;

/** Plays frames at `pos` until `until` says so (or `max` seconds pass); returns the state and every event. */
function play(s: TeachingState, pos: Vec2, opts: { action?: boolean | "always"; max?: number; until?: (s: TeachingState) => boolean } = {}) {
  const events: TeachingEvent[] = [];
  let first = true;
  for (let t = 0; t < (opts.max ?? 60); t += DT) {
    const r = stepTeaching(s, place, lines, { pos, action: opts.action === "always" || (first && opts.action === true) }, DT);
    s = r.next; events.push(...r.events); first = false;
    if (opts.until?.(s)) break;
  }
  return { s, events };
}
const types = (ev: TeachingEvent[]) => ev.map((e) => (e.type === "save" ? `save:${e.stage}` : e.type));

test("the clauses on screen are literal BLIVRE, derived from the data, and continue where the epilogue stopped", () => {
  const v21 = data.versiculos["Mark.1.21"], v22 = data.versiculos["Mark.1.22"];
  assert.equal(v21, episode.versiculos["Mark.1.21"], "the same verse as the episode's data: same source, same declared alteration");
  for (const v of [v21, v22, data.depois.texto]) assert.ok(!/[\[\]]/.test(v), "no bracket reaches the screen");
  assert.equal(lines.length, 2);
  // the epilogue showed the verse's first clause; this step shows the rest of it, to the letter
  assert.equal(`${epilogueLine(episode)!.texto}; ${lines[0].texto}`, v21);
  assert.equal(lines[0].ref, "Marcos 1:21");
  // the response is the verse's opening, up to the source's first comma
  assert.ok(v22.startsWith(`${lines[1].texto},`));
  assert.equal(lines[1].ref, "Marcos 1:22");
  assert.equal(lines[1].texto, "E ficavam admirados com o seu ensinamento");
  // the source's own slip in the rest of the verse is neither corrected nor shown
  assert.ok(v22.includes("temautoridade"), "the data keeps the file's spelling");
  assert.ok(!lines.some((l) => l.texto.includes("temautoridade")));
  assert.equal(data.ref_pt, "Marcos 1:21–22");
  // the same BLIVRE file the game's Bible was built from (tools/build_teaching.py --check compares the text itself)
  const bible = json<{ origem: { texto_sha256: string } }>("src/data/biblia-cronologica.json");
  assert.equal((data as unknown as { origem: { texto_sha256: string } }).origem.texto_sha256, bible.origem.texto_sha256);
  // where the text goes next is named with the verse's own words
  assert.equal(onwardPlaceName(data), "casa de Simão e de André");
  assert.ok(data.depois.texto.includes(onwardPlaceName(data)!));
});

test("a verse missing or with another shape stages nothing rather than something typed", () => {
  assert.equal(teachingLines({ ref_pt: data.ref_pt, versiculos: {} }), null);
  assert.equal(teachingLines({ ref_pt: data.ref_pt, versiculos: { ...data.versiculos, "Mark.1.21": "sem ponto e vírgula" } }), null);
  assert.equal(teachingLines({ ref_pt: "", versiculos: data.versiculos }), null);
  assert.equal(onwardPlaceName({ depois: { ...data.depois, texto: "outro texto" } }), null);
  // with nothing to stage the place never offers the action, and the view says the story is still being prepared
  let s = beginTeaching(freshTeaching()).next;
  for (let i = 0; i < 40; i++) s = stepTeaching(s, place, null, { pos: place.court, action: true }, DT).next;
  assert.equal(s.phase, "walk");
  const v = teachingView(s, place, data, null, place.court, false)!;
  assert.equal(v.action, null); assert.equal(v.goal, null); assert.equal(v.objective, "Explore a cidade");
});

test("first visit: the street, the place, the action, two clauses, and what comes next, without ever opening the Bible", () => {
  let s = freshTeaching();
  assert.equal(teachingView(s, place, data, lines, { x: 0, z: 0 }, false), null, "nothing shown before it opens");
  assert.deepEqual(stepTeaching(s, place, lines, { pos: place.court, action: true }, DT), { next: s, events: [] }, "and nothing happens before it opens");
  const opened = beginTeaching(s);
  assert.deepEqual(types(opened.events), ["begin", "save:accepted"]);
  s = opened.next;
  assert.equal(beginTeaching(s).next, s, "opening twice changes nothing");

  // on the way: an objective, a distance, the street ahead, the game's opening words; no button
  let v = teachingView(s, place, data, lines, { x: 3, z: 10 }, false)!;
  assert.equal(v.phase, "walk"); assert.equal(v.action, null); assert.equal(v.line, null);
  assert.equal(v.ref, "Marcos 1:21–22");
  assert.ok(Math.abs(v.dist! - Math.hypot(3, 50)) < 1e-9);
  assert.deepEqual(v.goal, place.court);
  assert.deepEqual(v.route, [{ x: 0, z: 10 }, { x: 0, z: 30 }, { x: 0, z: 60 }], "from the nearest point of the street, never a straight line from off it");
  assert.ok(v.narrative.length > 0 && v.guidance.length > 0);
  // pressing the button far from the place does nothing
  assert.deepEqual(types(play(s, { x: 0, z: 10 }, { action: "always", max: 2 }).events), []);

  // arriving offers the action, with the scene's honest notice
  let r = play(s, { x: 0, z: 60 - TEACHING.radius + 0.1 }, { max: 1 });
  assert.deepEqual(types(r.events), ["arrived"]);
  s = r.s; assert.equal(s.phase, "ready");
  v = teachingView(s, place, data, lines, place.court, false)!;
  assert.equal(v.action, TEACHING_ACTION);
  assert.equal(v.scene, SCENE_DEVELOPMENT_NOTICE);
  assert.match(v.narrative, /escolha do jogo/, "the place is declared the game's choice");
  assert.match(v.guidance, /Aperte E/);
  assert.match(teachingView(s, place, data, lines, place.court, true)!.guidance, /Toque em Ensinar/);

  // one press: the first clause for its reading time, then the second, then done, once
  r = play(s, place.court, { action: true, until: (x) => x.phase === "done" });
  assert.deepEqual(types(r.events), ["line", "line", "done", "save:completed"]);
  assert.deepEqual(r.events.filter((e) => e.type === "line").map((e) => (e as { fala: Fala }).fala), lines);
  const total = readingTime(lines[0].texto) + readingTime(lines[1].texto);
  assert.ok(Math.abs(r.s.time - s.time - total) <= 3 * DT, `the clauses stay their reading time (${total.toFixed(2)} s)`);
  s = r.s;
  assert.equal(teachingStage(s), "completed");

  // lived: the text's next passage is named as not staged; the verse that names the next place is quoted whole
  v = teachingView(s, place, data, lines, place.court, false)!;
  assert.equal(v.phase, "done"); assert.equal(v.action, null); assert.equal(v.line, null);
  assert.equal(v.objective, "Siga para a casa de Simão e de André");
  assert.deepEqual(v.announce, { texto: data.depois.texto, ref: "Marcos 1:29" });
  assert.match(v.narrative, /Marcos 1:23–28/); assert.match(v.narrative, /não é encenado/);
  assert.deepEqual(v.goal, place.onward); assert.equal(v.dist, 40);
  assert.match(v.guidance, /em preparação/);
});

test("once lived, the step points at the house until he gets there, says so for a moment, and then gives the screen back", () => {
  const lived = play(play(beginTeaching(freshTeaching()).next, place.court, { max: 1 }).s, place.court, { action: true, until: (x) => x.phase === "done" }).s;
  // however long he wanders, the house stays the objective: the radar keeps somewhere to point
  let r = play(lived, { x: -300, z: -300 }, { max: 120 });
  assert.deepEqual(r.events, []);
  let v = teachingView(r.s, place, data, lines, { x: -300, z: -300 }, false)!;
  assert.deepEqual(v.goal, place.onward); assert.equal(v.objective, "Siga para a casa de Simão e de André");
  // just outside the radius nothing happens; inside it he has arrived, once
  r = play(r.s, { x: 40, z: 60 - TEACHING.onward - 0.5 }, { max: 1 });
  assert.deepEqual(r.events, []);
  const at = { x: 40, z: 60 - TEACHING.onward + 0.5 };
  r = play(r.s, at, { action: "always", max: 2 });
  assert.deepEqual(types(r.events), ["onward"]);
  assert.equal(r.s.phase, "done"); assert.equal(teachingStage(r.s), "completed");
  // the radar has nowhere left to point and the guidance says the scene is not there yet
  v = teachingView(r.s, place, data, lines, at, false)!;
  assert.equal(v.goal, null); assert.equal(v.dist, null);
  assert.match(v.guidance, /Esta é a casa que o jogo escolheu/); assert.match(v.guidance, /em preparação/);
  // after its moment the step has nothing left to say: null hands the screen to the region's exploration again
  r = play(r.s, at, { max: TEACHING.afterOnward });
  assert.deepEqual(r.events, [], "arriving is noticed once");
  assert.equal(teachingView(r.s, place, data, lines, at, false), null);
  assert.equal(teachingView(r.s, place, data, lines, { x: -300, z: -300 }, false), null, "and walking away does not bring the objective back");
  // a town with no such house: the closing words for a while, then the same hand-back
  const bare = { ...place, onward: null };
  v = teachingView(lived, bare, data, lines, place.court, false)!;
  assert.equal(v.objective, "Explore a cidade"); assert.equal(v.goal, null);
  assert.deepEqual(v.announce, { texto: data.depois.texto, ref: "Marcos 1:29" }, "the verse is still announced");
  const later = play(lived, place.court, { max: TEACHING.afterDone + 0.5 }).s;
  assert.equal(teachingView(later, bare, data, lines, place.court, false), null);
  assert.ok(TEACHING.afterDone >= readingTime(data.depois.texto) + 7, "long enough for the verse and the closing words to be read");
  // the house is a fact of its own in the world record, kept apart from the teaching's
  const world = recordTeaching(newWorldState("s", "r15"), [{ type: "save", stage: "completed" }, { type: "onward" }], 9);
  assert.equal(savedStage(world, TEACHING_ID), "completed");
  assert.equal(savedStage(world, TEACHING_ONWARD_ID), "completed");
  assert.equal(savedStage(recordTeaching(newWorldState("s", "r15"), [{ type: "save", stage: "completed" }], 9), TEACHING_ONWARD_ID), null);
});

test("the clause on screen is the state's own, and the walk's opening words are not repeated to someone on the clauses", () => {
  let s = play(beginTeaching(freshTeaching()).next, place.court, { max: 1 }).s;
  s = stepTeaching(s, place, lines, { pos: place.court, action: true }, DT).next;
  const v = teachingView(s, place, data, lines, place.court, false)!;
  assert.equal(v.phase, "line"); assert.deepEqual(v.line, lines[0]);
  assert.equal(v.action, null, "no button while the clauses are on screen");
  assert.equal(v.narrative, ""); assert.equal(v.guidance, "");
  assert.equal(v.scene, SCENE_DEVELOPMENT_NOTICE);
});

test("walking away and coming back: the offer goes and returns; leaving during the clauses keeps nothing and it can be begun again", () => {
  let s = play(beginTeaching(freshTeaching()).next, place.court, { max: 1 }).s;
  assert.equal(s.phase, "ready");
  // inside the slack the offer holds; past it, it goes
  assert.deepEqual(types(play(s, { x: 0, z: 60 - TEACHING.radius - TEACHING.slack + 0.2 }, { max: 1 }).events), []);
  let r = play(s, { x: 0, z: 60 - TEACHING.radius - TEACHING.slack - 0.2 }, { action: "always", max: 1 });
  assert.deepEqual(types(r.events), ["left"]);
  assert.equal(r.s.phase, "walk");
  // back, the press begins the clauses
  r = play(r.s, place.court, { max: 1 }); assert.deepEqual(types(r.events), ["arrived"]);
  r = play(r.s, place.court, { action: true, max: 1 }); assert.deepEqual(types(r.events), ["line"]);
  // he may move about the place while they are on screen
  r = play(r.s, { x: 0, z: 60 - TEACHING.radius - TEACHING.leave + 0.5 }, { max: 0.5 });
  assert.equal(r.s.phase, "line");
  // further than that he has left: no completion, nothing to save
  r = play(r.s, { x: 0, z: 60 - TEACHING.radius - TEACHING.leave - 0.5 }, { max: 1 });
  assert.deepEqual(types(r.events), ["interrupted"]);
  assert.equal(r.s.phase, "walk"); assert.equal(r.s.line, null);
  assert.equal(teachingStage(r.s), "accepted");
  // returning starts from the first clause and ends once
  r = play(r.s, place.court, { max: 1 });
  r = play(r.s, place.court, { action: true, until: (x) => x.phase === "done" });
  assert.deepEqual(types(r.events), ["line", "line", "done", "save:completed"]);
});

test("the button held down or tapped again never restarts a clause or completes twice", () => {
  const ready = play(beginTeaching(freshTeaching()).next, place.court, { max: 1 }).s;
  const r = play(ready, place.court, { action: "always", max: 40 });
  assert.deepEqual(types(r.events), ["line", "line", "done", "save:completed"]);
  assert.equal(r.s.phase, "done");
  const after = play(r.s, place.court, { action: "always", max: 5 });
  assert.deepEqual(after.events, []);
  assert.equal(after.s.phase, "done");
});

test("a pause (a panel open, the tab hidden: dt 0) moves nothing, even with the button pressed", () => {
  const ready = play(beginTeaching(freshTeaching()).next, place.court, { max: 1 }).s;
  for (const dt of [0, -1, NaN]) assert.deepEqual(stepTeaching(ready, place, lines, { pos: place.court, action: true }, dt), { next: ready, events: [] });
  const onLine = stepTeaching(ready, place, lines, { pos: place.court, action: true }, DT).next;
  const paused = stepTeaching(onLine, place, lines, { pos: { x: 500, z: 500 }, action: true }, 0);
  assert.equal(paused.next, onLine, "the clause's time does not run and walking away is not seen");
});

test("a reload finds the step at its last saved fact, never mid-clause", () => {
  // never begun
  assert.deepEqual(restoreTeaching(null), freshTeaching());
  // begun in an earlier visit: opens again on the way, without the opening words
  let s = restoreTeaching("accepted");
  assert.equal(s.phase, "off"); assert.equal(teachingStage(s), null);
  s = beginTeaching(s).next;
  assert.equal(s.phase, "walk");
  assert.equal(teachingView(s, place, data, lines, { x: 0, z: 0 }, false)!.narrative, "");
  // a reload while the clauses were on screen saved only "accepted": it is begun again from the street
  const mid = play(play(beginTeaching(freshTeaching()).next, place.court, { max: 1 }).s, place.court, { action: true, max: 1 }).s;
  assert.equal(mid.phase, "line");
  assert.equal(teachingStage(mid), "accepted");
  // lived: stays lived, cannot be played over, announces what comes next
  s = restoreTeaching("completed");
  assert.equal(s.phase, "done");
  assert.equal(beginTeaching(s).next, s);
  assert.deepEqual(play(s, place.court, { action: "always", max: 3 }).events, []);
  assert.equal(teachingView(s, place, data, lines, place.court, false)!.objective, "Siga para a casa de Simão e de André");
  // lived and the house reached in an earlier visit: nothing left to say, the region's exploration has the screen
  s = restoreTeaching("completed", "completed");
  assert.equal(s.phase, "done"); assert.equal(s.onwardSeen, true);
  assert.equal(teachingView(s, place, data, lines, place.court, false), null);
  assert.deepEqual(play(s, place.onward!, { action: "always", max: 3 }).events, [], "and the house is not announced again");
  assert.equal(restoreTeaching("accepted", "completed").onwardSeen, false, "a house on record means nothing before the teaching was lived");
  // a stage this step does not use still counts as begun, never as lived
  assert.equal(restoreTeaching("returned").phase, "off");
  assert.equal(restoreTeaching("returned").intro, false);
});

// a key-value store as the browser's, in memory
function memory(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return { map: m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}
/** Opens the step for a save as main.ts will: load the world record, restore, begin; then play it to the end. */
function live(kv: ReturnType<typeof memory>, saveId: string, now: number) {
  const store = new WorldStateStore(kv);
  let world = store.load(saveId, "r15", now);
  let s = restoreTeaching(savedStage(world, TEACHING_ID));
  const writes: boolean[] = [];
  const apply = (r: { next: TeachingState; events: TeachingEvent[] }) => {
    s = r.next;
    const next = recordTeaching(world, r.events, now);
    if (next !== world) { world = next; writes.push(store.write(world)); }
  };
  apply(beginTeaching(s));
  const walked = play(s, place.court, { max: 1 }); apply({ next: walked.s, events: walked.events });
  const taught = play(s, place.court, { action: true, until: (x) => x.phase === "done" }); apply({ next: taught.s, events: taught.events });
  return { store, world, s, writes };
}

test("an old save (progress only, no world record) reaches the step, and the progress save is not touched by it", () => {
  let save = newSave(1000);
  for (let m = 0; m < 3; m++) save = recordMission(save, "mc-pescadores", m, 3, 2000 + m);
  const kv = memory();
  assert.ok(new LocalSaveStore(kv).write(save));
  const before = kv.map.get(SAVE_KEY)!;
  const { store, world, s, writes } = live(kv, save.id, 5000);
  assert.equal(s.phase, "done");
  assert.equal(store.status, "ok");
  assert.deepEqual(writes, [true, true], "written at the opening and at the completion, not every frame");
  assert.equal(savedStage(world, TEACHING_ID), "completed");
  assert.equal(kv.map.get(SAVE_KEY), before, "the progress save is byte for byte what it was");
  // the next visit finds it lived
  const again = new WorldStateStore(kv).load(save.id, "r15", 6000);
  assert.equal(restoreTeaching(savedStage(again, TEACHING_ID)).phase, "done");
  // and a repeated completion event writes nothing new
  assert.equal(recordTeaching(again, [{ type: "save", stage: "completed" }, { type: "save", stage: "accepted" }], 7000), again);
});

test("a record written by a newer build is left as it is: the step is lived for this visit only", () => {
  const id = "save-a", key = worldStateKey(id);
  const future = JSON.stringify({ v: 99, saveId: id, anything: { a: 1 } });
  const kv = memory({ [key]: future });
  const { store, s, writes } = live(kv, id, 5000);
  assert.equal(store.status, "newer");
  assert.equal(s.phase, "done", "playable all the same");
  assert.ok(writes.length > 0 && writes.every((w) => w === false), "and every write is refused");
  assert.equal(kv.map.get(key), future);
  assert.deepEqual([...kv.map.keys()], [key], "nothing else was stored");
});

test("a corrupt record is kept aside and the step starts over; storage that refuses still lets it be lived", () => {
  const id = "save-b", key = worldStateKey(id);
  const kv = memory({ [key]: "{ not json" });
  const { store, s, world } = live(kv, id, 5000);
  assert.equal(store.status, "ok");
  assert.equal(s.phase, "done");
  assert.equal(kv.map.get(`${key}:corrupt:5000`), "{ not json", "the unreadable text is still there");
  assert.equal(savedStage(world, TEACHING_ID), "completed");
  assert.equal(restoreTeaching(savedStage(new WorldStateStore(kv).load(id, "r15", 6000), TEACHING_ID)).phase, "done");
  // a record of the right shape whose stage for this step is not a stage at all is corrupt too, not "lived"
  const odd = memory({ [key]: JSON.stringify({ ...newWorldState(id, "r15"), encounters: { [TEACHING_ID]: { stage: "done", at: 1 } } }) });
  assert.equal(savedStage(new WorldStateStore(odd).load(id, "r15", 7000), TEACHING_ID), null);
  // no storage at all
  const none = new WorldStateStore({ getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() {} });
  const w = none.load(id, "r15", 8000);
  assert.equal(none.status, "unavailable");
  const r = beginTeaching(restoreTeaching(savedStage(w, TEACHING_ID)));
  assert.equal(r.next.phase, "walk");
  assert.equal(none.write(recordTeaching(w, r.events, 8000)), false);
});

test("the street ahead starts at his nearest point of it and never goes backwards", () => {
  const street = place.street;
  assert.deepEqual(streetAhead(street, { x: -5, z: -20 }), street.map((p) => ({ ...p })), "before its start: the whole street");
  assert.deepEqual(streetAhead(street, { x: 8, z: 45 }), [{ x: 0, z: 45 }, { x: 0, z: 60 }]);
  assert.deepEqual(streetAhead(street, { x: 0, z: 90 }), [{ x: 0, z: 60 }], "past its end: only the end");
  assert.deepEqual(streetAhead([], { x: 0, z: 0 }), []);
  assert.deepEqual(streetAhead([{ x: 1, z: 1 }], { x: 0, z: 0 }), []);
});
