// The game's Bible against the data it is built from: the reading order, the passage's place in it, and which
// verses tell which step.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { currentStep, episodePosition, episodeSteps, rangeRef, readingOrder, verseKeys, verseStates, type BibleData } from "../src/bible.ts";
import { goals as makeGoals } from "../src/episode.ts";
import type { EpisodeData } from "../src/missions.ts";
import type { WorldMeta } from "../src/terrain.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const data = JSON.parse(read("src/data/biblia-cronologica.json")) as BibleData;
const ep = JSON.parse(read("src/data/mc-pescadores.json")) as EpisodeData & { personagens: { id: string; ref: string; nome: string }[] };
const goals = makeGoals(JSON.parse(read("public/world/cafarnaum.json")) as WorldMeta);
const steps = episodeSteps(ep, goals, "Volte a Cafarnaum");

test("the reading order is biblia-conectada's itinerary, with literal text and its sources named", () => {
  // literal: the ten moments of site/src/lib/chronological-reading.ts, in its order
  assert.deepEqual(data.momentos.map((m) => m.id), ["nascimento", "batismo", "cana", "ensino", "paes", "entrada", "refeicao", "cruz", "tumulo", "reencontros"]);
  assert.match(data.origem.texto_sha256, /^[0-9a-f]{64}$/); assert.match(data.origem.roteiro_sha256, /^[0-9a-f]{64}$/);
  assert.equal(data.origem.texto_sha256, "99b62593c3cc6387bbd4aa6aff11103a5c3f5bda87d6257155bdb6576e3e1231", "the BLIVRE file biblia-conectada pins");
  assert.equal(data.fonte_texto, "Bíblia Livre (BLIVRE), CC BY 4.0 BR");
  assert.deepEqual(data.evangelhos.map((g) => g.nome), ["Mateus", "Marcos", "Lucas", "João"]);
  for (const m of data.momentos) {
    assert.ok(m.titulo && m.fase && m.lugar && m.ref, m.id);
    const shown = m.passagens.find((p) => p.ref === m.ref);
    assert.ok(shown, `${m.id}: the shown reference is one of its passages`);
    assert.equal(m.versiculos.length, shown.ate - shown.de + 1, `${m.id}: every verse of ${m.ref}`);
    m.versiculos.forEach((v, i) => { assert.equal(v.n, shown.de + i); assert.ok(v.texto.trim().length > 10, `${m.ref}:${v.n} has text`); });
    assert.equal(data.evangelhos.find((g) => g.id === shown.evangelho)?.nome, m.evangelho);
    assert.ok(m.ref.startsWith(`${m.evangelho} ${shown.capitulo}:${shown.de}`));
  }
  // literal samples, verbatim from the BLIVRE (brackets and spacing as the source has them)
  const verse = (id: string, n: number) => data.momentos.find((m) => m.id === id)!.versiculos.find((v) => v.n === n)!.texto;
  assert.equal(verse("batismo", 9), "E aconteceu que, naqueles dias, Jesus de Nazaré da Galileia veio, e foi batizado por João no Jordão.");
  assert.equal(verse("ensino", 3), "Benditos são os humildes de espírito, porque deles é o Reino dos céus.");
  assert.ok(verse("refeicao", 19).includes("[a Deus] ,partiu-o"), "not cleaned up");
});

