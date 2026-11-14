// Browser check of what comes after the episode: "Continuar explorando", the way back to the village, the clause of
// Mark 1:21, the region's places and the notice at its edge. The three missions are reached with the ?debug hooks
// (teleport + action), as tools/shots.mjs does; this is not a walked playthrough. Chromium viewport/touch emulation,
// not a physical phone. Waits are on game state, so it also passes on a software renderer (under 1 fps).
//   npm run build && npx vite preview --port 4173 &   then   node tools/check_roam.mjs [url] [outdir]
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const URL_ = process.argv[2] ?? "http://localhost:4173/";
const OUT = process.argv[3] ?? "shots/roam";
mkdirSync(OUT, { recursive: true });
const report = { url: URL_, note: "Missions reached by debug teleport and action; Chromium emulation, not a physical phone.", runs: {} };
const LONG = { timeout: 600000, polling: 150 };

async function run(name, ctxOpts) {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [], warnings = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); else if (m.type() === "warning") warnings.push(m.text().slice(0, 300)); });
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  const touch = !!ctxOpts.hasTouch;
  const g = (fn, arg) => page.evaluate(fn, arg);
  const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent ?? null, sel);
  const shown = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && getComputedStyle(e).display !== "none"; }, sel);
  const press = async (sel) => { if (touch) await page.tap(sel, { timeout: 300000 }); else await page.click(sel, { timeout: 300000 }); };
  const load = async (dtmax = 0.5) => {
    await page.goto(`${URL_}?debug=1&dtmax=${dtmax}`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__gta?.roam && !document.getElementById("go").disabled, null, LONG);
  };
  const r = {};
  // First load, on the game's own clock (at most 0.05 s of game time per frame): the notice of the first place. With
  // the 0.5 s per frame the rest of this check uses, the notice's 6 s are over in twelve frames, fewer than this
  // renderer needs between seeing it and taking its picture (two runs passed on state alone and showed no notice).
  await load(0.05);
  const places = await g(() => window.__gta.roam().places);
  r.places = places.map((p) => `${p.id}: ${p.nome} (${p.origem}${p.ref ? `, ${p.ref}` : ""})`);
  assert.equal(places.length, 5, "five places in this region");
  assert.deepEqual(await g(() => window.__gta.roam().found), [], "a fresh browser has found nothing");
  await press("#go");
  await page.waitForFunction(() => window.__gta.state.phase === "play", null, LONG);

  // the walk begins inside the village: it is found at once, and the HUD says what kind of place it is. Read in the
  // same page task that sees the place found: the notice is there from that frame, faint, and then comes in.
  const first = await (await page.waitForFunction(() => {
    const e = document.getElementById("placefound"), t = (id) => document.getElementById(id).textContent;
    return window.__gta.roam().found.includes("Capernaum")
      && { name: t("placename"), count: t("placecount"), note: t("placenote"), shown: !e.hidden && getComputedStyle(e).display !== "none" && Number(getComputedStyle(e).opacity) >= 0.2 };
  }, null, LONG)).jsonValue();
  assert.deepEqual(first, { name: "Cafarnaum", count: "Lugar encontrado · 1 de 5", note: "Lugar com fonte", shown: true }, "the found place is announced");
  // fully in and inside the screen, with nothing above it in the tree hiding it. (The HUD takes no pointer events, so
  // "what is at its centre" always answers the canvas: that test said nothing and was dropped. The picture is looked at.)
  const opaque = () => { const e = document.getElementById("placefound"), b = e.getBoundingClientRect();
    let visible = true;
    for (let n = e; n && n !== document.documentElement; n = n.parentElement) { const c = getComputedStyle(n);
      visible &&= c.display !== "none" && c.visibility === "visible" && c.opacity === "1"; }
    return !e.hidden && getComputedStyle(e).opacity === "1"
      && { inView: b.width > 0 && b.height > 0 && b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight, visible }; };
  const seen = await (await page.waitForFunction(opaque, null, LONG)).jsonValue();
  assert.deepEqual(seen, { inView: true, visible: true }, "the notice is drawn opaque inside the screen");
  await page.screenshot({ path: `${OUT}/${name}-0-lugar.png` });
  assert.deepEqual(await g(opaque), { inView: true, visible: true }, "the notice was still fully there when the picture was taken");
  // Second load, on the fast clock, for the rest: the walk resumes where it was and the place stays found
  await load();
  assert.deepEqual(await g(() => window.__gta.roam().found), ["Capernaum"], "the place found is remembered across a reload");
  await press("#go");
  await page.waitForFunction(() => window.__gta.state.phase === "play", null, LONG);
  assert.equal(await g(() => window.__gta.roam().phase), "off", "no exploring mode while the episode is played");

  // the three missions, by the debug hooks
  const P = await g(() => window.__gta.meta.points);
  const head = (a, b) => Math.atan2(b[0] - a[0], -(b[1] - a[1]));
  const tp = (x, z, h) => g(([x, z, h]) => window.__gta.teleport(x, z, h), [x, z, h]);
  await tp(P.beach[0], P.beach[1], head(P.start, P.beach));
  await page.waitForFunction(() => window.__gta.state.mission === 1, null, LONG);
  await tp(P.simao[0] + (P.beach[0] - P.simao[0]) * 0.015, P.simao[1] + (P.beach[1] - P.simao[1]) * 0.015, head(P.beach, P.simao));
  await page.waitForFunction(() => window.__gta.state.promptVisible, null, LONG);
  await g(() => window.__gta.act());
  await page.waitForFunction(() => window.__gta.state.mission === 2, null, LONG);
  await tp(P.barco_margem[0] + (P.simao[0] - P.barco_margem[0]) * 0.03, P.barco_margem[1] + (P.simao[1] - P.barco_margem[1]) * 0.03, head(P.simao, P.barco));
  await page.waitForFunction(() => window.__gta.state.promptVisible, null, LONG);
  await g(() => window.__gta.act());
  await page.waitForFunction(() => window.__gta.state.phase === "done", null, LONG);
  assert.deepEqual(await g(() => window.__gta.roam().found), ["Capernaum", "margem", "redes", "barco"], "the passage's places were found on the way");
  assert.equal(await text("#placecount"), "Lugar encontrado · 4 de 5");
  assert.equal(await text("#placenote"), "Marcos 1:20 · Posição escolhida pelo jogo");

  // the end card offers to keep exploring; until then nothing roams
  await page.waitForFunction(() => !document.getElementById("end").hidden, null, LONG);
  assert.equal(await text("#roam"), "Continuar explorando");
  assert.equal(await text("#again"), "Jogar de novo");
  assert.equal(await g(() => window.__gta.roam().phase), "off");
  await page.screenshot({ path: `${OUT}/${name}-1-fim.png` });
  await press("#roam");
  await page.waitForFunction(() => window.__gta.roam().phase === "return" && document.getElementById("end").hidden, null, LONG);
  // The way back opens with its narrative, shown for 7 s of game time, and its line is the next verse, still unread,
  // so it asks for the Bible (tools/check_bible.mjs checks the panel). No one is drawn beside him, and the HUD says the
  // scene is in development (R9). All read in one page task: separate reads outlast the narrative on a software
  // renderer (they did on b1959be, where the label was read after the Bible had been opened and closed).
  const NARRATIVE = "Os que foram chamados agora caminham com ele. A trilha sobe de volta à vila.";
  const opening = await (await page.waitForFunction(() => {
    const t = (s) => document.querySelector(s)?.textContent ?? null, scene = document.getElementById("scene-development");
    return t("#mk") === "EPÍLOGO" && { objective: t("#objt"), dist: t("#dist"), label: t(".journey-label"), body: t(".journey-body"),
      scene: scene && !scene.hidden ? scene.textContent : null };
  }, null, LONG)).jsonValue();
  assert.deepEqual(opening, { objective: "Abra a Bíblia", dist: "Marcos 1:21", label: "Narrativa do jogo", body: NARRATIVE,
    scene: "Cena em desenvolvimento · personagens em preparação." });
  await g(() => window.__gta.openBible());
  await page.waitForFunction(() => document.getElementById("biblia")?.open === true, null, LONG);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.getElementById("biblia")?.open === false && document.getElementById("objt").textContent === "Volte a Cafarnaum", null, LONG);
  assert.equal(await text("#objt"), "Volte a Cafarnaum");
  assert.match(await text("#dist"), /^\d+ m$/);
  // by now the narrative may have given way to the guidance; either is right, each under its own label
  const journey = await g(() => ({ label: document.querySelector(".journey-label").textContent, body: document.querySelector(".journey-body").textContent }));
  assert.ok((journey.label === "Narrativa do jogo" && journey.body === NARRATIVE) || (journey.label === "Orientação" && journey.body === "Suba pela trilha até as casas."),
    `after the Bible the journey line is the narrative or the guidance: ${JSON.stringify(journey)}`);
  assert.equal(await shown("#sub"), false, "no line on screen yet");
  assert.deepEqual(await g(() => window.__gta.narrativeFollowers().length), 4, "the four follow him in the story");
  // Of the four, only Simão has an approved actor (R12), and he is optional: he is on the radar when his model has
  // loaded, and nobody else ever is. On a slow renderer he may still be loading here.
  const drawn = await g(() => ({ followers: window.__gta.followers().length, npc: window.__gta.npc().status, radar: window.__gta.characters().radarFollowers.map((f) => f.id) }));
  assert.ok(drawn.followers <= 1 && drawn.radar.every((id) => id === "simao"), `only Simão may be drawn following: ${JSON.stringify(drawn)}`);
  assert.equal(drawn.followers, drawn.npc === "ready" ? 1 : 0, `Simão follows exactly when his actor is ready: ${JSON.stringify(drawn)}`);
  r.simao = drawn.npc;
  await page.screenshot({ path: `${OUT}/${name}-2-epilogo.png` });

  // he can walk again (the episode's end had stopped him): a few game seconds forward change his position
  if (!touch) {
    const before = await g(() => ({ ...window.__gta.player.pos }));
    const t1 = (await g(() => window.__gta.state.time)) + 1.5;
    await page.keyboard.down("KeyW");
    await page.waitForFunction((t) => window.__gta.state.time >= t, t1, LONG);
    await page.keyboard.up("KeyW");
    const after = await g(() => ({ ...window.__gta.player.pos }));
    r.walkedM = +Math.hypot(after.x - before.x, after.z - before.z).toFixed(2);
    assert.ok(r.walkedM > 0.5, `walking works while exploring (${r.walkedM} m)`);
  }

  // back in the village: the clause of Mark 1:21, literal, with its reference
  await tp(P.start[0], P.start[1] + 10, head(P.beach, P.start));
  await page.waitForFunction(() => window.__gta.roam().phase === "line", null, LONG);
  await page.waitForFunction(() => !document.getElementById("sub").hidden, null, LONG);
  assert.equal(await text("#subt"), "“Eles entraram em Cafarnaum”");
  assert.equal(await text("#subr"), "BÍBLIA LIVRE · MARCOS 1:21");
  assert.equal(await shown("#journey"), false, "the game's own words yield to Scripture");
  r.cine = await g(() => { const c = window.__gta.cine(); return { why: c.why, shot: !!c.shot }; });
  await page.screenshot({ path: `${OUT}/${name}-3-fala.png` });
  await page.waitForFunction(() => window.__gta.roam().phase === "free", null, LONG);
  await page.waitForFunction(() => document.getElementById("mk").textContent === "EXPLORAÇÃO LIVRE" && document.getElementById("sub").hidden, null, LONG);
  // free: one place is still to be found, so the panel and the radar point to it
  assert.equal(await text("#objt"), "Encontre os lugares da região");
  assert.match(await text("#dist"), /^\d+ m$/);
  await page.waitForFunction(() => document.querySelector(".journey-label").textContent === "Orientação", null, LONG);
  assert.equal(await text(".journey-body"), "Lugares encontrados: 4 de 5. O mais próximo por encontrar fica a noroeste.");
  await page.screenshot({ path: `${OUT}/${name}-4-livre.png` });

  // the lookout: a place only the relief gives, named by the game and labelled as such
  const top = places.find((p) => p.id === "mirante");
  await tp(top.x, top.z, head([top.x, top.z], P.beach));
  await page.waitForFunction(() => window.__gta.roam().found.length === 5, null, LONG);
  assert.equal(await text("#placename"), "Mirante do mar da Galileia");
  assert.equal(await text("#placecount"), "Lugar encontrado · 5 de 5");
  assert.equal(await text("#placenote"), "Nome do jogo sobre o relevo real");
  await page.waitForFunction(() => document.querySelector(".journey-body").textContent === "Todos os 5 lugares desta região foram encontrados.", null, LONG);
  assert.equal(await text(".journey-label"), "Orientação");
  assert.equal(await text("#objt"), "Explore a região");
  assert.equal(await text("#dist"), "");
  await page.screenshot({ path: `${OUT}/${name}-5-mirante.png` });

  // the edge of the region: said before the invisible limit stops him
  const edgeAt = await g(() => { const G = window.__gta; return G.meta.size / 2 - 60 - 20; });
  await tp(0, -edgeAt, 0);
  await page.waitForFunction(() => document.querySelector(".journey-body").textContent.startsWith("Aqui termina"), null, LONG);
  assert.equal(await text(".journey-body"), "Aqui termina a região desta versão. Volte em direção a Cafarnaum.");
  assert.equal(await text(".journey-label"), "Orientação");
  r.edgeM = +(await g(() => window.__gta.roam().edge)).toFixed(1);
  assert.ok(r.edgeM > 0 && r.edgeM <= 40, `inside the region, within the notice distance (${r.edgeM} m)`);
  await page.screenshot({ path: `${OUT}/${name}-6-limite.png` });

  // the map opens while exploring too (it used to need a mission in play)
  await press("#mapbtn");
  await page.waitForFunction(() => document.getElementById("worldmap")?.open === true, null, LONG);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.getElementById("worldmap")?.open === false, null, LONG);

  // what was found is kept in this browser, and a finished episode can be skipped to walk the region with the four
  await load();
  assert.equal(await g(() => window.__gta.roam().found.length), 5, "found places survive a reload");
  assert.equal(await text("#go"), "Jogar de novo");
  assert.equal(await text("#novo"), "Explorar a região");
  await press("#novo");
  await page.waitForFunction(() => window.__gta.roam().phase === "free" && window.__gta.state.phase === "done", null, LONG);
  await page.waitForFunction(() => document.getElementById("mk").textContent === "EXPLORAÇÃO LIVRE", null, LONG);
  assert.equal(await g(() => window.__gta.narrativeFollowers().length), 4, "the four are with him in the story");
  assert.equal(await g(() => document.querySelectorAll("#counter i.on").length), 4, "the counter is drawn full without a mission having run");
  assert.equal(await text("#objt"), "Explore a região");
  assert.equal(await shown("#sub"), false, "no line is replayed for a player who only came to explore");
  const save = await g(() => { const s = window.__gta.save(); return { current: s.current, completions: Object.values(s.episodes)[0]?.completions }; });
  assert.deepEqual(save, { current: null, completions: 1 }, "exploring leaves the saved record as it was");
  await page.screenshot({ path: `${OUT}/${name}-7-explorar.png` });

  // The optional fauna (fauna-renderer.ts) gives each asset 30 s of real time. On a software renderer that expires,
  // its texture loads are aborted and GLTFLoader logs "Couldn't load texture blob:". Only when the game itself
  // reported that timeout are those lines set apart, and counted in the report; any other error fails the check.
  const faunaTimedOut = warnings.some((w) => /Animal opcional indisponível/.test(w) && /timed out|TimeoutError/i.test(w));
  const real = faunaTimedOut ? errors.filter((e) => !/^THREE\.GLTFLoader: Couldn't load texture blob:/.test(e)) : errors;
  assert.deepEqual(real, [], `no page, console or HTTP errors (warnings: ${JSON.stringify(warnings.slice(0, 6))})`);
  r.errors = real.length; r.faunaTimedOut = faunaTimedOut; r.faunaTextureErrorsSetApart = errors.length - real.length;
  report.runs[name] = r;
  console.log(`${name}: ok ${JSON.stringify(r.cine)}${r.walkedM !== undefined ? `, andou ${r.walkedM} m` : ""}, limite a ${r.edgeM} m` +
    (faunaTimedOut ? `; fauna opcional expirou neste renderizador (30 s reais): ${r.faunaTextureErrorsSetApart} erros de textura dela postos à parte` : ""));
  await browser.close();
}

await run("celular", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
await run("pc", { viewport: { width: 1280, height: 800 } });
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ok: true, runs: Object.keys(report.runs) }));
