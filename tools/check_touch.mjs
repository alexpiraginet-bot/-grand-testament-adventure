// Browser check of the phone controls: the joystick always in view, the hand action button, and the hero's real
// AnimationMixer while the thumb walks him. Viewport and touch emulation in desktop Chromium, not a physical phone.
//   npm run build && npx vite preview --port 4173 &   then   node tools/check_touch.mjs [url] [outdir]
// Uses ?debug&dtmax so it also passes on a software renderer (about 1 fps): waits are in game seconds.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const URL_ = process.argv[2] ?? "http://localhost:4173/";
const OUT = process.argv[3] ?? "shots/touch";
mkdirSync(OUT, { recursive: true });
const report = { url: URL_, note: "Chromium viewport/touch emulation; not a physical phone. FPS is this machine's renderer.", runs: {} };

const center = (r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const overlap = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (r, vw, vh) => r.x >= 0 && r.y >= 0 && r.x + r.width <= vw && r.y + r.height <= vh;

async function run(name, ctxOpts) {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [], warnings = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); else if (m.type() === "warning") warnings.push(m.text().slice(0, 200)); });
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  const t0 = Date.now();
  await page.goto(`${URL_}?debug=1&dtmax=0.5`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__gta && !document.getElementById("go").disabled, null, { timeout: 240000 });
  const readyMs = Date.now() - t0;
  const g = (fn, arg) => page.evaluate(fn, arg);
  const rect = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; }, sel);
  const waitGame = async (sec) => {
    const t1 = (await g(() => window.__gta.state.time)) + sec;
    await page.waitForFunction((t) => window.__gta.state.time >= t, t1, { timeout: 300000, polling: 100 });
  };
  const touch = !!ctxOpts.hasTouch, { width: vw, height: vh } = ctxOpts.viewport;
  const cdp = touch ? await ctx.newCDPSession(page) : null;
  const finger = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  const r = { readyMs };

  // slow software renderers block input for long frames: give the first tap/click time
  if (touch) await page.tap("#go", { timeout: 240000 }); else await page.click("#go", { timeout: 240000 });
  await page.waitForFunction(() => window.__gta.state.time > 0.5, null, { timeout: 240000 });
  const joyStyle = await g(() => { const j = document.getElementById("joy"); return { cls: j.className, opacity: Number(getComputedStyle(j).opacity), hidden: j.getAttribute("aria-hidden") }; });
  r.joystick = joyStyle;
  const actor0 = await g(() => window.__gta.actor());
  assert.equal(actor0?.bones, 65, "hero keeps its native 65-bone skeleton"); assert.equal(actor0.skinnedMeshes, 1);
  assert.equal(await g(() => window.__gta.assets.length), 14, "the 14 reviewed runtime assets loaded");

  if (!touch) {
    assert.equal(joyStyle.opacity, 0, "no joystick on a mouse-and-keyboard screen");
    assert.ok(!joyStyle.cls.includes("rest"));
  } else {
    assert.ok(joyStyle.cls.includes("rest") && joyStyle.opacity > 0.5, "joystick in view before any touch");
    assert.equal(joyStyle.hidden, "true", "the joystick is decoration for screen readers");
    const joy = await rect("#joy"), links = await page.$$eval(".hud-links button", (bs) => bs.map((b) => { const x = b.getBoundingClientRect(); return { x: x.x, y: x.y, width: x.width, height: x.height }; }));
    const others = { links0: links[0], links1: links[1], radar: await rect(".radarbox"), mission: await rect(".mission") };
    r.layout = { joy, ...others };
    assert.ok(inside(joy, vw, vh), "joystick fully on screen");
    for (const [k, v] of Object.entries(others)) assert.ok(!overlap(joy, v), `joystick clear of ${k}`);
    await page.screenshot({ path: `${OUT}/${name}-1-repouso.png` });

    // a thumb near the resting stick: the base stays put, the hero walks, the real mixer turns the bones
    const rest = center(joy);
    // straight up from near the centre: a sideways component lets the path drift into the lane's jars and walls,
    // and a collision rightly stops the walk cycle (that is the game, not the stick)
    await finger("touchStart", rest.x, rest.y - 8);
    assert.equal(await g(() => document.getElementById("joy").style.transform), "translate(0px, 0px)", "base stays at rest");
    const p0 = await g(() => ({ ...window.__gta.player.pos }));
    await finger("touchMove", rest.x, rest.y - 44);
    await waitGame(2.0);
    const walking = await g(() => ({ pos: { ...window.__gta.player.pos }, speed: window.__gta.player.speed, actor: window.__gta.actor(), joy: document.getElementById("joy").className, knob: document.getElementById("knob").style.transform }));
    await page.screenshot({ path: `${OUT}/${name}-2-andando.png` });
    r.fixedWalk = { metres: Math.hypot(walking.pos.x - p0.x, walking.pos.z - p0.z), walkWeight: walking.actor.walkWeight, knob: walking.knob };
    assert.ok(r.fixedWalk.metres > 1, "thumb on the fixed stick walks the hero");
    assert.ok(walking.joy.includes("on") && walking.knob.startsWith("translate("));
    assert.ok(walking.actor.walkWeight > 0.9, `walk clip blended in: ${JSON.stringify({ w: walking.actor.walkWeight, speed: walking.speed, metres: r.fixedWalk.metres })}`); assert.notDeepEqual(walking.actor.skeleton, actor0.skeleton, "bones moved");
    await finger("touchEnd");
    await waitGame(1.5);
    const stopped = await g(() => ({ move: window.__gta.player.speed, w: window.__gta.actor().walkWeight, joy: document.getElementById("joy").className, t: document.getElementById("joy").style.transform }));
    r.release = stopped;
    assert.ok(stopped.w < 0.01 && stopped.move === 0 && !stopped.joy.includes("on") && stopped.t === "", "release stops him and settles the stick");

    // a thumb far from the stick, still on the walking side: the base comes under it, then goes home
    const far = { x: Math.round(vw * 0.2), y: Math.round(vh * 0.42) };
    await finger("touchStart", far.x, far.y);
    const moved = center(await rect("#joy"));
    assert.ok(Math.hypot(moved.x - far.x, moved.y - far.y) < 1.5, "base re-centred under a distant thumb");
    const p1 = await g(() => ({ ...window.__gta.player.pos }));
    await finger("touchMove", far.x, far.y - 40);
    await waitGame(1.0);
    const p2 = await g(() => ({ ...window.__gta.player.pos }));
    r.recentredWalk = { metres: Math.hypot(p2.x - p1.x, p2.z - p1.z) };
    assert.ok(r.recentredWalk.metres > 0.5, "re-centred stick walks too");
    await finger("touchEnd");
    const home = center(await rect("#joy"));
    assert.ok(Math.hypot(home.x - rest.x, home.y - rest.y) < 1.5, "base back at rest after release");

    // the right side looks around and leaves the stick alone
    const yaw0 = await g(() => window.__gta.cam.yaw);
    await finger("touchStart", vw * 0.75, vh * 0.5); await finger("touchMove", vw * 0.75 - 60, vh * 0.5); await finger("touchEnd");
    assert.notEqual(await g(() => window.__gta.cam.yaw), yaw0, "right-side drag turns the camera");
    assert.ok(!(await g(() => document.getElementById("joy").className)).includes("on"));
  }

  // the action: beside Simão and André the hand button (phone) or the E prompt (PC) appears and plays the line
  const P = await g(() => window.__gta.meta.points);
  const head = (a, b) => Math.atan2(b[0] - a[0], -(b[1] - a[1]));
  await g(([x, z, h]) => window.__gta.teleport(x, z, h), [P.beach[0], P.beach[1], head(P.start, P.beach)]);
  await page.waitForFunction(() => window.__gta.state.mission === 1, null, { timeout: 240000, polling: 100 });
  const nearS = [P.simao[0] + (P.beach[0] - P.simao[0]) * 0.015, P.simao[1] + (P.beach[1] - P.simao[1]) * 0.015];
  await g(([x, z, h]) => window.__gta.teleport(x, z, h), [...nearS, head(P.beach, P.simao)]);
  await page.waitForFunction(() => window.__gta.state.promptVisible, null, { timeout: 240000, polling: 100 });
  await waitGame(0.3);
  const label = await g(() => document.getElementById("promptt").textContent);
  if (touch) {
    const act = await g(() => { const a = document.getElementById("act"), h = a.querySelector("svg.hand"), b = h?.getBoundingClientRect();
      return { hidden: a.hidden, label: document.getElementById("actt").textContent, hand: !!h && b.width > 30 && b.height > 30, handHidden: h?.getAttribute("aria-hidden"),
        prompt: document.getElementById("prompt").hidden, emoji: /\p{Extended_Pictographic}/u.test(a.textContent) }; });
    r.action = act;
    assert.ok(!act.hidden && act.hand && act.handHidden === "true" && act.prompt && !act.emoji, "hand button shown, drawn in SVG, no emoji, no keyboard prompt");
    assert.equal(act.label, label);
    assert.equal(await page.getByRole("button", { name: label, exact: true }).count(), 1, "button's accessible name is the action word");
    const actR = await rect("#act");
    assert.ok(inside(actR, vw, vh) && !overlap(actR, await rect("#joy")), "action button on screen and clear of the stick");
    for (const b of await page.$$(".hud-links button")) assert.ok(!overlap(actR, await b.boundingBox()), "action button clear of the links");
    for (const s of [".radarbox", ".mission"]) assert.ok(!overlap(actR, await rect(s)), `action button clear of ${s}`);
    r.action.rect = actR;
    await page.screenshot({ path: `${OUT}/${name}-3-mao.png` });
    const a = center(actR);
    await finger("touchStart", a.x, a.y); await finger("touchEnd");                 // a real tap, not the debug hook
  } else {
    assert.equal(await g(() => document.getElementById("act").hidden), true, "no round button on PC");
    assert.equal(await g(() => document.getElementById("prompt").hidden), false, "E prompt on PC");
    await page.screenshot({ path: `${OUT}/${name}-3-prompt.png` });
    await page.keyboard.press("KeyE");
  }
  // Hold the story's clock (debug freeze) in the same page call that sees the line start: on a slow renderer every
  // page call can cost a frame, and the line lasts only a few. Camera, animation and controls keep running.
  await page.waitForFunction(() => { const G = window.__gta; if (G.state.phase !== "line") return false; G.freeze(true); return true; },
    null, { timeout: 240000, polling: 50 });
  if (touch) {
    const sub = await rect("#sub p"), joy = await rect("#joy");
    r.subtitle = { sub, joy };
    assert.ok(!overlap(sub, joy), "the line is not drawn under the stick");
  }
  // the two-shot (cinematic.ts): in while the line is read, the play panels step aside, the subtitle stays.
  // CSS transitions are off in this check so opacity is the end state, not a timing sample.
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; }" });
  const cine = await (await page.waitForFunction(() => {
    const G = window.__gta, c = G.cine();
    if (c.k <= 0.95 && !c.left) return false;
    return { ...c, phase: G.state.phase, sub: !document.getElementById("sub").hidden,
      missionOpacity: Number(getComputedStyle(document.querySelector(".mission")).opacity),
      links: getComputedStyle(document.querySelector(".hud-links")).visibility };
  }, null, { timeout: 240000, polling: 100 })).jsonValue();
  r.cinematic = { k: cine.k, why: cine.why, shot: cine.shot, camera: cine.camera };
  assert.equal(cine.phase, "line", "the story is held on the line");
  assert.ok(cine.shot && cine.on && cine.sub && !cine.left, `two-shot in, cinema class on, subtitle shown: ${JSON.stringify({ k: cine.k, why: cine.why, on: cine.on })}`);
  assert.ok(Math.hypot(cine.camera[0] - cine.shot.eye.x, cine.camera[2] - cine.shot.eye.z) < 0.05, "camera at the shot's eye");
  assert.equal(cine.links, "hidden", "community links out of the way (and out of the tab order)");
  assert.ok(cine.missionOpacity < 0.05, "mission panel faded");
  await page.screenshot({ path: `${OUT}/${name}-4-fala.png` });
  if (!touch) {
    // walking out of the shot hands the camera back at once, without waiting for the line to end
    await page.keyboard.down("KeyW");
    const out = await (await page.waitForFunction(() => { const c = window.__gta.cine(); return c.left && c.k < 0.5 && !c.on && { left: c.left, why: c.why, k: c.k, phase: window.__gta.state.phase }; },
      null, { timeout: 240000, polling: 100 })).jsonValue();
    await page.keyboard.up("KeyW");
    r.cinematicLeave = out;
    assert.ok(out.phase === "line" && out.why === "moved", `walking during the line leaves the shot: ${JSON.stringify(out)}`);
  }
  await g(() => window.__gta.freeze(false));
  await page.waitForFunction(() => window.__gta.state.phase !== "line", null, { timeout: 240000, polling: 100 });
  await waitGame(1.0);
  const after = await g(() => window.__gta.cine());
  assert.ok(after.k < 0.05 && !after.on && after.shot === null, "after the line the game camera is back and the shot cleared");

  r.fps = await g(() => window.__gta.fpsLog.slice(-5).map((f) => Math.round(f * 10) / 10));
  r.backend = await g(() => window.__gta.backend);
  r.resources = await g(() => { const e = performance.getEntriesByType("resource");
    return { count: e.length, transfer: e.reduce((s, x) => s + x.transferSize, 0), decoded: e.reduce((s, x) => s + x.decodedBodySize, 0) }; });
  r.errors = errors; r.warnings = [...new Set(warnings)].slice(0, 8);
  assert.deepEqual(errors, [], "no page, console or HTTP errors");
  report.runs[name] = r;
  await browser.close();
}

const only = process.env.ONLY?.split(",");
const runs = [
  ["celular", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true }],
  ["celular-deitado", { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true }],
  ["pc", { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }],
];
for (const [name, opts] of runs) if (!only || only.includes(name)) { await run(name, opts); console.log(`${name}: ok`); }
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
