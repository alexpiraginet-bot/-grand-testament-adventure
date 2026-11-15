// The story played through on the real terrain's places: twenty steps, each lived once, each kept in the world
// record, each reopened where it was left. No frame here knows about reading the Bible: nothing gates a step.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MARGIN, P, beach, routes, scene, start, t } from "./fixtures/town-scene.ts";
import { townLife } from "../src/town-life-layout.ts";
import { storyPlaces } from "../src/story-places.ts";
import { STORY_STEPS } from "../src/story-steps.ts";
import {
  STORY, STORY_GUIDANCE, beginStory, freshStory, recordStory, restoreStory, stepStory, storySteps, storyView,
  type StoryData, type StoryEvent, type StoryState,
} from "../src/story-journey.ts";
import { SCENE_DEVELOPMENT_NOTICE } from "../src/journey.ts";
import { readingTime, type Vec2 } from "../src/missions.ts";
import { newWorldState, parseWorldState, recordStage, savedStage, type WorldState } from "../src/world-state.ts";
import { TEACHING_ID, TEACHING_ONWARD_ID } from "../src/teaching-journey.ts";

const data: StoryData = JSON.parse(readFileSync(new URL("../src/data/mc-caminho.json", import.meta.url), "utf8"));
const town = scene(256);
const life = townLife({ terrain: t, start, beach, routes, plans: town.plans, boxes: town.boxes, margin: MARGIN })!;
const places = storyPlaces({ terrain: t, routes, plans: town.plans, boxes: town.boxes, margin: MARGIN, beach,
  nets: { x: P.simao[0], z: P.simao[1] }, boat: { x: P.barco_margem[0], z: P.barco_margem[1] }, house: life.onward })!.at;
const steps = storySteps(data)!;
const FAR: Vec2 = { x: 300, z: -300 }, DT = 0.1;

/** A player in the story: where he is, the state, every event so far and the world record they made. */
function game(world: WorldState = newWorldState("save-1", "cafarnaum-r15")) {
  const g = {
    s: restoreStory(steps, world), pos: { ...FAR }, world, events: [] as StoryEvent[], writes: 0,
    apply(r: { next: StoryState; events: StoryEvent[] }) {
      g.s = r.next; g.events.push(...r.events);
      const next = recordStory(g.world, r.events, 1000 + g.events.length);
      if (next !== g.world) { g.world = next; g.writes++; }
      return r.events;
    },
    begin: () => g.apply(beginStory(g.s, steps)),
    frame: (action = false, clear = true, dt = DT) => g.apply(stepStory(g.s, steps, places, { pos: g.pos, action, clear }, dt)),
    /** Frames until `done` says so; fails rather than loop for ever. */
    until(done: () => boolean, what: string, limit = 5000) { for (let i = 0; !done(); i++) { assert.ok(i < limit, `never: ${what}`); g.frame(); } },
    go(to: Vec2) { g.pos = { ...to }; },
    view: (touch = false) => storyView(g.s, steps, places, g.pos, touch),
    /** Lives the current step the way a player does: walks there, presses if it asks, reads to the end. */
    live() {
      const k = g.s.step, cur = steps[k], shown: string[] = [];
      const before = g.events.length;
      g.go(places[cur.def.place]);
      g.frame();
      if (cur.def.action) { assert.equal(g.s.phase, "ready", `${cur.def.id} offers its action`); g.frame(true); }
      assert.equal(g.s.phase, "line", `${cur.def.id} is on screen`);
      g.until(() => g.s.step !== k, `${cur.def.id} lived`);
      for (const e of g.events.slice(before)) if (e.type === "line") shown.push(e.fala.texto);
      return shown;
    },
  };
  return g;
}

