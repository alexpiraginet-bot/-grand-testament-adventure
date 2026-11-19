// Browser check of the story after the teaching (story-journey.ts): the twenty steps from Mark 1:30 to 4:35, played
// in the running game at 1280x800 (keyboard) and 390x844 (touch).
//
// What is real here and what is not. The first episode is skipped with the debug hook a returning player's "Explorar
// a região" uses (__gta.beginExplore); the hero is moved to each place by debug teleport, so no walk is timed. What
// is real: the game's own places (compared with the ones Node computes on the same terrain, and probed with the
// game's own movement rule and colliders, including a flood fill that walks from the village to every place), the
// teaching step and every action lived with a real press (the E key, or a tap on the hand), the clauses read from the
// HUD letter by letter against the data file, the world record in this browser's storage across real reloads, and
// the Bible panel. Chromium viewport emulation on a software renderer: not a physical phone, and no frame rate here
// says anything about a real device.
//   npx vite build && npx vite preview --port 4173 &   then   node tools/check_story_r16.mjs [url] [outdir] [dtmax]
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { MARGIN, P, beach, routes, scene, start, t } from "../test/fixtures/town-scene.ts";
import { townLife } from "../src/town-life-layout.ts";
import { storyPlaces } from "../src/story-places.ts";
import { STORY_GUIDANCE, storySteps } from "../src/story-journey.ts";
import { storyTask } from "../src/story-bible.ts";
import { stepVerses } from "../src/story-steps.ts";
import { SCENE_DEVELOPMENT_NOTICE } from "../src/journey.ts";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const URL_ = process.argv[2] ?? "http://localhost:4173/";
const OUT = process.argv[3] ?? "shots/story-r16";
const DTMAX = Number(process.argv[4] ?? 1.5);                 // game seconds a slow frame may carry (?debug&dtmax)
mkdirSync(OUT, { recursive: true });
const LONG = { timeout: Number(process.env.STORY_WAIT ?? 900000), polling: 150 };   // each wait; a software renderer needs minutes to load
const data = JSON.parse(readFileSync(new URL("../src/data/mc-caminho.json", import.meta.url), "utf8"));
const steps = storySteps(data);
assert.ok(steps && steps.length === 20, "the data gives the twenty steps");
const expectedPlaces = [256, 192].map((segments) => {
  const town = scene(segments), life = townLife({ terrain: t, start, beach, routes, plans: town.plans, boxes: town.boxes, margin: MARGIN });
  return { segments, places: storyPlaces({ terrain: t, routes, plans: town.plans, boxes: town.boxes, margin: MARGIN, beach,
    nets: { x: P.simao[0], z: P.simao[1] }, boat: { x: P.barco_margem[0], z: P.barco_margem[1] }, house: life?.onward ?? null }) };
});
const round = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "number" ? Math.round(x * 1e6) / 1e6 : x)));
const report = { url: URL_, dtmax: DTMAX,
  note: "Episode skipped by the debug hook beginExplore; places reached by debug teleport; the teaching and every action by a real press. Chromium emulation on a software renderer, not a physical phone.",
  runs: {} };

