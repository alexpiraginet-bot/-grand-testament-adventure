// Browser check of the follow camera, shipped (cam=fixa) against the spring (cam=mola, src/camera.ts): the hero walks
// the first lane of the mission route while the camera is swung sideways into the houses, as a thumb dragging the view
// would, and back. Every rendered frame records the camera, so the report gives the largest jump between two frames
// and how many frames the camera spent inside a building. Chromium on this machine (a software renderer here), not a
// phone: the game clock runs at a fixed step (dtmax), so both modes see the same steps.
//   npm run build && npx vite preview --port 4173 &   then   node tools/check_camera.mjs [url] [outdir]
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const URL_ = process.argv[2] ?? "http://localhost:4173/";
const OUT = process.argv[3] ?? "shots/camera";
const DT = Number(process.env.CAM_DT ?? 0.1);      // game seconds per rendered frame
mkdirSync(OUT, { recursive: true });
const report = { url: URL_, dt: DT, viewport: [1280, 800], note: "Chromium on this machine, not a phone; fixed game step.", runs: {} };

for (const mode of ["fixa", "mola"]) {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
  await page.goto(`${URL_}?debug=1&dtmax=${DT}&cam=${mode}`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__gta && !document.getElementById("go").disabled, null, { timeout: 240000 });
  await page.click("#go");
  await page.waitForFunction(() => window.__gta.state.phase === "play", null, { timeout: 240000 });
  const g = (fn, arg) => page.evaluate(fn, arg);
  const waitGame = async (sec) => {
    const t1 = (await g(() => window.__gta.state.time)) + sec;
    await page.waitForFunction((t) => window.__gta.state.time >= t, t1, { timeout: 600000, polling: 100 });
  };
  assert.equal(await g(() => window.__gta.camera().mode), mode, "the page runs the mode asked for");
  // two metres into the first lane, facing along it; a settle so the springs start at rest
  await g(() => {
    const G = window.__gta, s = G.routes[0], len = Math.hypot(s.bx - s.ax, s.bz - s.az), f = 2 / len;
    G.teleport(s.ax + (s.bx - s.ax) * f, s.az + (s.bz - s.az) * f, Math.atan2(s.bx - s.ax, -(s.bz - s.az)));
  });
  await waitGame(1.5);
  // record every rendered frame from here on
  await g(() => {
    const rec = (window.__camrec = []);
    const tick = () => { if (!window.__camrec) return; const c = window.__gta.camera(); rec.push({ t: window.__gta.state.time, ...c }); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.keyboard.down("KeyW");
  await waitGame(1.5);
  // a thumb dragging the view: 0.1 rad per game step for 13 steps (~75 degrees), held, then back
  for (const dir of [1, -1]) {
    for (let i = 0; i < 13; i++) { await g((d) => { const c = window.__gta.cam; c.yaw += d * 0.1; c.idle = 0; }, dir); await waitGame(DT); }
    await g(() => { window.__gta.cam.idle = 0; });   // a drag just ended: no recentring yet
    await waitGame(1.0);
  }
  await page.keyboard.up("KeyW");
  const frames = await g(() => { const r = window.__camrec; window.__camrec = null; return r; });
  let maxJump = 0, at = -1;
  for (let i = 1; i < frames.length; i++) {
    const [a, b] = [frames[i - 1].pos, frames[i].pos];
    const j = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (j > maxJump) { maxJump = j; at = i; }
  }
  const inside = frames.filter((f) => f.inside).length;
  report.runs[mode] = { frames: frames.length, maxJumpM: +maxJump.toFixed(3), maxJumpAtGameS: at > 0 ? +frames[at].t.toFixed(2) : null,
    insideFrames: inside, errors, series: frames.map((f) => [+f.t.toFixed(2), ...f.pos.map((v) => +v.toFixed(3)), f.inside ? 1 : 0]) };
  await page.screenshot({ path: `${OUT}/lane-${mode}.png` });
  console.log(`${mode}: ${frames.length} quadros, maior salto ${maxJump.toFixed(2)} m entre dois quadros, ${inside} quadros dentro de casa, ${errors.length} erros`);
  await browser.close();
  assert.equal(errors.length, 0, `${mode}: console errors`);
  assert.ok(frames.length > 20, `${mode}: too few frames recorded`);
}
writeFileSync(`${OUT}/camera.json`, JSON.stringify(report, null, 1));
assert.equal(report.runs.mola.insideFrames, 0, "the spring camera never sits inside a house");
console.log(JSON.stringify({ ok: true, fixa: report.runs.fixa.maxJumpM, mola: report.runs.mola.maxJumpM,
  insideFixa: report.runs.fixa.insideFrames, insideMola: report.runs.mola.insideFrames }));