test("the data gives twenty steps with their clauses, or no story at all", () => {
  assert.equal(steps.length, 20);
  assert.deepEqual(steps.map((s) => s.def), [...STORY_STEPS]);
  for (const s of steps) { assert.match(s.ref, /^Marcos \d+:\d+(–\d+)?(, \d+(–\d+)?)*$/); assert.ok(s.lines.length >= 1); }
  assert.equal(steps.reduce((n, s) => n + s.lines.length, 0), STORY_STEPS.reduce((n, s) => n + s.cuts.length, 0));
  assert.equal(steps.reduce((n, s) => n + s.lines.length, 0), 37, "the clauses staged, counted");
  const broken = { ...data, versiculos: { ...data.versiculos, "Mark.3.9": "Outro texto." } };
  assert.ok(storySteps(broken), "a verse shown whole still cuts");
  const missing = { ...data, versiculos: { ...data.versiculos } }; delete missing.versiculos["Mark.4.35"];
  assert.equal(storySteps(missing), null, "one clause missing: no story, not nineteen steps");
  assert.equal(storySteps({ ...data, versiculos: { ...data.versiculos, "Mark.1.38": "sem os dois pontos" } }), null);
  assert.equal(storySteps(data, [STORY_STEPS[0], STORY_STEPS[0]]), null, "a repeated id would share one saved fact");
  assert.equal(storySteps(data, []), null);
});

test("closed until it is begun; begun once", () => {
  const g = game();
  assert.equal(g.s.phase, "off");
  assert.equal(g.view(), null);
  g.go(places.casa);
  for (let i = 0; i < 50; i++) g.frame(true);
  assert.deepEqual(g.s, freshStory(), "nothing moves before it opens, not even its clock");
  assert.deepEqual(g.begin(), [{ type: "begin" }]);
  assert.equal(g.s.phase, "walk");
  const again = beginStory(g.s, steps);
  assert.equal(again.next, g.s); assert.deepEqual(again.events, []);
});

test("all twenty steps are lived in order, each once, with the passage's clauses on screen and a fact kept", () => {
  const g = game();
  g.begin();
  let seconds = 0;
  steps.forEach((cur, k) => {
    assert.equal(g.s.step, k);
    const shown = g.live();
    assert.deepEqual(shown, cur.lines.map((l) => l.texto), `${cur.def.id}: its clauses, in order, once`);
    assert.equal(savedStage(g.world, cur.def.id), "completed");
    seconds += cur.lines.reduce((n, l) => n + readingTime(l.texto), 0);
  });
  assert.equal(g.s.phase, "end"); assert.equal(g.s.step, 20);
  const done = g.events.filter((e) => e.type === "done"), saves = g.events.filter((e) => e.type === "save");
  assert.deepEqual(done.map((e) => e.type === "done" && e.id), steps.map((s) => s.def.id));
  assert.deepEqual(saves.map((e) => e.type === "save" && e.id), steps.map((s) => s.def.id));
  assert.equal(g.events.filter((e) => e.type === "end").length, 1);
  assert.equal(g.writes, 20, "one write per step lived");
  assert.equal(Object.keys(g.world.encounters).length, 20);
  assert.ok(seconds > 120 && seconds < 600, `the clauses stay ${seconds.toFixed(0)} s in all`);
  // the record with the teaching's facts beside these is one the store accepts
  const full = recordStage(recordStage(g.world, TEACHING_ID, "completed", 1), TEACHING_ONWARD_ID, "completed", 2);
  assert.equal(parseWorldState(JSON.stringify(full), "save-1").kind, "ok");
});

test("a step with an action waits for the place and for the press; the press counts once", () => {
  const g = game(); g.begin();                                          // step 1: the house, "Aproximar-se"
  const cur = steps[0];
  assert.ok(cur.def.action);
  for (let i = 0; i < 100; i++) g.frame(true);                          // pressing far from the place
  assert.equal(g.s.phase, "walk"); assert.equal(g.events.length, 1);
  g.go({ x: places.casa.x + STORY.radius + 0.2, z: places.casa.z }); g.frame(true);
  assert.equal(g.s.phase, "walk", "just outside the radius");
  g.go({ x: places.casa.x + STORY.radius - 0.2, z: places.casa.z });
  assert.deepEqual(g.frame(true), [{ type: "arrived", step: 0 }], "the frame he arrives offers the action; that press is not the action's");
  for (let i = 0; i < 100; i++) g.frame(false);
  assert.equal(g.s.phase, "ready", "it waits for the press");
  // the offer holds a little past the radius and goes beyond it
  g.go({ x: places.casa.x + STORY.radius + STORY.slack - 0.1, z: places.casa.z }); g.frame();
  assert.equal(g.s.phase, "ready");
  g.go({ x: places.casa.x + STORY.radius + STORY.slack + 0.1, z: places.casa.z });
  assert.deepEqual(g.frame(true), [{ type: "left", step: 0 }], "outside, a press does nothing but he is told the offer is gone");
  g.go(places.casa); g.frame();
  assert.deepEqual(g.frame(true), [{ type: "line", step: 0, fala: cur.lines[0] }]);
  const before = g.events.length;
  for (let i = 0; i < 5; i++) g.frame(true);                            // pressing again while the clause is on screen
  assert.equal(g.events.length, before, "nothing is skipped and nothing is said twice");
  assert.equal(g.s.index, 0);
  g.until(() => g.s.step === 1, "step 1 lived");
  assert.equal(g.events.filter((e) => e.type === "save").length, 1);
});

