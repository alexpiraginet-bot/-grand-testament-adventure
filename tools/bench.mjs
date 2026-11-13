// Same-scene benchmark runner: the built game with ?bench, one run per variant, same shots, same browser and window.
//   npm run build && npx vite preview --port 4173 &
//   node tools/bench.mjs [url] [outdir] [variant ...]      variants are query strings, e.g. "fx=off" "fx=alto" "fx=master"
// Env: PLAYWRIGHT_CHANNEL=chrome (real GPU on the RTX PC), BENCH_VIEWPORT=1280x800, BENCH_DPR=1, BENCH_TOUCH=1,
//      BENCH_WARMUP=30, BENCH_FRAMES=180,
//      BENCH_UNCAPPED=1   ask Chromium not to sync frames to the display (--disable-gpu-vsync --disable-frame-rate-limit;
//                         whether a given Chrome build honours them is part of what the run records),
//      BENCH_REFRESH_HZ=144  the monitor's refresh rate, so the summary can tell a vsync ceiling from a real frame time,
//      BENCH_WARM=1       after the run, load the page again in the same browser (warm HTTP cache): 2nd-visit bytes and load,
//      BENCH_NET=4g       emulate this repository's own "4g" profile below on every load (not an operator measurement).
// Writes <outdir>/bench.json and one picture per shot and variant. Numbers are only comparable within one machine and
// one run of this script; a viewport with touch emulation is not a phone. Frame time is the interval between
// animation frames (what the player sees), capped by the display's refresh rate when the browser syncs to it.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const pwName = process.env.PLAYWRIGHT_PATH || "playwright";
const { chromium } = require(pwName);
const pwVersion = (() => { try { return require(`${pwName}/package.json`).version; } catch { return "desconhecida"; } })();
// A rough mid-signal 4G link defined here, so runs on different days use the same numbers. Bytes per second.
const NET = { "4g": { latency: 60, downloadThroughput: (9e6 / 8), uploadThroughput: (1.5e6 / 8), offline: false } };

const [url = "http://localhost:4173/", out = "shots/bench", ...args] = process.argv.slice(2);
const variants = args.length ? args : ["fx=off", "fx=alto", "fx=master"];
const [vw, vh] = (process.env.BENCH_VIEWPORT ?? "1280x800").split("x").map(Number);
const dpr = Number(process.env.BENCH_DPR ?? 1), touch = process.env.BENCH_TOUCH === "1";
const warmup = Number(process.env.BENCH_WARMUP ?? 30), frames = Number(process.env.BENCH_FRAMES ?? 180);
const uncapped = process.env.BENCH_UNCAPPED === "1", refreshHz = Number(process.env.BENCH_REFRESH_HZ) || null;
const warm = process.env.BENCH_WARM === "1", net = process.env.BENCH_NET ? NET[process.env.BENCH_NET] : null;
if (process.env.BENCH_NET && !net) throw new Error(`BENCH_NET: unknown profile ${process.env.BENCH_NET}; known: ${Object.keys(NET).join(", ")}`);
mkdirSync(out, { recursive: true });
const resourcesOf = (page) => page.evaluate(() => {
  const e = performance.getEntriesByType("resource"), n = performance.getEntriesByType("navigation")[0];
  return { count: e.length, transferBytes: e.reduce((s, x) => s + x.transferSize, 0) + (n?.transferSize ?? 0),
    decodedBytes: e.reduce((s, x) => s + x.decodedBodySize, 0) + (n?.decodedBodySize ?? 0) };
});

const report = { url, viewport: [vw, vh], dpr, touch, warmup, frames, channel: process.env.PLAYWRIGHT_CHANNEL ?? "playwright-chromium",
  uncapped, refreshHz, net: process.env.BENCH_NET ?? null, playwright: pwVersion, node: process.version, platform: process.platform,
  when: new Date().toISOString(), runs: {} };
for (const v of variants) {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    args: uncapped ? ["--disable-gpu-vsync", "--disable-frame-rate-limit"] : [] });
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  if (net) await (await ctx.newCDPSession(page)).send("Network.emulateNetworkConditions", net);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  const sep = url.includes("?") ? "&" : "?";
  await page.goto(`${url}${sep}bench=1&${v}&warmup=${warmup}&frames=${frames}`, { waitUntil: "load", timeout: 180000 });
  await page.waitForFunction(() => window.__gtaBench?.done, null, { timeout: 3_600_000, polling: 500 });
  const result = await page.evaluate(() => window.__gtaBench.results());
  result.resources = await resourcesOf(page);
  const tag = v.replace(/[^a-z0-9]+/gi, "-");
  for (const [i, s] of result.shots.entries()) {
    await page.evaluate((k) => window.__gtaBench.hold(k), i);
    // settle by frames, not seconds: temporal effects and shader compilation need frames, and a slow renderer may give
    // only one frame in a fixed time. 24 frames is ~0.4 s at 60 fps. (fx=master is blocked: docs/GRAFICO-MASTER.md.)
    await page.evaluate(() => new Promise((done) => { let n = 0; const tick = () => (++n >= 24 ? done() : requestAnimationFrame(tick)); requestAnimationFrame(tick); }));
    await page.screenshot({ path: `${out}/${String(i + 1).padStart(2, "0")}-${s.name}-${tag}.png` });
  }
  if (warm) {
    // second visit in the same browser context: the HTTP cache is warm, as for a returning player
    const again = await ctx.newPage();
    if (net) await (await ctx.newCDPSession(again)).send("Network.emulateNetworkConditions", net);
    await again.goto(`${url}${sep}bench=1&${v}&warmup=1&frames=1`, { waitUntil: "load", timeout: 180000 });
    await again.waitForFunction(() => window.__gtaBench?.done, null, { timeout: 3_600_000, polling: 500 });
    result.secondVisit = { loadMs: await again.evaluate(() => window.__gtaBench.results().loadMs), ...(await resourcesOf(again)) };
    await again.close();
  }
  result.errors = errors;
  report.runs[v] = result;
  const a = result.all, ms = (x) => (x == null ? "n/d" : x.toFixed(1));
  console.log(`${v.padEnd(12)} ${result.backend} p50 ${ms(a.p50Ms)} ms  p95 ${ms(a.p95Ms)}  p99 ${ms(a.p99Ms)}  ` +
    `gpu p95 ${ms(a.gpu?.p95Ms)}  cpu p95 ${ms(a.cpu?.p95Ms)}  calls ${Math.max(...result.shots.map((s) => s.calls))}  ` +
    `tex ${(result.textureBytes / 1e6).toFixed(0)} MB  errors ${errors.length}`);
  if (!uncapped && !refreshHz) console.log("  aviso: sem BENCH_REFRESH_HZ e sem BENCH_UNCAPPED, o tempo de quadro pode estar no teto do vsync");
  else if (refreshHz && !uncapped && Math.abs(a.p50Ms - 1000 / refreshHz) < 0.03 * (1000 / refreshHz))
    console.log(`  aviso: p50 a menos de 3% de 1000/${refreshHz} Hz: provável teto do vsync, não o custo real do quadro`);
  await browser.close();
}
const base = report.runs[variants[0]];
if (base) for (const v of variants.slice(1)) {
  const r = report.runs[v];
  report.runs[v].vsFirst = { p95: r.all.p95Ms / base.all.p95Ms, p50: r.all.p50Ms / base.all.p50Ms };
}
writeFileSync(`${out}/bench.json`, JSON.stringify(report, null, 2));
console.log(`report: ${out}/bench.json`);
