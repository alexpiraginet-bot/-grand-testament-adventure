// The story's steps in the game's Bible: whole verses of each step's passage after the teaching's steps, nothing
// offered when the story is not, and the passage's runs named so a verse number is never read under the wrong chapter.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { storyReading, storyTask } from "../src/story-bible.ts";
import { teachingReading } from "../src/teaching-bible.ts";
import { rangeRef, readingOrder, verseRuns, verseStates, type BibleData } from "../src/bible.ts";
import { goals as makeGoals } from "../src/episode.ts";
import { storySteps, type StoryData } from "../src/story-journey.ts";
import { stepVerses } from "../src/story-steps.ts";
import type { EpisodeData } from "../src/missions.ts";
import type { WorldMeta } from "../src/terrain.ts";

const json = <T>(file: string): T => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), "utf8"));
const ep = json<EpisodeData>("src/data/mc-pescadores.json"), data = json<StoryData>("src/data/mc-caminho.json");
const bible = json<BibleData>("src/data/biblia-cronologica.json");
const goals = makeGoals(json<WorldMeta>("public/world/cafarnaum.json"));
const base = teachingReading(ep, goals, "Cafarnaum", true, bible), steps = storySteps(data)!;
const full = storyReading(base, steps, data, bible);

test("the twenty steps come after the teaching's, each with the whole verses of its passage", () => {
  assert.equal(full.storyIndex, base.steps.length);
  assert.equal(full.teachingIndex, base.teachingIndex);
  assert.equal(full.steps.length, base.steps.length + 20);
  assert.deepEqual(full.steps.slice(0, base.steps.length), base.steps, "what was there is untouched");
  const seen = new Set<string>();
  full.steps.slice(full.storyIndex).forEach((s, i) => {
    assert.equal(s.kind, "missao"); assert.equal(s.ref, steps[i].ref);
    assert.deepEqual(s.verses, stepVerses(steps[i].def), "the verses shown are the verses the step quotes, and no other");
    for (const k of s.verses) { assert.equal(full.episode.versiculos[k], data.versiculos[k], `${k} is the data's verse, whole`); seen.add(k); }
    // what is staged on screen is part of what the Bible shows for the step
    for (const line of steps[i].lines) assert.ok(s.verses.some((k) => data.versiculos[k].includes(line.texto)));
    assert.equal(s.objetivo, storyTask(steps[i]));
    assert.equal(s.objetivo, steps[i].def.action ? `${steps[i].def.objective}. ${steps[i].def.doing}.` : `${steps[i].def.objective}.`, "the way there, and what to do there when there is something");
    assert.match(s.objetivo, /^[A-ZÀ-Ú].*\.$/); assert.doesNotMatch(s.objetivo, /\.\./);
  });
  assert.deepEqual([...seen].sort(), Object.keys(data.versiculos).sort());
  for (const [k, text] of Object.entries(base.episode.versiculos)) assert.equal(full.episode.versiculos[k], text, `${k} is unchanged`);
  assert.equal(new Set(full.steps.slice(full.storyIndex).map((s) => s.objetivo)).size, 20, "no two steps ask for the same thing in the same words");
});

test("the passage keeps its place in the reading order and names every stretch it tells", () => {
  assert.equal(full.episode.ref_pt, [base.episode.ref_pt, ...data.passagens].join("; "));
  const here = full.order.entries.filter((e) => e.kind === "episodio");
  assert.equal(here.length, 1);
  assert.equal(here[0].kind === "episodio" && here[0].ref, full.episode.ref_pt);
  const at = (o: ReturnType<typeof readingOrder>) => o.entries.findIndex((e) => e.kind === "episodio");
  assert.equal(at(full.order), at(base.order));
  assert.equal(full.order.entries.length, base.order.entries.length);
  assert.deepEqual(full.order.after, base.order.after); assert.equal(full.order.gospelName, base.order.gospelName);
});

test("with no story the Bible is exactly what it was", () => {
  for (const none of [null, []]) {
    const r = storyReading(base, none, data, bible);
    assert.equal(r.steps, base.steps); assert.equal(r.episode, base.episode); assert.equal(r.order, base.order);
    assert.equal(r.storyIndex, base.steps.length);
  }
  // a verse a step quotes is not in the data: nothing is added, rather than a step listed without its verse
  const short = { ...data, versiculos: { ...data.versiculos } }; delete short.versiculos["Mark.1.42"];
  assert.equal(storyReading(base, steps, short, bible).steps, base.steps);
});