test("the played passage sits after the last moment its own gospel tells before it", () => {
  const keys = verseKeys(ep);
  assert.deepEqual(keys, ["Mark.1.16", "Mark.1.17", "Mark.1.18", "Mark.1.19", "Mark.1.20", "Mark.1.21"]);
  const pos = episodePosition(data.momentos, keys[0]);
  assert.equal(pos.gospel, "marcos");
  assert.equal(pos.after?.id, "batismo", "Mark tells the baptism (1:9–11) before 1:16");
  assert.equal(pos.at, 2);
  // the next moment Mark tells comes later in Mark, so the order is consistent with that gospel
  const laterInMark = data.momentos.slice(pos.at).flatMap((m) => m.passagens.filter((p) => p.evangelho === "marcos"));
  assert.ok(laterInMark.length > 0);
  for (const p of laterInMark) assert.ok(p.capitulo > 1 || p.de > 21, `${p.ref} is after the passage`);
  const order = readingOrder(data, ep);
  assert.deepEqual(order.entries.map((e) => (e.kind === "episodio" ? `* ${e.titulo}` : e.moment.id)),
    ["nascimento", "batismo", "* Pescadores de gente", "cana", "ensino", "paes", "entrada", "refeicao", "cruz", "tumulo", "reencontros"]);
  const mine = order.entries[2];
  assert.ok(mine.kind === "episodio" && mine.ref === "Marcos 1:16–21" && mine.lugar === "mar da Galileia");
  assert.equal(order.gospelName, "Marcos"); assert.equal(order.after?.titulo, "Às águas do Jordão");
  assert.deepEqual(order.entries.map((e) => (e.kind === "momento" ? e.when : "aqui")), ["antes", "antes", "aqui", ...Array(8).fill("depois")]);
  // an unknown book or a passage before everything: nothing is guessed
  assert.deepEqual(episodePosition(data.momentos, "Acts.1.1"), { at: 0, after: null, gospel: null });
  assert.equal(episodePosition(data.momentos, "Mark.1.2").at, 0);
  assert.equal(episodePosition(data.momentos, "John.21.1").after?.id, "reencontros");
});

test("each step of the game is told by its own verses, derived from the data", () => {
  // literal expectation: the walk shares 1:16 with the first call; the call runs to 1:18; the second is 1:19–20
  assert.deepEqual(steps.map((s) => [s.kind, s.ref, s.objetivo, s.verses.map((k) => k.split(".")[2]).join(",")]), [
    ["missao", "Marcos 1:16", "Desça até a praia", "16"],
    ["missao", "Marcos 1:16–18", "Chame Simão e André", "16,17,18"],
    ["missao", "Marcos 1:19–20", "Chame Tiago e João", "19,20"],
    ["epilogo", "Marcos 1:21", "Volte a Cafarnaum", "21"],
  ]);
  // every verse of the passage belongs to a step, and each mission's own line is inside its verses
  assert.deepEqual([...new Set(steps.flatMap((s) => s.verses))], verseKeys(ep));
  ep.missoes.forEach((m, i) => { if (m.fala) assert.ok(steps[i].verses.some((k) => ep.versiculos[k].includes(m.fala!.texto)), `${m.fala.ref} is in step ${i}`); });
  assert.equal(episodeSteps(ep, goals, null).length, 3, "no epilogue objective, no epilogue step");
  assert.deepEqual(episodeSteps({ ...ep, versiculos: {} }, goals, "x"), []);
  assert.equal(rangeRef(ep, "Mark.1.16", "Mark.1.16"), "Marcos 1:16");
  assert.equal(rangeRef(ep, "Mark.1.16", "Mark.2.1"), null); assert.equal(rangeRef(ep, "Mark.1.18", "Mark.1.16"), null);
});

test("the step being played and the state of each verse", () => {
  assert.equal(currentStep(steps, "intro", 0, "off"), 0);
  assert.equal(currentStep(steps, "play", 1, "off"), 1);
  assert.equal(currentStep(steps, "line", 2, "off"), 2);
  assert.equal(currentStep(steps, "done", 2, "off"), 3, "the end card: the epilogue is the next step");
  assert.equal(currentStep(steps, "done", 2, "return"), 3);
  assert.equal(currentStep(steps, "done", 2, "line"), 3);
  assert.equal(currentStep(steps, "done", 2, "free"), 4, "everything lived");
  assert.equal(currentStep(steps.slice(0, 3), "done", 2, "off"), 3, "without an epilogue the passage ends with the last mission");
  const st = (current: number) => verseKeys(ep).map((k) => verseStates(steps, current).get(k));
  assert.deepEqual(st(0), ["agora", "a-seguir", "a-seguir", "a-seguir", "a-seguir", "a-seguir"]);
  assert.deepEqual(st(1), ["agora", "agora", "agora", "a-seguir", "a-seguir", "a-seguir"]);
  assert.deepEqual(st(2), ["vivido", "vivido", "vivido", "agora", "agora", "a-seguir"]);
  assert.deepEqual(st(3), ["vivido", "vivido", "vivido", "vivido", "vivido", "agora"]);
  assert.deepEqual(st(4), Array(6).fill("vivido"));
});
