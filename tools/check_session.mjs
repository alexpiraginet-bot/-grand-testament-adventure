// Browser check of the session diary (src/session-log.ts): a normal reload ends clean and raises nothing; a renderer
// crash (CDP Page.crash) followed by a reload in the same tab is found as an unclean end. This is what a 10-minute
// phone soak relies on to count reloads. Chromium emulation on this machine, not a phone.
//   npm run build && npx vite preview --port 4173 &   then   node tools/check_session.mjs [url]
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");
const url = `${process.argv[2] ?? "http://localhost:4173/"}?debug=1&q=low`;

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
const page = await (await browser.newContext({ viewport: { width: 480, height: 320 } })).newPage();
const ready = () => page.waitForFunction(() => window.__gta?.session, null, { timeout: 240000, polling: 250 });
const session = () => page.evaluate(() => window.__gta.session());
async function cdpSessionAfterReload(cdp) {
  const until = Date.now() + 240000;
  while (Date.now() < until) {
    const r = await cdp.send("Runtime.evaluate", { returnByValue: true,
      expression: "window.__gta?.session ? JSON.stringify(window.__gta.session()) : null" }).catch(() => null);
    const v = r?.result?.value;
    if (v) { const s = JSON.parse(v); if (s.record.loads === 3) return s; }
    await new Promise((ok) => setTimeout(ok, 500));
  }
  throw new Error("the reloaded tab never exposed __gta.session()");
}

await page.goto(url, { waitUntil: "load" }); await ready();
const first = await session();
assert.equal(first.status, "ok"); assert.equal(first.previous, null, "a fresh tab has no previous load");
assert.equal(first.record.loads, 1); assert.ok(first.record.backend, "backend recorded");
console.log(`1/3 fresh tab ok (${first.record.backend})`);

await page.reload({ waitUntil: "load" }); await ready();
const clean = await session();
assert.equal(clean.record.loads, 2);
assert.equal(clean.previous?.uncleanEnd, false, "a normal reload passes pagehide and is clean");
console.log("2/3 normal reload ok: previous load ended clean");

const cdp = await page.context().newCDPSession(page);
// the renderer dies before it can answer Page.crash, so wait for the page's crash event, never for the reply
const crash = page.waitForEvent("crash", { timeout: 60000 });
cdp.send("Page.crash").catch(() => {});                       // no pagehide runs
await crash;
console.log("renderer crashed (CDP Page.crash)");
// Playwright stops driving a page once it crashed, but the tab itself (and its sessionStorage) is still there: reload
// it over CDP, as a person tapping reload would, and read the diary the same way
await cdp.send("Page.reload");
const crashed = await cdpSessionAfterReload(cdp);
assert.equal(crashed.record.loads, 3);
assert.equal(crashed.previous?.uncleanEnd, true, "the crashed load is found as an unclean end");
assert.equal(crashed.record.uncleanEnds, 1);
console.log(JSON.stringify({ ok: true, loads: crashed.record.loads, uncleanEnds: crashed.record.uncleanEnds, backend: crashed.record.backend }));
await browser.close();