test("a step lived by arriving needs no press, and neither kind is lived through a wall", () => {
  const g = game(); g.begin(); g.live();                                // now step 2: the street, by arriving
  assert.equal(steps[1].def.action, null);
  assert.equal(g.s.phase, "walk");
  for (let i = 0; i < 30; i++) g.frame(true);
  assert.equal(g.s.phase, "walk", "standing where step 1 was lived is not yet at step 2");
  g.go(places["rua-da-casa"]);
  for (let i = 0; i < 30; i++) g.frame(true, false);                    // something stands between him and the place
  assert.equal(g.s.phase, "walk");
  assert.deepEqual(g.frame(false, true), [{ type: "arrived", step: 1 }, { type: "line", step: 1, fala: steps[1].lines[0] }]);
  g.until(() => g.s.step === 2, "step 2 lived");
  // an action step: offered only with a clear line, withdrawn when it is lost
  g.go(places["lugar-deserto"]);
  g.frame(true, false); assert.equal(g.s.phase, "walk");
  g.frame(false, true); assert.equal(g.s.phase, "ready");
  assert.deepEqual(g.frame(true, false), [{ type: "left", step: 2 }]);
  assert.equal(g.s.phase, "walk");
});

test("walking away while the clauses are on screen ends them, keeps nothing, and the step can be lived again", () => {
  const g = game(); g.begin();
  g.go(places.casa); g.frame(); g.frame(true);
  g.until(() => g.s.index === 1, "the second clause");
  g.go({ x: places.casa.x + STORY.radius + STORY.leave - 0.1, z: places.casa.z }); g.frame();
  assert.equal(g.s.phase, "line", "a few steps away it is still on screen");
  g.go({ x: places.casa.x + STORY.radius + STORY.leave + 0.1, z: places.casa.z });
  assert.deepEqual(g.frame(), [{ type: "interrupted", step: 0 }]);
  assert.deepEqual([g.s.phase, g.s.step, g.s.index, g.s.line, g.s.lineLeft], ["walk", 0, 0, null, 0]);
  assert.equal(g.writes, 0); assert.equal(savedStage(g.world, steps[0].def.id), null);
  assert.deepEqual(g.live(), steps[0].lines.map((l) => l.texto), "from its first clause again");
  assert.equal(g.writes, 1);
});

test("a step lived by arriving is lived once he arrived: walking or running on does not cancel its clauses", () => {
  // every such step, crossed in a straight line without stopping, at a walk and at a run (main.ts: 2.5 and 5.2 m/s)
  for (const speed of [2.5, 5.2]) {
    const g = game(); g.begin();
    let beyond = 0;                                                     // steps that ended with him past the ring
    for (let k = 0; k < steps.length; k++) {
      const cur = steps[k], at = places[cur.def.place];
      if (cur.def.action) { g.live(); continue; }
      const from = k ? places[steps[k - 1].def.place] : at, l = Math.hypot(at.x - from.x, at.z - from.z), ux = (at.x - from.x) / l, uz = (at.z - from.z) / l;
      const before = g.events.length;
      // from 30 m before the place, through it, and on for as long as its clauses take
      let travelled = -30;
      g.until(() => { travelled += speed * DT; g.go({ x: at.x + ux * travelled, z: at.z + uz * travelled }); return g.s.step !== k; }, `${cur.def.id} crossed at ${speed} m/s`);
      const mine = g.events.slice(before);
      assert.equal(mine.filter((e) => e.type === "interrupted").length, 0, `${cur.def.id} at ${speed} m/s`);
      assert.deepEqual(mine.filter((e) => e.type === "line").map((e) => e.type === "line" && e.fala.texto), cur.lines.map((l) => l.texto));
      if (travelled > STORY.radius + STORY.leave) beyond++;
      assert.equal(savedStage(g.world, cur.def.id), "completed");
    }
    assert.equal(g.s.phase, "end"); assert.equal(g.writes, 20);
    // this is not an idle case: at either pace some of the seven end with him farther than an action step allows
    assert.ok(beyond >= 3, `${beyond} of 7 ended past the ring at ${speed} m/s`);
  }
  // a step with an action is different: he must stay with what he is doing (the test above this one)
});

