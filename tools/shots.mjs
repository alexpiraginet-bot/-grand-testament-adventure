// Screenshots, FPS and bytes of the built game, with the Chromium of the environment.
//   npm run build && npx vite preview --port 4173 &   then   node tools/shots.mjs [url] [outdir]
// Plays episode 1 through with the ?debug hooks (teleport + action), at 390x844 (phone) and 1280x800 (PC).
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");
import { mkdirSync, writeFileSync } from "node:fs";

const URL_ = process.argv[2] ?? "http://localhost:4173/";
const OUT = process.argv[3] ?? "shots";
mkdirSync(OUT, { recursive: true });
const report = {};

async function play(name, ctxOpts, extra = "") {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
  let bytes = 0, gz = 0; const files = {};
  page.on("response", async (r) => {
    try {
      const h = await r.allHeaders();
      const body = await r.body();
      bytes += body.length; files[new URL(r.url()).pathname] = body.length;
      gz += Number(h["content-length"] ?? body.length);
    } catch { /* redirects */ }
  });
  const t0 = Date.now();
  await page.goto(URL_ + "?debug=1&dtmax=0.25" + extra, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !document.getElementById("go").disabled, null, { timeout: 60000 });
  const ready = Date.now() - t0;
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/${name}-0-inicio.png` });
  await page.click("#go");
  await page.waitForFunction(() => window.__gta.state.time > 0.5, null, { timeout: 120000 });
  await page.screenshot({ path: `${OUT}/${name}-1-missao1.png` });

  const g = (fn, arg) => page.evaluate(fn, arg);
  // wait in game seconds (the software renderer here runs a few frames per second; game time runs slow below 20 fps)
  const waitGame = async (sec) => {
    const t1 = (await g(() => window.__gta.state.time)) + sec;
    await page.waitForFunction((t) => window.__gta.state.time >= t, t1, { timeout: 240000, polling: 200 });
  };
  // walk a little with the keyboard (PC) to see the animation and the camera
  if (!ctxOpts.hasTouch) { await page.keyboard.down("KeyW"); await waitGame(2.5); await page.keyboard.up("KeyW"); }
  const P = await g(() => window.__gta.meta.points);
  const head = (a, b) => Math.atan2(b[0] - a[0], -(b[1] - a[1]));
  // mission 1: near the beach
  await g(([x, z, h]) => window.__gta.teleport(x, z, h), [P.beach[0] + (P.start[0] - P.beach[0]) * 0.03, P.beach[1] + (P.start[1] - P.beach[1]) * 0.03, head(P.start, P.beach)]);
  await waitGame(1.5);
  await page.screenshot({ path: `${OUT}/${name}-2-praia.png` });
  // mission 2: next to Simão and André
  const nearS = [P.simao[0] + (P.beach[0] - P.simao[0]) * 0.015, P.simao[1] + (P.beach[1] - P.simao[1]) * 0.015];
  await g(([x, z, h]) => window.__gta.teleport(x, z, h), [...nearS, head(P.beach, P.simao)]);
  await waitGame(1.6);
  await page.screenshot({ path: `${OUT}/${name}-3-chamar.png` });
  await g(() => window.__gta.act());
  await page.waitForFunction(() => window.__gta.state.phase === "line", null, { timeout: 120000 });
  await waitGame(1.0);
  await page.screenshot({ path: `${OUT}/${name}-4-fala.png` });
  await page.waitForFunction(() => window.__gta.state.mission === 2, null, { timeout: 240000 });
  // mission 3: at the shore by the boat
  const nearB = [P.barco_margem[0] + (P.simao[0] - P.barco_margem[0]) * 0.03, P.barco_margem[1] + (P.simao[1] - P.barco_margem[1]) * 0.03];
  await g(([x, z, h]) => window.__gta.teleport(x, z, h), [...nearB, head(P.simao, P.barco)]);
  await waitGame(1.6);
  await page.screenshot({ path: `${OUT}/${name}-5-barco.png` });
  await g(() => window.__gta.act());
  await page.waitForFunction(() => window.__gta.state.phase === "line", null, { timeout: 120000 });
  await waitGame(2.0);
  await page.screenshot({ path: `${OUT}/${name}-6-fala2.png` });
  await page.waitForFunction(() => window.__gta.state.phase === "done", null, { timeout: 240000 });
  await page.waitForSelector("#end:not([hidden])", { timeout: 60000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}-7-fim.png` });
  // FPS: the renderer's own count, the last seconds of play
  const fps = await g(() => window.__gta ? window.__gta.fpsLog.slice(-8) : []);
  const st = await page.evaluate(() => ({ backend: window.__gta?.backend, followers: window.__gta?.followers(), info: window.__gta?.info() }));
  report[name] = { readyMs: ready, bytes, transfer: gz, files, fps, ...st, errors: errors.slice(0, 12) };
  await browser.close();
}

await play("pc", { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await play("celular", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
