// Exploring after the episode and the staged clause of Mark 1:21, against the episode's own data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initialState, readingTime, start, step, type EpisodeData } from "../src/missions.ts";
import { EPILOGUE_RADIUS_M, EPILOGUE_VERSE, epilogueLine, finishedState, initialRoam, roamDistance, startFree, startRoam, stepRoam, verseRef } from "../src/freeroam.ts";
import { goals as makeGoals } from "../src/episode.ts";
import type { WorldMeta } from "../src/terrain.ts";

const ep = JSON.parse(readFileSync(new URL("../src/data/mc-pescadores.json", import.meta.url), "utf8")) as EpisodeData;
const goal = { at: { x: 0, z: 0 }, radius: EPILOGUE_RADIUS_M };

test("the epilogue's line is a literal clause of Mark 1:21 in the BLIVRE, with its own reference", () => {
  const fala = epilogueLine(ep);
  assert.ok(fala);
  assert.equal(fala.texto, "Eles entraram em Cafarnaum");          // the literal expected text, typed here only
  assert.equal(fala.ref, "Marcos 1:21");
  const verse = ep.versiculos[EPILOGUE_VERSE];
  assert.ok(verse.startsWith(fala.texto), "the clause opens the verse");
  assert.equal(verse[fala.texto.length], ";", "and ends where the verse's first clause ends");
  // the episode's own lines are not this verse: nothing is shown twice
  assert.ok(ep.missoes.every((m) => m.fala?.ref !== fala.ref));
});

test("references are built from the data, and nothing is invented when the data is missing", () => {
  assert.equal(verseRef(ep, "Mark.1.16"), "Marcos 1:16");
  assert.equal(verseRef({ ref_pt: "Marcos 1:16–20" }, "Mark.10.2"), "Marcos 10:2");
  assert.equal(verseRef(ep, "Mark.1"), null); assert.equal(verseRef(ep, "1.21"), null);
  assert.equal(verseRef({ ref_pt: "" }, "Mark.1.21"), null);
  assert.equal(epilogueLine({ ref_pt: ep.ref_pt, versiculos: {} }), null);
  assert.equal(epilogueLine({ ref_pt: ep.ref_pt, versiculos: { [EPILOGUE_VERSE]: " ; depois" } }), null);
  assert.equal(epilogueLine({ ref_pt: "", versiculos: ep.versiculos }), null);
});

test("exploring: nothing happens until the player chooses it, the line plays once at the village, then the region is free", () => {
  const fala = epilogueLine(ep)!;
  const s = initialRoam();
  assert.deepEqual(stepRoam(s, goal, fala, { x: 0, z: 0 }, 1), [], "off: standing on the goal does nothing");
  assert.equal(s.time, 0);
  startRoam(s, fala);
  assert.equal(s.phase, "return");
  assert.equal(roamDistance(s, goal, { x: 300, z: 400 }), 500);
  assert.deepEqual(stepRoam(s, goal, fala, { x: 300, z: 400 }, 0.5), [], "far from the village: still walking back");
  assert.deepEqual(stepRoam(s, goal, fala, { x: EPILOGUE_RADIUS_M + 0.5, z: 0 }, 0.5), [], "half a metre short");
  assert.deepEqual(stepRoam(s, goal, fala, { x: EPILOGUE_RADIUS_M - 0.5, z: 0 }, 0.5), [{ type: "line", fala }]);
  assert.equal(s.phase, "line"); assert.equal(s.line, fala); assert.equal(s.lineLeft, readingTime(fala.texto));
  assert.equal(roamDistance(s, goal, { x: 0, z: 0 }), null, "no distance while the line is read");
  // walking away does not cut the line short or replay it
  let events = 0, t = 0;
  while (s.phase === "line" && t < 60) { const ev = stepRoam(s, goal, fala, { x: 900, z: 900 }, 0.1); t += 0.1; events += ev.length; if (ev.length) assert.deepEqual(ev, [{ type: "epilogue-done" }]); }
  assert.equal(events, 1);
  assert.ok(Math.abs(t - readingTime(fala.texto)) < 0.11, `read for ${t} s`);
  assert.equal(s.phase, "free"); assert.equal(s.line, null);
  assert.deepEqual(stepRoam(s, goal, fala, { x: 0, z: 0 }, 1), [], "back on the goal later: nothing again");
  startRoam(s, fala); assert.equal(s.phase, "free", "starting twice changes nothing");
});

test("exploring: the same end whatever the frame step; no line to stage means straight to free", () => {
  const fala = epilogueLine(ep)!;
  const run = (dt: number) => { const s = initialRoam(); startRoam(s, fala); let n = 0;
    for (let t = 0; t < 30; t += dt) n += stepRoam(s, goal, fala, { x: 0, z: 0 }, dt).length;
    return { phase: s.phase, n }; };
  assert.deepEqual(run(0.016), { phase: "free", n: 2 });
  assert.deepEqual(run(0.5), { phase: "free", n: 2 });
  const s = initialRoam(); startRoam(s, null);
  assert.equal(s.phase, "free");
  assert.deepEqual(stepRoam(s, goal, null, { x: 0, z: 0 }, 1), []);
});

test("coming back to explore: the state of a finished episode equals the one a played episode ends in", () => {
  const meta = JSON.parse(readFileSync(new URL("../public/world/cafarnaum.json", import.meta.url), "utf8")) as WorldMeta;
  const goals = makeGoals(meta);
  // play it through: stand on each goal and act
  const s = initialState(); start(s);
  for (let i = 0; i < 4000 && s.phase !== "done"; i++) step(s, ep, goals, { pos: goals[s.mission].at, groundHeight: 5, action: true }, 0.1);
  assert.equal(s.phase, "done");
  const f = finishedState(ep, goals);
  assert.equal(f.phase, "done");
  assert.equal(f.mission, s.mission);
  assert.equal(f.filled, s.filled);
  assert.deepEqual(f.followers, s.followers);
  assert.deepEqual(f.followers, ["simao", "andre", "tiago", "joao"]);     // literal: the four the passage names
  assert.equal(f.completedAt.length, s.completedAt.length);
  assert.equal(f.line, null); assert.equal(f.promptVisible, false);
  // free at once, and only from off
  const r = initialRoam(); startFree(r); assert.equal(r.phase, "free");
  const fala = epilogueLine(ep)!;
  assert.deepEqual(stepRoam(r, goal, fala, { x: 0, z: 0 }, 1), [], "no epilogue line for a player who only came to explore");
  const back = initialRoam(); startRoam(back, fala); startFree(back); assert.equal(back.phase, "return", "does not skip a way back already started");
});
