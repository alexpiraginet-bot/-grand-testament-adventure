// Plays episode 1 through with the mission logic alone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialState, readingTime, start, step, type EpisodeData, type Event, type Goal } from "../src/missions.ts";

const ep = JSON.parse(readFileSync(new URL("../src/data/mc-pescadores.json", import.meta.url)).toString()) as EpisodeData;
const goals: Goal[] = [
  { kind: "reach", at: { x: 0, z: 100 }, radius: 18, below: 0.6 },
  { kind: "call", at: { x: -100, z: 120 }, radius: 7, npcs: ["simao", "andre"] },
  { kind: "call", at: { x: -200, z: 150 }, radius: 13, npcs: ["tiago", "joao"] },
];

function run(s: ReturnType<typeof initialState>, x: number, z: number, h: number, action = false, dt = 0.1): Event[] {
  return step(s, ep, goals, { pos: { x, z }, groundHeight: h, action }, dt);
}

test("the whole episode, in order", () => {
  const s = initialState();
  assert.deepEqual(run(s, 0, 0, 10), [], "nothing happens before the start card is closed");
  assert.deepEqual(start(s), [{ type: "mission-start", mission: 0 }]);

  // mission 1: walking on the hill does nothing; the beach (low ground) ticks it
  assert.deepEqual(run(s, 0, 0, 10), []);
  const e1 = run(s, 30, 60, 0.4);
  assert.deepEqual(e1.map((e) => e.type), ["mission-done", "mission-start"]);
  assert.equal(s.mission, 1);
  assert.equal(s.filled, 0);

  // mission 2: the action does nothing far away; near them it shows the prompt and the line
  assert.deepEqual(run(s, -80, 120, 0.3, true), []);
  assert.equal(s.promptVisible, false);
  run(s, -98, 121, 0.3);
  assert.equal(s.promptVisible, true);
  const e2 = run(s, -98, 121, 0.3, true);
  assert.deepEqual(e2.map((e) => e.type), ["line", "follow"]);
  assert.equal(s.line?.texto, "Vinde após mim, e farei serdes pescadores de gente.");
  assert.deepEqual(s.followers, ["simao", "andre"]);
  // the line stays its reading time, then the mission is ticked and the counter shows 2
  const read = readingTime(s.line!.texto);
  let tick: Event[] = [];
  for (let t = 0; t < read + 0.2 && !tick.length; t += 0.1) tick = run(s, -98, 121, 0.3);
  assert.deepEqual(tick.map((e) => e.type), ["mission-done", "mission-start"]);
  assert.equal(s.filled, 2);
  assert.equal(s.line, null);

  // mission 3
  run(s, -195, 152, 0.2);
  const e3 = run(s, -195, 152, 0.2, true);
  assert.deepEqual(e3.map((e) => e.type), ["line", "follow"]);
  const line3 = s.line as { texto: string } | null;   // step() changed it after the narrowing above
  assert.match(line3!.texto, /Zebedeu/);
  let end: Event[] = [];
  for (let t = 0; t < 30 && !end.length; t += 0.1) end = run(s, -195, 152, 0.2);
  assert.deepEqual(end.map((e) => e.type), ["mission-done", "episode-done"]);
  assert.equal(s.phase, "done");
  assert.equal(s.filled, 4);
  assert.deepEqual(s.followers, ["simao", "andre", "tiago", "joao"]);
  assert.equal(s.completedAt.length, 3);
  assert.deepEqual(run(s, 0, 0, 10, true), [], "nothing after the end");
});

test("the action key during a line does not skip or repeat it", () => {
  const s = initialState(); start(s);
  run(s, 0, 100, 0.2);
  run(s, -100, 120, 0.3);
  run(s, -100, 120, 0.3, true);
  assert.equal(s.phase, "line");
  const e = run(s, -100, 120, 0.3, true);
  assert.deepEqual(e, []);
  assert.deepEqual(s.followers, ["simao", "andre"]);
});