test("the clock is the game's: no time, no change", () => {
  const g = game(); g.begin(); g.go(places.casa); g.frame(); g.frame(true);
  const held = g.s;
  for (const dt of [0, -1, Number.NaN]) {
    const r = stepStory(held, steps, places, { pos: places.casa, action: true, clear: true }, dt);
    assert.equal(r.next, held); assert.deepEqual(r.events, []);
  }
  // a long frame never skips a clause: one clause per frame at most
  const long = stepStory(held, steps, places, { pos: places.casa, action: false, clear: true }, 3600);
  assert.equal(long.next.index, 1); assert.equal(long.events.length, 1);
});

test("a position or a place that is not a number is never near: nothing is offered, lived or kept on it", () => {
  const nowhere = { x: Number.NaN, z: 0 };
  const g = game(); g.begin();
  g.pos = nowhere;
  for (let i = 0; i < 50; i++) g.frame(true);
  assert.equal(g.s.phase, "walk"); assert.equal(g.events.length, 1);
  assert.equal(g.view()!.dist, null, "no distance is shown rather than a broken one");
  // at the place, ready; then the position is lost: the offer goes
  g.go(places.casa); g.frame();
  assert.equal(g.s.phase, "ready");
  g.pos = nowhere;
  assert.deepEqual(g.frame(true), [{ type: "left", step: 0 }]);
  // with the clauses on screen: they end, nothing is kept
  g.go(places.casa); g.frame(); g.frame(true);
  assert.equal(g.s.phase, "line");
  g.pos = nowhere;
  assert.deepEqual(g.frame(), [{ type: "interrupted", step: 0 }]);
  assert.equal(g.writes, 0);
  // a map of places with one missing: the step that needs it waits, it is not lived where he stands
  const holed = { ...places } as Record<string, Vec2>; delete holed["rua-da-casa"];
  const h = game(); h.begin(); h.live();
  for (let i = 0; i < 50; i++) h.apply(stepStory(h.s, steps, holed as typeof places, { pos: places.casa, action: true, clear: true }, DT));
  assert.deepEqual([h.s.step, h.s.phase], [1, "walk"]);
  assert.deepEqual(storyView(h.s, steps, holed as typeof places, places.casa, false)!.goal, null);
});

test("a reload opens the first step not lived, at every point of the story, never mid-clause", () => {
  const g = game(); g.begin();
  for (let k = 0; k < steps.length; k++) {
    // reload before step k is lived, with its clauses on screen
    g.go(places[steps[k].def.place]); g.frame(); if (steps[k].def.action) g.frame(true);
    assert.equal(g.s.phase, "line");
    const back = game(g.world);
    assert.deepEqual(back.s, { ...freshStory(), step: k }, `reload at step ${k + 1}`);
    back.begin();
    assert.equal(back.s.phase, "walk"); assert.equal(back.s.line, null);
    assert.equal(back.view()!.step, k);
    g.until(() => g.s.step !== k, `step ${k + 1} lived`);
  }
  const after = game(g.world);
  assert.equal(after.s.step, 20);
  assert.deepEqual(after.begin(), [], "lived to the end: it opens ended, with nothing to announce");
  assert.equal(after.s.phase, "end"); assert.equal(after.view(), null);
  for (let i = 0; i < 100; i++) after.frame(true);
  assert.equal(after.writes, 0); assert.equal(after.view(), null);
});

