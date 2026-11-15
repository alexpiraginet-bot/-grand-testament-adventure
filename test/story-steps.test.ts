// The twenty steps' text: every clause on screen is cut out of a BLIVRE verse to the letter, and none carries one of
// the source's spacing slips. Nothing here is compared with typed words: the checks are against the data file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STORY_STEPS, cutClause, stepLines, stepRef, stepVerses, storyRef, type StoryStepDef } from "../src/story-steps.ts";
import { WORLD_STATE_LIMITS } from "../src/world-state.ts";
import { TEACHING_ID, TEACHING_ONWARD_ID } from "../src/teaching-journey.ts";

type Data = { id: string; livro: string; passagens: string[]; versiculos: Record<string, string>; fonte_texto: string; alteracao: string;
  origem: { texto: string; texto_sha256: string; commit: string | null } };
const data: Data = JSON.parse(readFileSync(new URL("../src/data/mc-caminho.json", import.meta.url), "utf8"));
const V = data.versiculos, keys = Object.keys(V);
const parse = (key: string) => { const m = /^Mark\.(\d+)\.(\d+)$/.exec(key)!; return { chapter: Number(m[1]), verse: Number(m[2]) }; };
/** The slips of the source's spacing that a clause on screen must not carry. */
const SLIPS: [string, RegExp][] = [
  ["a space before a punctuation mark", /\s[,.;:!?]/],
  ["a punctuation mark glued to the next word", /[,.;:!?)](?=[^\s”’"])/],
  ["a parenthesis", /[()]/],
  ["a bracket of the source", /[[\]]/],
  ["a doubled space", /\s{2,}/],
];
const lines = (def: StoryStepDef) => stepLines(def, V, data.livro)!;

test("the data file is the BLIVRE's, with its origin and the one declared alteration", () => {
  assert.equal(data.livro, "Marcos");
  assert.match(data.fonte_texto, /^Bíblia Livre \(BLIVRE\), CC BY/);
  assert.match(data.origem.texto_sha256, /^[0-9a-f]{64}$/);
  assert.match(data.alteracao, /colchetes/);
  assert.equal(keys.length, 48);
  for (const [k, text] of Object.entries(V)) {
    assert.match(k, /^Mark\.\d+\.\d+$/);
    assert.ok(text.trim() === text && text.length > 10, `${k} is a whole verse`);
    assert.doesNotMatch(text, /[[\]]/, `${k} carries no bracket`);
  }
});

test("there are twenty steps, with stable ids the world record can keep", () => {
  assert.equal(STORY_STEPS.length, 20);
  const ids = STORY_STEPS.map((s) => s.id);
  assert.equal(new Set(ids).size, 20, "ids are unique");
  for (const id of ids) {
    assert.match(id, /^mc-\d+-\d+-[a-z-]+$/);
    assert.ok(id.length <= WORLD_STATE_LIMITS.idLength);
    assert.ok(id !== TEACHING_ID && id !== TEACHING_ONWARD_ID, "no collision with the teaching step's facts");
  }
  // an id names the first verse of its step's passage
  for (const s of STORY_STEPS) { const a = parse(s.verses[0]); assert.ok(s.id.startsWith(`mc-${a.chapter}-${a.verse}-`), s.id); }
});

test("every clause on screen is a literal part of its verse, with that verse's reference", () => {
  let count = 0;
  for (const s of STORY_STEPS) {
    const got = stepLines(s, V, data.livro);
    assert.ok(got && got.length === s.cuts.length, `${s.id} has all its clauses`);
    got.forEach((line, i) => {
      const cut = s.cuts[i], verse = V[cut.verse];
      assert.ok(verse.includes(line.texto), `${s.id} clause ${i} is in ${cut.verse} to the letter`);
      assert.equal(line.texto, line.texto.trim());
      assert.ok(line.texto.length >= 15, `${s.id} clause ${i} is a clause, not a fragment: "${line.texto}"`);
      const { chapter, verse: n } = parse(cut.verse);
      assert.equal(line.ref, `Marcos ${chapter}:${n}`);
      count++;
    });
  }
  assert.equal(count, STORY_STEPS.reduce((n, s) => n + s.cuts.length, 0));
});

test("no clause on screen carries a slip of the source's spacing, and the slips are where the cuts assume them", () => {
  for (const s of STORY_STEPS) for (const line of lines(s)) for (const [what, re] of SLIPS) assert.doesNotMatch(line.texto, re, `${s.id}: ${what} in "${line.texto}"`);
  // the four verses whose spacing the cuts go around (if the source is corrected, the cuts can be simplified)
  const slipped = keys.filter((k) => SLIPS.some(([, re]) => re.test(V[k])));
  assert.deepEqual(slipped, ["Mark.1.30", "Mark.1.41", "Mark.2.10", "Mark.2.14"]);
  // and the steps that use those verses do cut them
  for (const k of slipped) for (const s of STORY_STEPS) for (const c of s.cuts) if (c.verse === k) assert.ok(c.from !== undefined || c.until !== undefined || c.through !== undefined, `${s.id} cuts ${k}`);
});

test("the steps follow Mark's order and their passages are exactly the verses of the data", () => {
  let last = { chapter: 0, verse: 0 };
  const seen = new Set<string>();
  for (const s of STORY_STEPS) {
    const a = parse(s.verses[0]), b = parse(s.verses[1]);
    assert.equal(a.chapter, b.chapter, `${s.id} stays inside one chapter`);
    assert.ok(b.verse >= a.verse);
    assert.ok(a.chapter > last.chapter || (a.chapter === last.chapter && a.verse >= last.verse), `${s.id} does not go back in the text`);
    last = a;
    const told = stepVerses(s, V);
    assert.equal(told.length, b.verse - a.verse + 1, `${s.id}: every verse of its passage is in the data`);
    assert.deepEqual([told[0], told[told.length - 1]], [...s.verses]);
    for (const k of told) seen.add(k);
    // each clause comes from a verse of the step's own passage, in the text's order
    const at = s.cuts.map((c) => told.indexOf(c.verse));
    assert.ok(at.every((i) => i >= 0), `${s.id} quotes only its passage`);
    assert.deepEqual(at, [...at].sort((x, y) => x - y), `${s.id} quotes in the text's order`);
    assert.equal(stepRef(data.livro, s), `Marcos ${a.chapter}:${a.verse}${a.verse === b.verse ? "" : `–${b.verse}`}`);
  }
  assert.deepEqual([...seen].sort(), [...keys].sort(), "no verse of the data is left out and none is foreign to it");
  // the data's own list of passages is the same verses
  const listed = data.passagens.flatMap((p) => { const m = /^Marcos (\d+):(\d+)(?:–(\d+))?$/.exec(p)!; const out = []; for (let n = Number(m[2]); n <= Number(m[3] ?? m[2]); n++) out.push(`Mark.${m[1]}.${n}`); return out; });
  assert.deepEqual(listed, keys);
});

test("a step is a walk and, where the passage gives him something to do, one action", () => {
  STORY_STEPS.forEach((s, i) => {
    assert.ok(s.objective.length >= 8 && s.objective.length <= 52, `${s.id}: the mission line fits the HUD (${s.objective.length})`);
    assert.doesNotMatch(s.objective, /[.!?]$/);
    if (s.action) {
      assert.ok(s.action.length <= 20, `${s.id}: the button's word fits (${s.action})`);
      assert.match(s.action, /^[A-ZÀ-Ú]/);
      assert.notEqual(s.doing, s.objective, `${s.id}: what to do there is not the way there`);
      assert.ok(s.doing.length <= 52);
    } else {
      assert.equal(s.doing, s.objective);
      // lived by arriving: it is never at the place of the step before it, so it is never lived without a walk
      assert.notEqual(s.place, STORY_STEPS[i - 1]?.place, `${s.id} asks for a walk`);
    }
  });
  assert.equal(STORY_STEPS.filter((s) => s.action).length, 13);
  assert.equal(STORY_STEPS[0].place, "casa", "the story begins at the house the teaching step leads to");
});

test("steps that stage a healing or a controversy with the text alone are marked for editorial review", () => {
  const sensitive = /cur(ou|ar)|febre|lepr|demônios|paralítico|pecados|fariseus/i;
  for (const s of STORY_STEPS) {
    const text = lines(s).map((l) => l.texto).join(" ");
    if (sensitive.test(text)) assert.ok(s.review, `${s.id} is marked`);
    if (/multidão|disseram|lhes|todos|discípulos|leproso|paralítico|Levi|Simão/.test(text)) assert.equal(s.people, true, `${s.id} has people who are not drawn`);
  }
  assert.deepEqual(STORY_STEPS.filter((s) => s.review).map((s) => s.id), [
    "mc-1-30-sogra-de-simao", "mc-1-32-ao-entardecer", "mc-1-39-por-toda-a-galileia", "mc-1-40-leproso", "mc-2-3-paralitico", "mc-2-16-os-que-estao-doentes",
  ]);
});

test("cutClause: where a clause begins and ends, and null when it cannot be cut", () => {
  const v = { a: "Um, dois; três: quatro. Cinco.", b: "primeiro,\nsegundo;" };
  assert.equal(cutClause(v, { verse: "a" }), "Um, dois; três: quatro. Cinco.");
  assert.equal(cutClause(v, { verse: "a", until: ";" }), "Um, dois");
  assert.equal(cutClause(v, { verse: "a", from: ": " }), "quatro. Cinco.");
  assert.equal(cutClause(v, { verse: "a", through: "quatro." }), "Um, dois; três: quatro.");
  assert.equal(cutClause(v, { verse: "a", from: "; ", until: "." }), "três: quatro");
  assert.equal(cutClause(v, { verse: "a", from: ". ", until: "," }), null, "the end mark is looked for after the beginning");
  assert.equal(cutClause(v, { verse: "a", until: "!" }), null);
  assert.equal(cutClause(v, { verse: "a", from: "seis" }), null);
  assert.equal(cutClause(v, { verse: "zz" }), null);
  assert.equal(cutClause(v, { verse: "a", from: "Cinco." }), null, "an empty clause is no clause");
  // a mark written with "\\n" must be the verse's very end
  assert.equal(cutClause({ c: "um, dois," }, { verse: "c", until: ",\\n" }), "um, dois");
  assert.equal(cutClause({ c: "um, dois" }, { verse: "c", until: ",\\n" }), null);
  assert.equal(storyRef("Marcos", "Mark.2.14"), "Marcos 2:14");
  assert.equal(storyRef("Marcos", "Mark.2"), null);
  assert.equal(storyRef("", "Mark.2.14"), null);
});

test("a step with a verse missing or changed is not offered with other words in its place", () => {
  const s = STORY_STEPS[11];                                            // Levi: two clauses of one verse
  assert.equal(stepLines(s, { ...V, "Mark.2.14": "" }, data.livro), null);
  assert.equal(stepLines(s, { ...V, "Mark.2.14": "Outro texto sem a marca." }, data.livro), null);
  const without = { ...V }; delete without["Mark.2.14"];
  assert.equal(stepLines(s, without, data.livro), null);
  assert.deepEqual(stepVerses(s, without), []);
  assert.equal(stepLines(s, V, ""), null, "no book name, no reference, no line");
});
