// Browser regression test of the built game. No real feedback is published.
// npm run build && npm run preview -- --host 127.0.0.1
// PLAYWRIGHT_PATH may point to an existing environment installation; otherwise resolve playwright normally.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");
const base = process.argv[2] || "http://127.0.0.1:4173/";
const out = process.argv[3] || "shots/feedback";
mkdirSync(out, { recursive: true });
const report = { tests: [], note: "Chrome on PC; mobile viewport and touch emulation, not a physical phone. GitHub navigation intercepted, no issue submitted." };
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || undefined });
try {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    const mobile = viewport.width === 390;
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile });
    const page = await ctx.newPage();
    const errors = [], responses = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("response", (r) => responses.push({ url: r.url(), status: r.status() }));
    // Capture the explicit handoff to GitHub without creating public test posts or depending on authentication.
    await page.addInitScript(() => {
      window.__feedbackOpens = [];
      window.open = (url, target, features) => { window.__feedbackOpens.push({ url: String(url), target, features }); return null; };
    });
    await page.goto(`${base}?debug=1`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__gta && !document.getElementById("go").disabled, null, { timeout: 60000 });
    await page.click("#go");
    await page.waitForTimeout(1200);
    const snapshot = () => page.evaluate(() => ({ pos: { ...window.__gta.player.pos }, time: window.__gta.state.time, phase: window.__gta.state.phase }));
    if (!mobile) {
      const before = await snapshot();
      await page.keyboard.down("KeyW"); await page.waitForTimeout(450); await page.keyboard.up("KeyW");
      const after = await snapshot();
      assert.ok(Math.hypot(after.pos.x - before.pos.x, after.pos.z - before.pos.z) > .1, "keyboard movement works");
    }
    await page.screenshot({ path: `${out}/${viewport.width}-game.png` });
    await page.click("#hud [data-feedback-open]");
    assert.equal(await page.evaluate(() => document.getElementById("feedback").open), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), "feedback-heading");
    const frozen = await snapshot();
    await page.click('#feedback button[type="submit"]');
    assert.equal(await page.evaluate(() => window.__feedbackOpens.length), 0, "empty fields cannot navigate");
    await page.selectOption("#feedback-kind", "idea");
    await page.fill("#feedback-title", "Ajustar a sensibilidade da câmera");
    await page.fill("#feedback-description", "Seria legal poder escolher a sensibilidade da câmera. Assim cada pessoa encontra um jeito confortável de explorar a praia.");
    await page.locator("#feedback-description").press("End");
    await page.keyboard.type(" WASD e E ficam só neste texto.");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    assert.deepEqual(await snapshot(), frozen, "typing and Enter do not move the player or advance mission time");
    await page.click('#feedback button[type="submit"]');
    assert.equal(await page.evaluate(() => window.__feedbackOpens.length), 0, "public acknowledgement is required");
    await page.check("#feedback-public");
    await page.evaluate(() => { document.querySelector("#feedback").scrollTop = 0; });
    await page.screenshot({ path: `${out}/${viewport.width}-feedback.png` });
    const layout = await page.evaluate(() => {
      const d = document.getElementById("feedback"), r = d.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, scrollWidth: d.scrollWidth, clientWidth: d.clientWidth, viewWidth: innerWidth, viewHeight: innerHeight };
    });
    assert.ok(layout.x >= 0 && layout.y >= 0 && layout.x + layout.width <= layout.viewWidth + 1 && layout.y + layout.height <= layout.viewHeight + 1);
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1, "no horizontal overflow");
    await page.click('#feedback button[type="submit"]');
    const opens = await page.evaluate(() => window.__feedbackOpens);
    assert.equal(opens.length, 1);
    const issue = new URL(opens[0].url);
    assert.equal(issue.origin, "https://github.com");
    assert.equal(issue.pathname, "/alexpiraginet-bot/grand-testament-adventure/issues/new");
    assert.match(issue.searchParams.get("body"), /confortável/);
    assert.equal(opens[0].features, "noopener,noreferrer");
    assert.match(await page.locator("#feedback-status").innerText(), /Confirme a publicação/);
    // A blocked popup is not success; the same text remains available on re-open.
    const draft = await page.inputValue("#feedback-description");
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => document.getElementById("feedback").open), false);
    assert.equal(await page.evaluate(() => document.activeElement.matches("[data-feedback-open]")), true);
    if (!mobile) {
      const before = await snapshot();
      await page.keyboard.down("KeyW"); await page.waitForTimeout(450); await page.keyboard.up("KeyW");
      const after = await snapshot();
      assert.ok(Math.hypot(after.pos.x - before.pos.x, after.pos.z - before.pos.z) > .1, "controls resume with focus restored to opener");
    }
    await page.click("#hud [data-feedback-open]");
    assert.equal(await page.inputValue("#feedback-description"), draft);
    await page.click("#feedback-close");
    assert.equal(await page.evaluate(() => document.getElementById("feedback").open), false);
    await page.waitForTimeout(2000);
    if (mobile) {
      const before = await snapshot();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 70, y: 500 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 70, y: 450 }] });
      await page.waitForTimeout(450);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      const after = await snapshot();
      assert.ok(Math.hypot(after.pos.x - before.pos.x, after.pos.z - before.pos.z) > .1, "touch joystick resumes after modal closes");
      await cdp.detach();
    }
    const runtime = await page.evaluate(() => ({
      backend: window.__gta.backend,
      fps: window.__gta.fpsLog.slice(-2),
      render: window.__gta.info(),
      bytes: [...performance.getEntriesByType("navigation"), ...performance.getEntriesByType("resource")].reduce((s, e) => s + e.transferSize, 0),
      resources: performance.getEntriesByType("resource").length,
    }));
    assert.deepEqual(errors, []);
    report.tests.push({ viewport, passed: true, layout, ...runtime, errors, httpErrors: responses.filter((r) => r.status >= 400) });
    await ctx.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