async function run(name, ctxOpts) {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const page = await (await browser.newContext(ctxOpts)).newPage();
  // a software renderer can take longer than Playwright's 30 s for a click or a screenshot: that is the tool's limit, not the game's
  page.setDefaultTimeout(600000);
  const errors = [], warnings = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); else if (m.type() === "warning") warnings.push(m.text().slice(0, 300)); });
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  const touch = !!ctxOpts.hasTouch;
  const g = (fn, arg) => page.evaluate(fn, arg);
  const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent ?? null, sel);
  const visible = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== "none"; }, sel);
  const tp = (p, h = 0) => g(([x, z, h]) => window.__gta.teleport(x, z, h), [p.x, p.z, h]);
  const head = (a, b) => Math.atan2(b.x - a.x, -(b.z - a.z));
  /** One real press of the action: a tap on the hand, or the E key with the canvas focused. */
  const act = async () => {
    if (touch) { await page.tap("#act", { timeout: 600000 }); return; }
    await page.locator("#c").click({ position: { x: Math.floor(ctxOpts.viewport.width * 0.55), y: Math.floor(ctxOpts.viewport.height * 0.45) }, timeout: 600000 });
    await page.keyboard.press("KeyE");
  };
  const story = () => g(() => { const s = window.__gta.story(); return { state: s.state, view: s.view, storage: s.storage,
    lived: Object.entries(s.record.encounters).filter(([, v]) => v.stage === "completed").map(([k]) => k) }; });
  /** Loads the game and enters the open region as a player who had finished the episode does. */
  const enter = async () => {
    await page.goto(`${URL_}?debug=1&dtmax=${DTMAX}`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__gta?.story && !document.getElementById("go").disabled, null, LONG);
    // Every clause the HUD shows is written down in the page, once, on the frame it appears (after the game's own
    // frame, which is registered first). On a software renderer a short clause can come and go between two polls
    // from here, so the clauses are read from this log once a step was lived, not chased one by one.
    await g(() => {
      const log = (window.__storyLog = []);
      let last = "";
      const tick = () => {
        const s = window.__gta.story().state, sub = document.getElementById("sub");
        if (s.phase !== "line") last = "";
        else if (!sub.hidden && `${s.step}:${s.index}` !== last) {
          last = `${s.step}:${s.index}`;
          const scene = document.getElementById("scene-development");
          log.push({ step: s.step, index: s.index, text: document.getElementById("subt").textContent, ref: document.getElementById("subr").textContent,
            mk: document.getElementById("mk").textContent, scene: scene.hidden ? "" : scene.textContent,
            body: document.querySelector(".journey-body").textContent, offered: window.__gta.actions().receiver.to });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await g(() => window.__gta.beginExplore());
    await page.waitForFunction(() => window.__gta.roam().phase === "free" && window.__gta.state.phase === "done", null, LONG);
  };
  const r = (report.runs[name] = { viewport: ctxOpts.viewport, touch, steps: [] });
  const t0 = Date.now();
  try {
    await enter();
    // ---- 1. the running game's story is the one the tests play: same steps, same places
    const game = await g(() => { const s = window.__gta.story(); return { places: s.places, steps: s.steps, layout: window.__gta.teaching().layout }; });
    assert.ok(game.places && game.steps, "the running game offers the story");
    assert.deepEqual(game.steps, steps.map((s) => ({ id: s.def.id, ref: s.ref, place: s.def.place, action: s.def.action, lines: s.lines })), "the steps and their clauses");
    const same = expectedPlaces.find((e) => { try { assert.deepEqual(round(game.places), round(e.places)); return true; } catch { return false; } });
    r.placesMatchNode = same ? { segments: same.segments } : null;
    assert.ok(same, "the running game's places are the ones Node computes with the rebuilt colliders");
    const at = game.places.at;
    // ---- 2. every place by the game's own movement rule, and a walk from the village to each one
    const probe = await g(({ at, from }) => {
      const blocked = (x, z) => window.__gta.blocked(x, z, false), t0 = performance.now();
      const out = { places: {}, flood: null };
      for (const [id, p] of Object.entries(at)) {
        let ring = 0;
        for (let k = 0; k < 24; k++) if (!blocked(p.x + Math.sin((k * Math.PI) / 12) * 3, p.z + Math.cos((k * Math.PI) / 12) * 3)) ring++;
        out.places[id] = { blocked: blocked(p.x, p.z), ring };
      }
      // flood fill on a 1 m grid: two neighbours are joined when the point between them is free too (0.5 m between
      // samples; the thinnest collider is 0.6 m wide once the hero's body is added)
      const x0 = -560, x1 = 140, z0 = -20, z1 = 620, nx = x1 - x0 + 1, nz = z1 - z0 + 1;
      const state = new Int8Array(nx * nz), seen = new Uint8Array(nx * nz), queue = new Int32Array(nx * nz);
      const free = (i) => { if (!state[i]) state[i] = blocked(x0 + (i % nx), z0 + Math.floor(i / nx)) ? -1 : 1; return state[i] === 1; };
      const cellOf = (p) => {
        let best = -1, bd = Infinity;
        for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
          const x = Math.round(p.x) + dx, z = Math.round(p.z) + dz;
          if (x < x0 || x > x1 || z < z0 || z > z1) continue;
          const i = (z - z0) * nx + (x - x0), d = Math.hypot(p.x - x, p.z - z);
          if (d >= bd || !free(i)) continue;
          let clear = true;
          for (let k = 0; k <= 20 && clear; k++) clear = !blocked(p.x + ((x - p.x) * k) / 20, p.z + ((z - p.z) * k) / 20);
          if (clear) { bd = d; best = i; }
        }
        return best;
      };
      const begin = cellOf(from);
      let head = 0, tail = 0;
      if (begin >= 0) { seen[begin] = 1; queue[tail++] = begin; }
      while (head < tail) {
        const cur = queue[head++], ix = cur % nx, iz = Math.floor(cur / nx);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const jx = ix + dx, jz = iz + dz;
          if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
          const next = jz * nx + jx;
          if (seen[next] || !free(next) || blocked(x0 + ix + dx / 2, z0 + iz + dz / 2)) continue;
          seen[next] = 1; queue[tail++] = next;
        }
      }
      out.flood = { cells: tail, ms: Math.round(performance.now() - t0),
        reached: Object.fromEntries(Object.entries(at).map(([id, p]) => { const c = cellOf(p); return [id, c >= 0 && seen[c] === 1]; })) };
      return out;
    }, { at, from: { x: P.start[0], z: P.start[1] } });
    r.flood = { cells: probe.flood.cells, ms: probe.flood.ms };
    for (const [id, p] of Object.entries(probe.places)) { assert.equal(p.blocked, false, `${id} is blocked in the running game`); assert.ok(p.ring >= 12, `${id}: only ${p.ring} of 24 directions free`); }
    for (const [id, ok] of Object.entries(probe.flood.reached)) assert.equal(ok, true, `${id} cannot be walked to from the village in the running game`);

    // ---- 3. the story is closed until the teaching step is lived and the house reached
    assert.equal((await story()).state.phase, "off");
    await page.waitForFunction(() => document.getElementById("mk").textContent === "CAFARNAUM · ENSINAMENTOS", null, LONG);
    const fresh = (await g(() => window.__gta.teaching().state.phase)) !== "done";
    if (fresh) {
      await tp({ x: game.layout.court.at.x, z: game.layout.court.at.z + 2 });
      await page.waitForFunction(() => { const a = window.__gta.actions(); return window.__gta.teaching().state.phase === "ready" && a.shown.to === "mission" && a.shown.label === "Ensinar"; }, null, LONG);
      await act();
      await page.waitForFunction(() => window.__gta.teaching().state.phase === "done", null, LONG);
    }
    const before = await story();
    assert.deepEqual([before.state.phase, before.view], ["off", null], "the story does not open before the house is reached");
    await tp(game.layout.onward.at);
    await page.waitForFunction(() => window.__gta.teaching().state.onwardSeen === true && window.__gta.story().state.phase !== "off", null, LONG);

    // ---- 4. the twenty steps
    const reloadAfter = new Set([6, 13]);                          // real reloads in the middle: after steps 7 and 14
    for (let k = 0; k < steps.length; k++) {
      const cur = steps[k], here = at[cur.def.place], mark = `JORNADA · ${k + 1} DE ${steps.length}`, row = { id: cur.def.id, ref: cur.ref };
      await page.waitForFunction((k) => { const s = window.__gta.story().state; return s.step === k && (s.phase === "walk" || s.phase === "ready"); }, k, LONG);
      const prev = k ? at[steps[k - 1].def.place] : here;
      if (k && prev !== here) {
        // on the way: the mission line, the passage's reference and the distance to the game's place
        await page.waitForFunction((m) => document.getElementById("mk").textContent === m && window.__gta.story().state.phase === "walk", mark, LONG);
        assert.equal(await text("#objt"), cur.def.objective);
        assert.equal(await text("#ref"), cur.ref);
        const far = await g(() => window.__gta.story().view.dist);
        assert.ok(Math.abs(far - Math.hypot(here.x - prev.x, here.z - prev.z)) < 1.5, `${cur.def.id}: the distance shown is the distance to its place`);
        assert.equal(await text("#dist"), `${Math.round(far)} m`);
        assert.equal(await g(() => window.__gta.actions().receiver.to), "none", `${cur.def.id}: nothing is offered away from its place`);
        await page.waitForFunction((t) => document.querySelector(".journey-body").textContent === t, STORY_GUIDANCE.walk, LONG);
        assert.equal(await text(".journey-label"), "Orientação");
        row.walkM = Math.round(far);
      }
      await tp(here, head(prev === here ? { x: here.x, z: here.z - 1 } : prev, here));
      if (cur.def.action) {
        await page.waitForFunction((label) => { const a = window.__gta.actions(); return window.__gta.story().state.phase === "ready" && a.shown.to === "mission" && a.shown.label === label; }, cur.def.action, LONG);
        assert.equal(await text("#mk"), mark);
        assert.equal(await text("#objt"), cur.def.doing);
        if (touch) assert.equal(await visible("#act"), true, `${cur.def.id}: the hand is offered`);
        // the label is inside the round button: its line boxes against the button's circle, in the real styles
        const fit = await g(() => {
          const b = document.getElementById("act"), t = document.getElementById("actt");
          if (b.hidden || getComputedStyle(b).display === "none") return null;
          const rb = b.getBoundingClientRect(), cx = rb.left + rb.width / 2, cy = rb.top + rb.height / 2, r = Math.min(rb.width, rb.height) / 2;
          const range = document.createRange(); range.selectNodeContents(t);
          const lines = [...range.getClientRects()].filter((q) => q.width > 0);
          const over = Math.max(...lines.flatMap((q) => [[q.left, q.top], [q.right, q.top], [q.left, q.bottom], [q.right, q.bottom]].map(([x, y]) => Math.hypot(x - cx, y - cy) - r)));
          return { label: t.textContent, lines: lines.length, over: Math.round(over * 10) / 10 };
        });
        if (touch) assert.ok(fit, `${cur.def.id}: the round button is there to be measured`);
        if (fit) {
          assert.equal(fit.label, cur.def.action);
          assert.ok(fit.lines >= 1 && fit.lines <= 2 && fit.over <= 0, `${cur.def.id}: "${fit.label}" leaves the round button by ${fit.over} px (${fit.lines} lines)`);
          row.buttonInsideByPx = -fit.over;
        }
        await act();
      }
      // its clauses come on screen. For the picture the story's clock is held (the debug hook __gta.freeze: nothing
      // else is changed), because a screenshot here takes longer than a clause stays; then the step is lived
      await page.waitForFunction((k) => window.__storyLog.some((e) => e.step === k) && (window.__gta.freeze(true), true), k, LONG);
      await page.screenshot({ path: `${OUT}/${name}-${String(k + 1).padStart(2, "0")}-${cur.def.id}.png` });
      await g(() => window.__gta.freeze(false));
      await page.waitForFunction((k) => window.__gta.story().state.step === k + 1, k, LONG);
      // what the HUD showed for this step: its clauses, each once, in order, letter for letter
      const shown = await g((k) => window.__storyLog.filter((e) => e.step === k), k);
      assert.deepEqual(shown.map((e) => e.index), cur.lines.map((_, i) => i), `${cur.def.id}: each clause once, in order`);
      shown.forEach((seen, i) => {
        const line = cur.lines[i], verse = data.versiculos[cur.def.cuts[i].verse];
        assert.equal(seen.text, `“${line.texto}”`, `${cur.def.id} clause ${i + 1}`);
        assert.ok(verse.includes(line.texto), `${cur.def.id} clause ${i + 1} is in its verse to the letter`);
        assert.equal(seen.ref, `BÍBLIA LIVRE · ${line.ref.toUpperCase()}`);
        assert.equal(seen.mk, mark);
        assert.equal(seen.scene, cur.def.people ? SCENE_DEVELOPMENT_NOTICE : "", `${cur.def.id}: the scene notice`);
        assert.ok(!seen.body.startsWith("Aqui termina"), `${cur.def.id} is not lived under the region's edge notice`);
        assert.equal(seen.offered, "none", `${cur.def.id}: no action is offered while its clauses are on screen`);
      });
      const now = await story();
      assert.ok(now.lived.includes(cur.def.id), `${cur.def.id} is kept in the world record`);
      assert.equal(now.storage, "ok");
      row.clauses = cur.lines.length; row.action = cur.def.action;
      r.steps.push(row);
      if (k === 9) {
        // the Bible, in the middle of the story: the next step whole, the passage in runs, lived and ahead
        const next = steps[k + 1];
        await page.waitForFunction(() => { window.__gta.openBible(); return document.getElementById("biblia")?.open === true; }, null, LONG);
        assert.equal(await text("#bible-next-ref"), next.ref);
        assert.deepEqual(await g(() => [...document.querySelectorAll("#bible-next-text .bible-verse")].map((p) => p.lastChild.textContent)), stepVerses(next.def).map((key) => data.versiculos[key]));
        assert.equal(await text("#bible-next-do"), `No jogo${storyTask(next)}`);
        assert.deepEqual(await g(() => [...document.querySelectorAll("#bible-here .bible-run")].map((p) => p.textContent)),
          ["Marcos 1:16–22", "Marcos 1:29–42", "Marcos 2:1–5", "Marcos 2:11–17", "Marcos 3:7", "Marcos 3:9", "Marcos 3:13–14", "Marcos 3:16–19", "Marcos 4:1", "Marcos 4:35"]);
        const marks = await g(() => [...document.querySelectorAll("#bible-here .bible-verse")].map((p) => p.dataset.state));
        const told = stepVerses(next.def).length;
        r.bibleAtStep11 = { vivido: marks.filter((m) => m === "vivido").length, agora: marks.filter((m) => m === "agora").length, aSeguir: marks.filter((m) => m === "a-seguir").length };
        assert.equal(r.bibleAtStep11.agora, told);
        assert.equal(marks.length, 8 + Object.keys(data.versiculos).length, "the passage's verses: the first episode's, the teaching's, the house's and the story's");
        await page.screenshot({ path: `${OUT}/${name}-biblia-passo-11.png` });
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => document.getElementById("biblia")?.open === false, null, LONG);
      }
      if (reloadAfter.has(k)) {
        // a real reload: the browser's stored record opens the next step, from its walk, with no clause on screen
        await enter();
        await page.waitForFunction((k) => { const s = window.__gta.story().state; return s.step === k + 1 && s.phase === "walk"; }, k, LONG);
        const back = await story();
        assert.equal(back.state.line, null);
        assert.deepEqual(back.lived.filter((id) => id.startsWith("mc-")), steps.slice(0, k + 1).map((s) => s.def.id));
        assert.equal(await visible("#sub"), false, "no clause is replayed after a reload");
        await tp(here);                                              // back where the step was lived, to go on from there
        row.reloaded = true;
      }
    }

    // ---- 5. the end: closing words, then the screen goes back to the region's exploration
    const ended = await story();
    assert.equal(ended.state.phase, "end");
    assert.deepEqual(ended.lived.filter((id) => id.startsWith("mc-")), steps.map((s) => s.def.id));
    await page.waitForFunction((t) => document.getElementById("mk").textContent === "JORNADA · 20 DE 20" && document.getElementById("objt").textContent === "Explore a região"
      && document.querySelector(".journey-body").textContent === t, STORY_GUIDANCE.end, LONG);
    await page.screenshot({ path: `${OUT}/${name}-21-fim.png` });
    await page.waitForFunction(() => window.__gta.story().view === null && document.getElementById("mk").textContent === "EXPLORAÇÃO LIVRE", null, LONG);
    assert.equal(await visible("#sub"), false);
    // and after one more reload it stays lived: no step is offered again, the Bible has the passage lived to the end
    await enter();
    await page.waitForFunction(() => { const s = window.__gta.story(); return s.state.phase === "end" && s.view === null && document.getElementById("mk").textContent === "EXPLORAÇÃO LIVRE"; }, null, LONG);
    await page.waitForFunction(() => { window.__gta.openBible(); return document.getElementById("biblia")?.open === true; }, null, LONG);
    assert.equal(await text("#bible-next-h"), "Passagem vivida");
    assert.ok((await g(() => [...document.querySelectorAll("#bible-here .bible-verse")].map((p) => p.dataset.state))).every((m) => m === "vivido"), "every verse of the passage is lived");
    await page.screenshot({ path: `${OUT}/${name}-22-biblia-vivida.png` });
    await page.keyboard.press("Escape");

    // The optional fauna gives each asset 30 s of real time; a software renderer exceeds it and GLTFLoader then logs its
    // aborted textures. Only when the game itself reported that timeout are those lines set apart, and counted.
    const faunaTimedOut = warnings.some((w) => /Animal opcional indisponível/.test(w) && /timed out|TimeoutError/i.test(w));
    const real = faunaTimedOut ? errors.filter((e) => !/^THREE\.GLTFLoader: Couldn't load texture blob:/.test(e)) : errors;
    r.faunaTimedOut = faunaTimedOut; r.textureErrorsSetApart = errors.length - real.length;
    assert.deepEqual(real, [], `no page, console or HTTP errors (warnings: ${JSON.stringify(warnings.slice(0, 6))})`);
    r.stepsLived = r.steps.length; r.passed = true;
  } catch (e) {
    r.passed = false; r.error = String(e?.message ?? e).slice(0, 900); r.errors = errors.slice(0, 10);
    try {
      r.state = await g(() => ({ story: window.__gta?.story?.().state ?? null, teaching: window.__gta?.teaching?.().state.phase ?? null, roam: window.__gta?.roam?.().phase ?? null,
        mk: document.getElementById("mk")?.textContent, objective: document.getElementById("objt")?.textContent, body: document.querySelector(".journey-body")?.textContent,
        actions: window.__gta?.actions?.().shown ?? null }));
      await page.screenshot({ path: `${OUT}/${name}-FALHA.png` });
    } catch { /* the page is gone: the error above is what there is */ }
  }
  r.minutes = +((Date.now() - t0) / 60000).toFixed(1);
  await browser.close();
  console.log(`${name}: ${r.passed ? "ok" : "FALHOU"} · ${r.steps.length} de ${steps.length} missões · ${r.minutes} min`);
}

const only = process.env.STORY_RUN;
if (!only || only === "pc") await run("pc", { viewport: { width: 1280, height: 800 } });
if (!only || only === "celular") await run("celular", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
report.passed = Object.values(report.runs).length > 0 && Object.values(report.runs).every((r) => r.passed);
writeFileSync(`${OUT}/report${only ? `-${only}` : ""}.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
process.exit(report.passed ? 0 : 1);