test("only what was staged is ever marked: the verses a step leaves out are not in the passage at all", () => {
  const listed = new Set(full.steps.flatMap((s) => s.verses));
  for (const k of ["Mark.1.23", "Mark.1.28", "Mark.1.43", "Mark.1.45", "Mark.2.6", "Mark.2.10", "Mark.3.8", "Mark.3.10", "Mark.3.12", "Mark.3.15", "Mark.4.2"]) {
    assert.equal(listed.has(k), false, `${k} is not staged, so it is not listed`);
    assert.equal(Object.hasOwn(full.episode.versiculos, k), false);
    assert.equal(verseStates(full.steps, full.steps.length).has(k), false, `${k} is never "vivido"`);
  }
  assert.equal(full.steps.find((s) => s.ref === "Marcos 2:3–5, 11–12")?.verses.length, 5);
});

test("verse by verse: lived, now and still ahead, at every step of the story", () => {
  for (let k = 0; k <= 20; k++) {
    const states = verseStates(full.steps, full.storyIndex + k);
    full.steps.forEach((s, i) => { for (const key of s.verses) {
      const state = states.get(key), j = i - full.storyIndex;
      if (j === k) assert.equal(state, "agora", `${key} at step ${k}`);
      else if (!full.steps.some((o, n) => n === full.storyIndex + k && o.verses.includes(key))) {
        // a verse shared by two steps (Mark 3:13) stays "a-seguir" until both are behind
        const others = full.steps.map((o, n) => (o.verses.includes(key) ? n - full.storyIndex : null)).filter((n): n is number => n !== null);
        assert.equal(state, others.every((n) => n < k) ? "vivido" : "a-seguir", `${key} at step ${k}`);
      }
    } });
    if (k === 20) assert.ok([...states.values()].every((s) => s === "vivido"), "the whole passage lived");
  }
  // before the story: all of it is still ahead
  const before = verseStates(full.steps, full.storyIndex - 1);
  for (const key of Object.keys(data.versiculos)) assert.equal(before.get(key), "a-seguir");
});

test("verseRuns: consecutive verses of a chapter, in the order given", () => {
  assert.deepEqual(verseRuns([]), []);
  assert.deepEqual(verseRuns(["Mark.1.16", "Mark.1.17", "Mark.1.18"]), [["Mark.1.16", "Mark.1.17", "Mark.1.18"]]);
  assert.deepEqual(verseRuns(["Mark.1.21", "Mark.1.22", "Mark.1.29", "Mark.1.30"]), [["Mark.1.21", "Mark.1.22"], ["Mark.1.29", "Mark.1.30"]]);
  assert.deepEqual(verseRuns(["Mark.1.45", "Mark.2.1", "Mark.2.2"]), [["Mark.1.45"], ["Mark.2.1", "Mark.2.2"]], "a new chapter is a new run");
  assert.deepEqual(verseRuns(["Mark.1.1", "Luke.1.2"]), [["Mark.1.1"], ["Luke.1.2"]]);
  assert.deepEqual(verseRuns(["Mark.1.5", "Mark.2.6"]), [["Mark.1.5"], ["Mark.2.6"]], "the next number in another chapter is not the next verse");
  assert.deepEqual(verseRuns(["Mark.1.1", "nota", "Mark.1.2"]), [["Mark.1.1"], ["Mark.1.2"]], "what is not a verse key ends a run");
  // the passage as the panel lists it: one run per stretch the game tells
  const runs = verseRuns(Object.keys(full.episode.versiculos));
  assert.deepEqual(runs.map((r) => rangeRef(full.episode, r[0], r[r.length - 1])),
    ["Marcos 1:16–22", "Marcos 1:29–42", "Marcos 2:1–5", "Marcos 2:11–17", "Marcos 3:7", "Marcos 3:9", "Marcos 3:13–14", "Marcos 3:16–19", "Marcos 4:1", "Marcos 4:35"]);
  assert.equal(runs.flat().length, Object.keys(full.episode.versiculos).length);
});
