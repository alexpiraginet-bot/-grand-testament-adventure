// What the game shows as fact is checked against the data it comes from.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { counterTotal, type EpisodeData } from "../src/missions.ts";
import { createHash } from "node:crypto";
import { decodeHeights, Terrain, type HeightsFile, type WorldMeta } from "../src/terrain.ts";
import { BLIVRE_NOTICE } from "../src/credits.ts";
import { goals, npcs } from "../src/episode.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url));
const ep = JSON.parse(read("src/data/mc-pescadores.json").toString()) as EpisodeData & { personagens: { id: string; ref: string; nome: string }[] };
const meta = JSON.parse(read("public/world/cafarnaum.json").toString()) as WorldMeta & { far: { n: number } };
const nearFile = JSON.parse(read("public/world/cafarnaum-heights.json").toString()) as HeightsFile;
const farFile = JSON.parse(read("public/world/far-heights.json").toString()) as HeightsFile;
const near = decodeHeights(nearFile);
const terrain = new Terrain(meta, near);
const PT: Record<string, string> = { Mark: "Marcos" };
const refPt = (osis: string) => { const [b, c, v] = osis.split("."); return `${PT[b]} ${c}:${v}`; };

test("every line on screen is a literal fragment of the verse it cites", () => {
  const byPt = Object.fromEntries(Object.entries(ep.versiculos).map(([k, v]) => [refPt(k), v]));
  let n = 0;
  for (const m of ep.missoes) {
    if (!m.fala) continue;
    const verse = byPt[m.fala.ref];
    assert.ok(verse, `verse ${m.fala.ref} missing`);
    assert.ok(verse.includes(m.fala.texto), `"${m.fala.texto}" is not in ${m.fala.ref}`);
    n++;
  }
  assert.equal(n, 2);
});

test("the place name and every person's name are written as the BLIVRE writes them", () => {
  assert.ok(ep.versiculos["Mark.1.16"].includes(ep.lugar));
  for (const p of ep.personagens) assert.ok(ep.versiculos[p.ref].includes(p.nome), `${p.nome} not in ${p.ref}`);
  assert.deepEqual(ep.personagens.slice(0, 4).map((p) => p.nome), ep.contador.prova.map((p) => p.nome));
  for (const p of ep.contador.prova) assert.ok(ep.versiculos[p.ref].includes(p.nome));
});

test("the counter's total is the number of names, and the last mission fills it", () => {
  assert.equal(counterTotal(ep), 4);
  assert.equal(ep.missoes[ep.missoes.length - 1].conta, counterTotal(ep));
  const contas = ep.missoes.map((m) => m.conta);
  assert.deepEqual([...contas].sort((a, b) => a - b), contas, "the counter never goes down");
});

test("the BLIVRE notice is the authors' text, unchanged", () => {
  // src/data/attribution.json is copied by tools/build_world.py from biblia-conectada/ATTRIBUTION.md
  const att = JSON.parse(read("src/data/attribution.json").toString()) as { blivre: string };
  assert.equal(BLIVRE_NOTICE, att.blivre);
});

test("the world files agree with their description", () => {
  assert.equal(near.length, meta.n * meta.n);
  assert.equal(decodeHeights(farFile).length, meta.far.n * meta.far.n);
  // the decoder gives back the bytes the builder hashed
  for (const [f, a] of [[nearFile, near], [farFile, decodeHeights(farFile)]] as const)
    assert.equal(createHash("sha256").update(new Uint8Array(a.buffer)).digest("hex"), f.sha256);
  const [lo, hi] = meta.relief_range_m;
  let mn = Infinity, mx = -Infinity;
  for (const h of terrain.h) { mn = Math.min(mn, h); mx = Math.max(mx, h); }
  assert.ok(Math.abs(mn - lo) < 0.011 && Math.abs(mx - hi) < 0.011, `${mn}..${mx} vs ${lo}..${hi}`);
});

test("the level is playable: start and goals on land, the boat afloat, the shore between them", () => {
  const P = meta.points;
  assert.ok(terrain.heightAt(...P.start) > 1, "start on dry land");
  assert.ok(Math.abs(terrain.heightAt(...P.beach)) < 0.6, "beach at the waterline");
  assert.ok(Math.abs(terrain.heightAt(...P.simao)) < 0.6, "Simão at the waterline");
  assert.ok(terrain.heightAt(...P.barco) < -0.5, "the boat floats");
  assert.ok(Math.abs(terrain.heightAt(...P.barco_margem)) < 0.6);
  // walking from the start to the beach goes downhill and never through water
  for (let i = 0; i <= 50; i++) {
    const x = P.start[0] + (P.beach[0] - P.start[0]) * i / 50, z = P.start[1] + (P.beach[1] - P.start[1]) * i / 50;
    assert.ok(terrain.heightAt(x, z) > -0.55, `water on the way at ${i}`);
  }
  const g = goals(meta);
  assert.equal(g.length, ep.missoes.length);
  // "call" goals are reachable on foot: their point is not deeper than wading
  for (const goal of g) assert.ok(terrain.heightAt(goal.at.x, goal.at.z) > -0.55);
  const names = Object.fromEntries(ep.personagens.map((p) => [p.id, p.nome]));
  const people = npcs(meta, names);
  assert.equal(people.filter((p) => p.look === "empregado").length, meta.level_design.empregados);
  for (const p of people.filter((q) => !q.inBoat)) assert.ok(terrain.heightAt(p.pos.x, p.pos.z) > -0.55, `${p.id} stands`);
});
