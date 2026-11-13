// Browser check of the devs' panel (painel.html). GitHub's API is answered from the responses recorded for this
// repository (test/fixtures/github), so the expected numbers are known; pass --live to ask GitHub itself instead and
// only check that the page fills in. Chromium viewport emulation, not a physical phone.
//   npm run build && npx vite preview --port 4173 &   then   node tools/check_painel.mjs [url] [outdir] [--live]
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");

const args = process.argv.slice(2), live = args.includes("--live"), pos = args.filter((a) => !a.startsWith("--"));
const URL_ = pos[0] ?? "http://localhost:4173/";
const OUT = pos[1] ?? "shots/painel";
mkdirSync(OUT, { recursive: true });
const fixture = (n) => readFileSync(new URL(`../test/fixtures/github/${n}.json`, import.meta.url), "utf8");
const API = "https://api.github.com/repos/alexpiraginet-bot/-grand-testament-adventure";
const report = { url: URL_, live, runs: {} };

async function open(ctxOpts, answer) {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
  const page = await (await browser.newContext(ctxOpts)).newPage();
  const errors = [], asked = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  if (!live) await page.route(`${API}**`, (route) => {
    const u = new URL(route.request().url()); asked.push(u.pathname.slice(new URL(API).pathname.length) + u.search);
    return answer(route, u);
  });
  return { browser, page, errors, asked };
}
const recorded = (route, u) => {
  const p = u.pathname.slice(new URL(API).pathname.length);
  const body = p === "" ? fixture("repo") : p === "/commits" ? fixture("commits") : p === "/issues" ? fixture("issues") : null;
  return body ? route.fulfill({ status: 200, contentType: "application/json", body }) : route.fulfill({ status: 404, contentType: "application/json", body: '{"message":"Not Found"}' });
};
const filled = (page) => page.waitForFunction(() => document.querySelectorAll("#kpis .tile").length === 6 && document.getElementById("access-status"), null, { timeout: 60000 });
const tiles = (page) => page.evaluate(() => [...document.querySelectorAll("#kpis .tile")].map((t) => [...t.children].map((c) => c.textContent)));
const table = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(`${s} tbody tr`)].map((r) => [r.children[0].textContent, r.children[2].textContent, r.querySelector("a")?.href ?? null]), sel);

