// Browser check of the game's Bible: the mission line asks for it until the step is read, the panel shows the verses
// that tell the step (literal BLIVRE) and the passage in its place in the reading order, the game is paused while it
// is open, and after reading the objective and its distance appear. Missions are reached with the ?debug hooks
// (teleport + action); this is not a walked playthrough. Chromium viewport/touch emulation, not a physical phone.
//   npm run build && npx vite preview --port 4173 &   then   node tools/check_bible.mjs [url] [outdir]
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const URL_ = process.argv[2] ?? "http://localhost:4173/";
const OUT = process.argv[3] ?? "shots/bible";
mkdirSync(OUT, { recursive: true });
// the verses as the episode data has them: what the panel must show, letter for letter
const ep = JSON.parse(readFileSync(new URL("../src/data/mc-pescadores.json", import.meta.url), "utf8"));
const order = JSON.parse(readFileSync(new URL("../src/data/biblia-cronologica.json", import.meta.url), "utf8"));
const V = (n) => ep.versiculos[`Mark.1.${n}`];
const report = { url: URL_, note: "Missions reached by debug teleport and action; Chromium emulation, not a physical phone.", runs: {} };
const LONG = { timeout: 600000, polling: 150 };

async function run(name, ctxOpts) {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const page = await (await browser.newContext(ctxOpts)).newPage();
  const errors = [], warnings = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); else if (m.type() === "warning") warnings.push(m.text().slice(0, 300)); });
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  const touch = !!ctxOpts.hasTouch;
  const g = (fn, arg) => page.evaluate(fn, arg);
  const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent ?? null, sel);
  const press = async (sel) => { if (touch) await page.tap(sel, { timeout: 300000 }); else await page.click(sel, { timeout: 300000 }); };
  const isOpen = () => g(() => document.getElementById("biblia")?.open === true);
  const waitOpen = (open) => page.waitForFunction((o) => (document.getElementById("biblia")?.open === true) === o, open, LONG);
  const line = async () => ({ objective: await text("#objt"), right: await text("#dist"), sealed: await g(() => document.getElementById("obj").classList.contains("sealed")) });
  // the passage's verses in the panel: [number, state] in order
  const marks = () => g(() => [...document.querySelectorAll("#bible-here .bible-verse")].map((p) => [Number(p.querySelector("sup").textContent), p.dataset.state]));
  const nextBox = async () => ({ h: await text("#bible-next-h"), ref: await text("#bible-next-ref"),
    verses: await g(() => [...document.querySelectorAll("#bible-next-text .bible-verse")].map((p) => p.lastChild.textContent)), task: await text("#bible-next-do") });
  const r = {};

  await page.goto(`${URL_}?debug=1&dtmax=0.5`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__gta?.bible && !document.getElementById("go").disabled, null, LONG);
  assert.equal(await g(() => { window.__gta.openBible(); return document.getElementById("biblia").open; }), false, "the Bible does not open over the start card");
  await press("#go");
  await page.waitForFunction(() => window.__gta.state.phase === "play", null, LONG);

  // 1. the first step is unread: the line asks for the Bible and carries the verse's reference; no distance
  await page.waitForFunction(() => document.getElementById("objt").textContent === "Abra a Bíblia", null, LONG);
  assert.deepEqual(await line(), { objective: "Abra a Bíblia", right: "Marcos 1:16", sealed: true });
  assert.deepEqual(await g(() => { const b = window.__gta.bible(); return [b.step, b.read, b.sealed]; }), [0, -1, true]);
  await page.waitForFunction(() => document.querySelector(".journey-label")?.textContent === "Orientação", null, LONG);
  assert.equal(await text(".journey-body"), touch ? "Toque em “Abra a Bíblia” para ler o próximo passo." : "Aperte B, ou clique em “Abra a Bíblia”, para ler o próximo passo.");
  await page.screenshot({ path: `${OUT}/${name}-1-selado.png` });

  // 2. pressing the line opens the Bible, the game waits, and the step's verse is there, literal
  await press("#obj");
  await waitOpen(true);
  const t0 = await g(() => window.__gta.state.time);
  await g(() => new Promise((done) => { let n = 0; const tick = () => (++n >= 3 ? done() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }));
  assert.equal(await g(() => window.__gta.state.time), t0, "the game is paused while the Bible is open");
  assert.deepEqual(await nextBox(), { h: "Próximo passo", ref: "Marcos 1:16", verses: [V(16)], task: "No jogoDesça até a praia" });
  assert.deepEqual(await marks(), [[16, "agora"], [17, "a-seguir"], [18, "a-seguir"], [19, "a-seguir"], [20, "a-seguir"], [21, "a-seguir"]]);
  assert.deepEqual(await g(() => [...document.querySelectorAll("#bible-here .bible-verse")].map((p) => p.childNodes[1].textContent)), [16, 17, 18, 19, 20, 21].map(V),
    "the passage's verses, letter for letter");
  // the reading order: the itinerary's moments with the passage after the baptism
  const entries = await g(() => [...document.querySelectorAll(".bible-list > li")].map((li) => [li.querySelector(".bible-tag").textContent, li.querySelector("strong").textContent, li.querySelector(".bible-where").textContent]));
  const expected = order.momentos.map((m, i) => [i < 2 ? "Antes desta passagem" : "Ainda não jogável", m.titulo, `${m.fase} · ${m.lugar} · ${m.ref}`]);
  expected.splice(2, 0, ["Você está aqui", ep.titulo, `${ep.lugar} · Marcos 1:16–21`]);
  assert.deepEqual(entries, expected);
  assert.equal(await text(".bible-note"), "Roteiro de leitura do Bíblia Conectada: uma ordem editorial ampla, não uma cronologia histórica harmonizada. Esta passagem aparece depois de “Às águas do Jordão” pela ordem de Marcos; a relação exata com os relatos dos outros evangelhos não é fixada.");
  assert.ok((await text(".bible-footer")).startsWith("Todas as Escrituras em português citadas são da Bíblia Livre (BLIVRE)"), "the BLIVRE notice is in the panel");
  // another moment opens with its own literal text
  await g(() => { document.querySelector(".bible-list > li:nth-child(2) details").open = true; });
  assert.deepEqual(await g(() => [...document.querySelectorAll(".bible-list > li:nth-child(2) .bible-verse")].map((p) => p.childNodes[1].textContent)), order.momentos[1].versiculos.map((v) => v.texto));
  const fits = await g(() => { const d = document.getElementById("biblia").getBoundingClientRect(); return d.left >= 0 && d.top >= 0 && d.right <= innerWidth && d.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth; });
  assert.equal(fits, true, "the panel fits the screen");
  await page.screenshot({ path: `${OUT}/${name}-2-biblia.png` });

  // 3. back in the game the objective and its distance are there, and the action key is not left on a button
  await press("#bible-close");
  await waitOpen(false);
  await page.waitForFunction(() => document.getElementById("objt").textContent !== "Abra a Bíblia", null, LONG);
  const read = await line();
  assert.equal(read.objective, "Desça até a praia"); assert.match(read.right, /^\d+ m$/); assert.equal(read.sealed, false);
  assert.deepEqual(await g(() => { const b = window.__gta.bible(); return [b.step, b.read, b.sealed]; }), [0, 0, false]);
  assert.notEqual(await g(() => document.activeElement?.id), "obj", "focus is not left on the mission line");
  await page.screenshot({ path: `${OUT}/${name}-3-lido.png` });
  if (!touch) {
    await page.keyboard.press("KeyB"); await waitOpen(true);
    await page.keyboard.press("Escape"); await waitOpen(false);
    await page.keyboard.press("KeyB"); await waitOpen(true);
    await page.keyboard.press("KeyB"); await waitOpen(false);
  }

  // 4. the next step is sealed again; the game can still be played without reading (the prompt shows by the nets)
  const P = await g(() => window.__gta.meta.points);
  const head = (a, b) => Math.atan2(b[0] - a[0], -(b[1] - a[1]));
  const tp = (x, z, h) => g(([x, z, h]) => window.__gta.teleport(x, z, h), [x, z, h]);
  await tp(P.beach[0], P.beach[1], head(P.start, P.beach));
  await page.waitForFunction(() => window.__gta.state.mission === 1 && document.getElementById("objt").textContent === "Abra a Bíblia", null, LONG);
  assert.deepEqual(await line(), { objective: "Abra a Bíblia", right: "Marcos 1:16–18", sealed: true });
  await tp(P.simao[0] + (P.beach[0] - P.simao[0]) * 0.015, P.simao[1] + (P.beach[1] - P.simao[1]) * 0.015, head(P.beach, P.simao));
  await page.waitForFunction(() => window.__gta.state.promptVisible, null, LONG);
  assert.equal(await g(() => { const e = document.getElementById(matchMedia("(pointer: coarse)").matches || "ontouchstart" in window ? "act" : "prompt"); return e.hidden; }), false,
    "the action is offered by the nets even with the step unread");
  await g(() => window.__gta.act());
  await page.waitForFunction(() => window.__gta.state.mission === 2 && window.__gta.state.phase === "play", null, LONG);

  // 5. the third step, read: the first call is lived, the second is now
  await page.waitForFunction(() => document.getElementById("objt").textContent === "Abra a Bíblia", null, LONG);
  assert.deepEqual(await line(), { objective: "Abra a Bíblia", right: "Marcos 1:19–20", sealed: true });
  await press("#obj"); await waitOpen(true);
  assert.deepEqual(await nextBox(), { h: "Próximo passo", ref: "Marcos 1:19–20", verses: [V(19), V(20)], task: "No jogoChame Tiago e João" });
  assert.deepEqual(await marks(), [[16, "vivido"], [17, "vivido"], [18, "vivido"], [19, "agora"], [20, "agora"], [21, "a-seguir"]]);
  await page.screenshot({ path: `${OUT}/${name}-4-segundo-chamado.png` });
  await page.keyboard.press("Escape"); await waitOpen(false);
  await page.waitForFunction(() => document.getElementById("objt").textContent === "Chame Tiago e João", null, LONG);
  await tp(P.barco_margem[0] + (P.simao[0] - P.barco_margem[0]) * 0.03, P.barco_margem[1] + (P.simao[1] - P.barco_margem[1]) * 0.03, head(P.simao, P.barco));
  await page.waitForFunction(() => window.__gta.state.promptVisible, null, LONG);
  await g(() => window.__gta.act());
  await page.waitForFunction(() => window.__gta.state.phase === "done" && !document.getElementById("end").hidden, null, LONG);
  assert.equal(await g(() => { window.__gta.openBible(); return document.getElementById("biblia").open; }), false, "the Bible does not open over the end card");

  // 6. exploring: the way back is the next verse, and it too is learned in the Bible
  await press("#roam");
  await page.waitForFunction(() => window.__gta.roam().phase === "return" && document.getElementById("objt").textContent === "Abra a Bíblia", null, LONG);
  assert.deepEqual(await line(), { objective: "Abra a Bíblia", right: "Marcos 1:21", sealed: true });
  await press("#obj"); await waitOpen(true);
  assert.deepEqual(await nextBox(), { h: "Próximo passo", ref: "Marcos 1:21", verses: [V(21)], task: "No jogoVolte a Cafarnaum" });
  assert.deepEqual(await marks(), [[16, "vivido"], [17, "vivido"], [18, "vivido"], [19, "vivido"], [20, "vivido"], [21, "agora"]]);
  await press("#bible-close"); await waitOpen(false);
  await page.waitForFunction(() => document.getElementById("objt").textContent === "Volte a Cafarnaum", null, LONG);
  assert.match(await text("#dist"), /^\d+ m$/);
  await tp(P.start[0], P.start[1] + 10, head(P.beach, P.start));
  await page.waitForFunction(() => window.__gta.roam().phase === "free", null, LONG);
  await g(() => window.__gta.openBible()); await waitOpen(true);
  assert.equal(await text("#bible-next-h"), "Passagem vivida");
  assert.deepEqual((await marks()).map((m) => m[1]), Array(6).fill("vivido"));
  assert.equal(await text("#bible-here .bible-tag"), "Vivida");
  await page.screenshot({ path: `${OUT}/${name}-5-vivida.png` });
  await page.keyboard.press("Escape"); await waitOpen(false);
  assert.equal(await isOpen(), false);

  // The optional fauna gives each asset 30 s of real time; a software renderer exceeds it and GLTFLoader then logs its
  // aborted textures. Only when the game itself reported that timeout are those lines set apart, and counted.
  const faunaTimedOut = warnings.some((w) => /Animal opcional indisponível/.test(w) && /timed out|TimeoutError/i.test(w));
  const real = faunaTimedOut ? errors.filter((e) => !/^THREE\.GLTFLoader: Couldn't load texture blob:/.test(e)) : errors;
  assert.deepEqual(real, [], `no page, console or HTTP errors (warnings: ${JSON.stringify(warnings.slice(0, 6))})`);
  r.errors = real.length; r.faunaTimedOut = faunaTimedOut; r.faunaTextureErrorsSetApart = errors.length - real.length;
  report.runs[name] = r;
  console.log(`${name}: ok${faunaTimedOut ? `; fauna opcional expirou neste renderizador (30 s reais): ${r.faunaTextureErrorsSetApart} erros de textura dela postos à parte` : ""}`);
  await browser.close();
}

await run("celular", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
await run("pc", { viewport: { width: 1280, height: 800 } });
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ok: true, runs: Object.keys(report.runs) }));
