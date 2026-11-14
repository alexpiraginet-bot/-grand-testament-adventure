// Browser check of the town's layout as the running game computes it (town-life-layout.ts with the real town.boxes),
// against the layout the Node tests compute with the colliders rebuilt in test/fixtures/town-scene.ts.
// It answers two things the tests could not: are the real colliders the ones the tests assumed, and is the street
// free for the hero by the game's own movement rule (__gta.blocked, without the follower's body).
// Nothing is played: the page is loaded with ?debug=1 and read. Chromium viewport emulation, not a physical phone.
//   npx vite build && npx vite preview --port 4173 &   then   node tools/check_town_life_r15.mjs [url] [outdir]
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { MARGIN, beach, routes, scene, start, t } from "../test/fixtures/town-scene.ts";
import { townLife } from "../src/town-life-layout.ts";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const URL_ = process.argv[2] ?? "http://localhost:4173/";
const OUT = process.argv[3] ?? "shots/town-life-r15";
mkdirSync(OUT, { recursive: true });
const LONG = { timeout: 600000, polling: 200 };
const report = { url: URL_, note: "Layout read from the running game with ?debug=1; nothing is played. Chromium emulation, not a physical phone.", runs: {} };
const round = (v) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "number" ? Math.round(x * 1e6) / 1e6 : x)));

async function run(name, ctxOpts) {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const page = await (await browser.newContext(ctxOpts)).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  const r = (report.runs[name] = { viewport: ctxOpts.viewport, touch: !!ctxOpts.hasTouch });
  try {
    await page.goto(`${URL_}?debug=1`, { waitUntil: "load" });
    await page.waitForFunction(() => window.__gta?.teaching && !document.getElementById("go").disabled, null, LONG);
    const game = await page.evaluate(() => {
      const life = window.__gta.teaching().layout, w = window.__gta.worldQuality?.();
      return { life, counts: window.__gta.world, groundSegments: w?.ground?.segments ?? null, houses: w?.houses?.houses ?? null };
    });
    assert.ok(game.life, "the running game found a yard and a street");
    r.counts = game.counts; r.houses = game.houses;
    r.court = game.life.court; r.street = { points: game.life.street.points, length: game.life.street.length, clearance: game.life.street.clearance };
    r.onward = game.life.onward;
    // the same layout as Node computes with the rebuilt colliders, for either ground resolution
    const expected = [256, 192].map((segments) => { const town = scene(segments); return { segments, boxes: town.boxes.length, life: townLife({ terrain: t, start, beach, routes, plans: town.plans, boxes: town.boxes, margin: MARGIN }) }; });
    const same = expected.find((e) => { try { assert.deepEqual(round(game.life), round(e.life)); return true; } catch { return false; } });
    r.matchesNode = same ? { segments: same.segments, rebuiltColliders: same.boxes } : null;
    if (!same) r.nodeLayouts = expected.map((e) => ({ segments: e.segments, court: e.life?.court, street: e.life?.street.points, onward: e.life?.onward }));
    // the street, the yard and the door by the game's own movement rule, with its real colliders
    const probe = await page.evaluate(({ life }) => {
      const blocked = (p) => window.__gta.blocked(p.x, p.z, false);
      const out = { street: 0, streetBlocked: [], yard: 0, yardBlocked: [], doorBlocked: null };
      const pts = life.street.points;
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1));
        for (let k = 0; k <= n; k++) { const p = { x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n }; out.street++; if (blocked(p)) out.streetBlocked.push(p); }
      }
      for (let rr = 0; rr <= 7.5; rr += 0.5) for (let k = 0; k < 24; k++) {
        const p = { x: life.court.at.x + Math.sin((k * Math.PI) / 12) * rr, z: life.court.at.z + Math.cos((k * Math.PI) / 12) * rr };
        out.yard++; if (blocked(p)) out.yardBlocked.push(p);
      }
      if (life.onward) out.doorBlocked = blocked(life.onward.at);
      return out;
    }, { life: game.life });
    r.probe = { streetSamples: probe.street, streetBlocked: probe.streetBlocked.length, yardSamples: probe.yard, yardBlocked: probe.yardBlocked.length, doorBlocked: probe.doorBlocked };
    assert.equal(probe.streetBlocked.length, 0, `the hero is blocked on the street at ${JSON.stringify(probe.streetBlocked[0])}`);
    assert.equal(probe.yardBlocked.length, 0, `the hero is blocked in the yard at ${JSON.stringify(probe.yardBlocked[0])}`);
    assert.equal(probe.doorBlocked, false, "the hero is blocked at the door point");
    assert.ok(same, "the running game's layout differs from Node's with the rebuilt colliders");
    assert.deepEqual(errors, [], "no page error");
    r.passed = true;
  } catch (e) { r.passed = false; r.error = String(e?.message ?? e).slice(0, 600); r.errors = errors.slice(0, 10); }
  await browser.close();
}

await run("desktop-1280x800", { viewport: { width: 1280, height: 800 } });
await run("mobile-390x844", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
report.passed = Object.values(report.runs).every((r) => r.passed);
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
process.exit(report.passed ? 0 : 1);