for (const [name, ctx] of [["pc", { viewport: { width: 1280, height: 800 } }], ["celular", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]]) {
  const { browser, page, errors, asked } = await open(ctx, recorded);
  await page.goto(`${URL_}painel.html`, { waitUntil: "load" });
  await filled(page);
  const r = { tiles: await tiles(page) };
  if (!live) {
    assert.deepEqual(r.tiles, [
      ["29", "commits na branch principal", "12/11/2026 a 13/11/2026"],
      ["3", "pull requests", "2 integrados · 1 aberto"],
      ["1", "issues", "1 aberta"],
      ["1", "pessoa da comunidade", "issues e pull requests de fora"],
      ["0", "estrelas", "0 acompanhando"],
      ["0", "forks"],
    ]);
    assert.deepEqual(await table(page, "#quem > div:nth-child(1)"), [["alexpiraginet-bot", "20", null], ["Claude", "9", null]]);
    assert.deepEqual(await table(page, "#quem > div:nth-child(2)"), [["Claude Opus 5.5", "9", null]]);
    assert.deepEqual(await table(page, "#quem > div:nth-child(3)"), [["alexpiraginet-bot", "20", "https://github.com/alexpiraginet-bot"], ["claude", "9", "https://github.com/claude"]]);
    assert.deepEqual(await table(page, "#dias"), [["12/11/2026", "15", null], ["13/11/2026", "14", null]]);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("#comunidade .chips li")].map((l) => l.textContent)),
      ["1candidatura de voluntariado", "0ideias e relatos pelo jogo", "0outras issues"]);
    assert.deepEqual(await table(page, "#comunidade"), [["marcosmoski", "1", "https://github.com/marcosmoski"]]);
    assert.deepEqual(asked.sort(), ["", "/commits?per_page=100&page=1", "/issues?state=all&per_page=100"], "three requests, no more");
    // the longest bar is the largest value, and bars keep their proportion
    const widths = await page.evaluate(() => [...document.querySelectorAll("#quem > div:nth-child(1) td.bar i")].map((i) => i.getBoundingClientRect().width));
    assert.ok(Math.abs(widths[1] / widths[0] - 9 / 20) < 0.02, `bars in proportion: ${widths}`);
  } else {
    assert.ok(r.tiles.every((t) => /^\d/.test(t[0])), "every tile has a number");
  }
  // visits are counted by the published game (project-stats.ts ACCESS): the panel names the source and the day it was
  // checked, and shows no number, because no summary of the counts is published with it yet
  assert.equal(await page.evaluate(() => document.getElementById("access-status").dataset.state), "on");
  assert.equal(await page.evaluate(() => document.querySelector("#access-status strong").textContent), "Medição ligada");
  assert.match(await page.evaluate(() => document.querySelector("#access-status p").textContent), /Web Analytics da Vercel \(conferido em \d{2}\/\d{2}\/\d{4}\)/);
  // the panel itself is not counted: it loads no counting script
  assert.equal(await page.evaluate(() => !!document.querySelector('script[src*="insights"]') || typeof window.va === "function"), false, "the panel loads no visit counter");
  assert.equal(await page.evaluate(() => /\d/.test(document.querySelector("#access-status p").textContent.replace(/\d{2}\/\d{2}\/\d{4}/, ""))), false, "no figure in the access box besides the date of the check");
  const text = await page.evaluate(() => document.body.innerText);
  assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(text), "no e-mail address on the page");
  assert.match(await page.evaluate(() => document.getElementById("stamp").textContent), /^Dados do GitHub lidos em \d{2}\/\d{2}\/\d{4},? \d{2}:\d{2} \(horário de São Paulo\)\. Último envio ao repositório: /);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "no sideways scroll");
  assert.equal(await page.evaluate(() => [...document.querySelectorAll(".painel-nav a")].every((a) => a.getBoundingClientRect().height >= 44)), true, "touch targets");
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  if (!live) {
    // the answer is kept for five minutes in this tab: a reload asks nothing
    const before = asked.length;
    await page.reload({ waitUntil: "load" }); await filled(page);
    assert.equal(asked.length, before, "a reload inside five minutes makes no request");
  }
  assert.deepEqual(errors, []);
  report.runs[name] = r;
  console.log(`${name}: ok`);
  await browser.close();
}

if (!live) {
  // GitHub refusing (its hourly limit): the panel says why and offers to try again; nothing half-drawn
  let refuse = true;
  const { browser, page, errors } = await open({ viewport: { width: 390, height: 844 } }, (route, u) =>
    refuse ? route.fulfill({ status: 403, contentType: "application/json", body: '{"message":"API rate limit exceeded"}' }) : recorded(route, u));
  await page.goto(`${URL_}painel.html`, { waitUntil: "load" });
  await page.waitForFunction(() => document.getElementById("stamp").classList.contains("is-error"), null, { timeout: 60000 });
  assert.equal(await page.evaluate(() => document.getElementById("stamp").firstChild.textContent), "Não deu para ler os dados agora. O GitHub limitou as consultas deste endereço por alguns minutos.");
  assert.equal(await page.evaluate(() => document.querySelectorAll("#kpis .tile").length), 0, "no tile is drawn from a refusal");
  await page.screenshot({ path: `${OUT}/recusa.png` });
  refuse = false;
  await page.click("#stamp button");
  await filled(page);
  assert.equal((await tiles(page))[0][0], "29");
  assert.deepEqual(errors, []);
  console.log("recusa e nova tentativa: ok");
  await browser.close();
}
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify({ ok: true, live }));
