// Browser check of the visit counting (src/analytics.ts, Vercel Web Analytics) on two builds of the same tree:
//   off: a plain `vite build`, as every local build and test uses. Nothing is loaded from /_vercel/insights.
//   on:  `VERCEL_ENV=production vite build`, what Vercel builds for production. The counting script is requested and
//        the page view it posts carries the page's address WITHOUT the query string or the hash.
// Nothing reaches Vercel from here: /_vercel/insights/* is answered by this script. VA_SCRIPT is a copy of
// /_vercel/insights/script.js as the production site serves it (curl it apart; it is Vercel's code, not ours).
// That script stays silent when it sees an automated browser (navigator.webdriver, "Headless" in the user agent), so
// the "on" part runs once as an ordinary browser would present itself and once as automation, to record both.
// The game's heavy files are refused: this check is about the first requests of the page, not about the game.
//   node tools/check_analytics.mjs <offUrl> <onUrl> [outdir]
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const pw = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const [OFF, ON, OUT = "shots/analytics"] = process.argv.slice(2);
assert.ok(OFF && ON, "usage: node tools/check_analytics.mjs <offUrl> <onUrl> [outdir]");
assert.ok(process.env.VA_SCRIPT, "VA_SCRIPT must point to a copy of the production /_vercel/insights/script.js");
const vaScript = readFileSync(process.env.VA_SCRIPT, "utf8");
mkdirSync(OUT, { recursive: true });
const report = { off: OFF, on: ON, vaScriptSha256: createHash("sha256").update(vaScript).digest("hex"), vaScriptBytes: Buffer.byteLength(vaScript) };
const QUERY = "?q=low&nuvem=segredo-de-teste#fps";
const HEAVY = /\/(models|textures|world|audio|images|fauna)\//;

async function open(url, { ordinary }) {
  const browser = await pw.chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const context = await browser.newContext({ viewport: { width: 800, height: 600 }, ...(ordinary ? { userAgent: pw.devices["Desktop Chrome"].userAgent } : {}) });
  if (ordinary) await context.addInitScript(() => Object.defineProperty(Navigator.prototype, "webdriver", { get: () => false }));
  const page = await context.newPage();
  const insights = [], views = [];
  await page.route(HEAVY, (route) => route.abort());
  await page.route("**/_vercel/insights/**", (route) => {
    const req = route.request(), path = new URL(req.url()).pathname;
    insights.push(`${req.method()} ${path}`);
    if (path === "/_vercel/insights/script.js") return route.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8", body: vaScript });
    if (path === "/_vercel/insights/view" && req.method() === "POST") { views.push(req.postData() ?? ""); return route.fulfill({ status: 200, contentType: "text/plain", body: "OK" }); }
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto(`${url}${QUERY}`, { waitUntil: "load" });
  return { browser, context, page, insights, views };
}
const settle = (page, ms) => page.waitForTimeout(ms);

// off: the local build asks nothing of /_vercel/insights and defines no counter
{
  const { browser, page, insights } = await open(OFF, { ordinary: true });
  await settle(page, 4000);
  assert.deepEqual(insights, [], "a local build requests nothing from /_vercel/insights");
  assert.equal(await page.evaluate(() => typeof window.va), "undefined", "no counter queue on a local build");
  assert.equal(await page.evaluate(() => !!document.querySelector('script[src*="insights"]')), false);
  report.offRequests = insights.length;
  console.log("off: ok (no request, no counter)");
  await browser.close();
}

// on, as an ordinary browser: the script is loaded and one page view is posted, with the address cut
{
  const { browser, context, page, insights, views } = await open(ON, { ordinary: true });
  await page.waitForFunction(() => true);
  const deadline = Date.now() + 60000;
  while (!views.length && Date.now() < deadline) await settle(page, 250);
  await settle(page, 3000);
  assert.deepEqual(insights, ["GET /_vercel/insights/script.js", "POST /_vercel/insights/view"], "the script, then exactly one page view");
  const body = JSON.parse(views[0]);
  assert.equal(body.o, new URL(ON).origin + "/", "the address is sent without the query string and the hash");
  assert.equal(views[0].includes("segredo-de-teste") || views[0].includes("nuvem") || views[0].includes("fps"), false, "no parameter of the page leaves the browser");
  assert.equal(body.sdkn, "@vercel/analytics");
  assert.equal(body.sdkv, "2.0.1");
  // r is the site the visit came from (document.referrer); the page was opened directly here, so it is empty
  assert.deepEqual(Object.keys(body).filter((k) => body[k] !== undefined).sort(), ["o", "r", "sdkn", "sdkv", "sv"], "the address, the referrer and the script's versions: nothing else");
  assert.equal(body.r, "", "no referrer when the page is opened directly");
  assert.deepEqual(await context.cookies(), [], "the counting script sets no cookie");
  assert.equal(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("__va"))), false, "and stores nothing of its own");
  assert.equal(await page.evaluate(() => document.querySelector('script[src*="insights"]').dataset.sdkn), "@vercel/analytics");
  report.pageView = body;
  console.log(`on: ok ${views[0]}`);
  await browser.close();
}

// on, as automation presents itself (what every check and agent uses): Vercel's script sends nothing
{
  const { browser, page, insights, views } = await open(ON, { ordinary: false });
  await settle(page, 6000);
  assert.deepEqual(insights, ["GET /_vercel/insights/script.js"], "the script is requested");
  assert.equal(views.length, 0, "and it posts no page view from an automated browser");
  report.automationCounted = false;
  console.log("on, automated browser: ok (script loaded, no page view)");
  await browser.close();
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ok: true, vaScriptSha256: report.vaScriptSha256.slice(0, 16) }));