test("records that playing cannot write are read safely", () => {
  const blank = newWorldState("save-1", "cafarnaum-r15");
  assert.equal(restoreStory(null, blank).step, 0);
  // a later step lived and an earlier one not: the earlier one is opened, no step is skipped
  const gap = recordStage(recordStage(blank, steps[0].def.id, "completed", 1), steps[5].def.id, "completed", 2);
  assert.equal(restoreStory(steps, gap).step, 1);
  // a step only accepted (another module's stage) is not lived
  assert.equal(restoreStory(steps, recordStage(blank, steps[0].def.id, "accepted", 1)).step, 0);
  // facts of other content do not move it
  assert.equal(restoreStory(steps, recordStage(recordStage(blank, TEACHING_ID, "completed", 1), "toString", "completed", 2)).step, 0);
  // repeating a step's events writes nothing new
  const once = recordStory(blank, [{ type: "save", id: steps[0].def.id }], 5);
  assert.equal(recordStory(once, [{ type: "save", id: steps[0].def.id }, { type: "done", step: 0, id: steps[0].def.id }], 9), once);
  assert.equal(once.encounters[steps[0].def.id].at, 5);
});

test("the view: where to go, what to do, the literal clause, and the honest notices", () => {
  const g = game(); g.begin();
  const walking = g.view()!;
  assert.deepEqual([walking.phase, walking.mark, walking.step, walking.total], ["walk", "JORNADA · 1 DE 20", 0, 20]);
  assert.equal(walking.objective, steps[0].def.objective);
  assert.equal(walking.ref, "Marcos 1:30–31");
  assert.deepEqual(walking.goal, places.casa);
  assert.ok(Math.abs(walking.dist! - Math.hypot(FAR.x - places.casa.x, FAR.z - places.casa.z)) < 1e-9);
  assert.deepEqual([walking.action, walking.line, walking.announce, walking.narrative, walking.scene], [null, null, null, "", ""]);
  assert.equal(walking.guidance, STORY_GUIDANCE.walk);
  assert.match(walking.guidance, /o jogo escolheu/, "the place is said to be the game's choice");
  g.go(places.casa); g.frame();
  const ready = g.view()!, touch = g.view(true)!;
  assert.deepEqual([ready.phase, ready.objective, ready.action, ready.scene], ["ready", steps[0].def.doing, "Aproximar-se", SCENE_DEVELOPMENT_NOTICE]);
  assert.equal(ready.guidance, "Aperte E: Aproximar-se."); assert.equal(touch.guidance, "Toque em Aproximar-se.");
  g.frame(true);
  const line = g.view()!;
  assert.deepEqual([line.phase, line.action, line.guidance], ["line", null, ""]);
  assert.deepEqual(line.line, steps[0].lines[0]);
  assert.equal(line.scene, SCENE_DEVELOPMENT_NOTICE);
  // a step with no people drawn or told carries no scene notice: the solitary place
  g.until(() => g.s.step === 1, "step 1 lived"); g.live(); g.go(places["lugar-deserto"]); g.frame();
  assert.equal(steps[2].def.people, false);
  assert.equal(g.view()!.scene, "");
  // every view of every step: its own place, its own reference, and no verse text outside `line`
  const verses = Object.values(data.versiculos);
  for (let k = g.s.step; k < steps.length; k++) {
    const v = g.view()!;
    assert.deepEqual(v.goal, places[steps[k].def.place]); assert.equal(v.ref, steps[k].ref); assert.equal(v.mark, `JORNADA · ${k + 1} DE 20`);
    for (const text of [v.objective, v.guidance, v.narrative]) assert.ok(!verses.some((verse) => text.length > 12 && verse.includes(text)), `"${text}" is the game's, not a verse`);
    g.live();
  }
});

test("after the last step the closing words stay for a while and the screen goes back to the region", () => {
  const g = game(); g.begin();
  while (g.s.phase !== "end") g.live();
  const closing = g.view()!;
  assert.deepEqual([closing.phase, closing.mark, closing.objective, closing.goal, closing.dist, closing.action, closing.line],
    ["done", "JORNADA · 20 DE 20", "Explore a região", null, null, null, null]);
  assert.equal(closing.guidance, STORY_GUIDANCE.end);
  assert.match(closing.guidance, /ainda está em preparação/);
  assert.equal(closing.ref, "Marcos 4:35");
  g.until(() => g.view() === null, "the closing words end", Math.ceil(STORY.afterEnd / DT) + 5);
  assert.ok(g.s.time >= g.s.until);
  for (let i = 0; i < 50; i++) g.frame(true);
  assert.equal(g.view(), null); assert.equal(g.writes, 20);
});
