// Same-scene benchmark runner: the built game with ?bench, one run per variant, same shots, same browser and window.
//   npm run build && npx vite preview --port 4173 &
//   node tools/bench.mjs [url] [outdir] [variant ...]      variants are query strings, e.g. "fx=off" "fx=alto" "fx=master"
// Env: PLAYWRIGHT_CHANNEL=chrome (real GPU on the RTX PC), BENCH_VIEWPORT=1280x800, BENCH_DPR=1, BENCH_TOUCH=1,
//      BENCH_WARMUP=30, BENCH_FRAMES=180.
// Writes <outdir>/bench.json and one picture per shot and variant. Numbers are only comparable within one machine and
// one run of this script; a viewport with touch emulation is not a phone. Frame time is the interval between
// animation frames (what the player sees), capped by the display's refresh rate when the browser syncs to it.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const [url = "http://localhost:4173/", out = "shots/bench", ...args] = process.argv.slice(2);
const variants = args.length ? args : ["fx=off", "fx=alto", "fx=master"];
const [vw, vh] = (process.env.BENCH_VIEWPORT ?? "1280x800").split("x").map(Number);
const dpr = Number(process.env.BENCH_DPR ?? 1), touch = process.env.BENCH_TOUCH === "1";
const warmup = Number(process.env.BENCH_WARMUP ?? 30), frames = Number(process.env.BENCH_FRAMES ?? 180);
mkdirSync(out, { recursive: true });

const report = { url, viewport: [vw, vh], dpr, touch, warmup, frames, channel: process.env.PLAYWRIGHT_CHANNEL ?? "playwright-chromium",
  when: new Date().toISOString(), runs: {} };
for (const v of variants) {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  const sep = url.includes("?") ? "&" : "?";
  await page.goto(`${url}${sep}bench=1&${v}&warmup=${warmup}&frames=${frames}`, { waitUntil: "load", timeout: 180000 });
  await page.waitForFunction(() => window.__gtaBench?.done, null, { timeout: 3_600_000, polling: 500 });
  const result = await page.evaluate(() => window.__gtaBench.results());
  result.resources = await page.evaluate(() => {
    const e = performance.getEntriesByType("resource"), n = performance.getEntriesByType("navigation")[0];
    return { count: e.length, transferBytes: e.reduce((s, x) => s + x.transferSize, 0) + (n?.transferSize ?? 0),
      decodedBytes: e.reduce((s, x) => s + x.decodedBodySize, 0) + (n?.decodedBodySize ?? 0) };
  });
  const tag = v.replace(/[^a-z0-9]+/gi, "-");
  for (const [i, s] of result.shots.entries()) {
    await page.evaluate((k) => window.__gtaBench.hold(k), i);
    const t0 = await page.evaluate(() => performance.now());           // let a few frames settle (TRAA accumulates)
    await page.waitForFunction((t) => performance.now() - t > 1500, t0, { timeout: 600000, polling: 250 });
    await page.screenshot({ path: `${out}/${String(i + 1).padStart(2, "0")}-${s.name}-${tag}.png` });
  }
  result.errors = errors;
  report.runs[v] = result;
  const a = result.all;
  console.log(`${v.padEnd(12)} ${result.backend} p50 ${a.p50Ms.toFixed(1)} ms  p95 ${a.p95Ms.toFixed(1)}  p99 ${a.p99Ms.toFixed(1)}  ` +
    `${a.fps.toFixed(1)} fps  calls ${Math.max(...result.shots.map((s) => s.calls))}  tex ${(result.textureBytes / 1e6).toFixed(0)} MB  errors ${errors.length}`);
  await browser.close();
}
const base = report.runs[variants[0]];
if (base) for (const v of variants.slice(1)) {
  const r = report.runs[v];
  report.runs[v].vsFirst = { p95: r.all.p95Ms / base.all.p95Ms, p50: r.all.p50Ms / base.all.p50Ms };
}
writeFileSync(`${out}/bench.json`, JSON.stringify(report, null, 2));
console.log(`report: ${out}/bench.json`);
