// R13 public defaults smoke: debug exposes observation only; no camera/FX overrides.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2), pos = args.filter(x => !x.startsWith('--'));
const expected = args.find(x => x.startsWith('--expected-sha='))?.slice(15);
assert.match(expected || '', /^[a-f0-9]{64}$/);
const base = new URL(pos[0]), out = path.resolve(pos[1]);
assert.ok(!existsSync(out), 'Evidence directory must be new');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'HARNESS.mjs'), readFileSync(new URL(import.meta.url)));
const pw = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || 'playwright');
const hash = b => createHash('sha256').update(b).digest('hex');
const report = { schema: 1, startedAt: new Date().toISOString(), expectedSha256: expected, runs: [], limits: [
  'Only debug=1 is added to the ordinary URL. No FX, camera, delta-time, weather, pose or time overrides.',
  'Mobile is emulated Chrome on Windows, DPR1; not physical iPhone/Safari or phone performance.',
  'Touch input is a real Chromium touch sequence on the visible joystick; no position assignment.',
  'Analytics is intercepted, writes blocked. All page/console/request/HTTP errors are recorded.',
  'Smoke verifies current default pipeline only; it does not promote optional master/alto or DLSS.'
] };
const save = () => writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
for (const mobile of [false, true]) {
  const id = mobile ? 'mobile-default' : 'desktop-default';
  const viewport = mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 };
  const dir = path.join(out, id); mkdirSync(dir);
  const r = { id, viewport, checks: [], passed: false, pageErrors: [], consoleErrors: [], warnings: [], httpErrors: [], requestFailures: [], blockedWrites: [], analyticsSuppressed: [], bundles: [] };
  report.runs.push(r); save();
  let browser, context, page, cdp; const tasks = [];
  const check = (value, name) => { assert.ok(value, name); r.checks.push(name); save(); };
  const state = () => page.evaluate(() => ({ phase: __gta.state.phase, time: __gta.state.time, player: structuredClone(__gta.player), camera: __gta.camera(), backend: __gta.backend, loading: __gta.loading(), fauna: __gta.fauna(), npc: __gta.npc(), characters: __gta.characters(), renderer: __gta.info(), audio: __gta.audio(), dimensions: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, canvasWidth: document.getElementById('c').width, canvasHeight: document.getElementById('c').height } }));
  try {
    browser = await pw.chromium.launch({ channel: 'chrome', headless: true }); r.browserVersion = browser.version();
    context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, ...(mobile ? { userAgent: pw.devices['iPhone 13'].userAgent } : {}) });
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', e => r.pageErrors.push(String(e))); page.on('crash', () => r.pageErrors.push('PAGE CRASH'));
    page.on('console', m => { if (m.type() === 'error') r.consoleErrors.push({ text: m.text(), location: m.location() }); else if (m.type() === 'warning') r.warnings.push(m.text()); });
    page.on('requestfailed', q => r.requestFailures.push({ url: q.url(), failure: q.failure() }));
    page.on('response', res => {
      if (res.status() >= 400) r.httpErrors.push({ url: res.url(), status: res.status() });
      if (/\/assets\/index-[^/]+\.js$/.test(new URL(res.url()).pathname)) tasks.push(res.body().then(b => r.bundles.push({ url: res.url(), bytes: b.length, sha256: hash(b) })));
    });
    await context.route('**/*', route => {
      const req = route.request();
      if (new URL(req.url()).pathname === '/_vercel/insights/script.js') { r.analyticsSuppressed.push(req.url()); return route.fulfill({ status: 200, contentType: 'application/javascript', body: '/* R13 QA analytics suppressed */' }); }
      if (!['GET', 'HEAD'].includes(req.method())) { r.blockedWrites.push(req.url()); return route.abort(); }
      return route.continue();
    });
    const url = new URL(base); assert.equal(url.search, '', 'Supply ordinary URL without rendering flags'); url.searchParams.set('debug', '1'); r.url = url.href;
    check([...url.searchParams.keys()].join() === 'debug', 'ordinary rendering defaults preserved');
    const started = Date.now(); await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => window.__gta?.loading().state === 'ready' && !document.getElementById('go').disabled, null, { timeout: 120000 });
    r.readyMs = Date.now() - started; r.intro = await state();
    check(r.intro.loading.completed === 14 && r.intro.loading.total === 14 && r.intro.loading.failed === 0 && r.intro.phase === 'intro', '14 core resources ready with ordinary introduction');
    await page.screenshot({ path: path.join(dir, 'intro.png') });
    if (mobile) await page.locator('#go').tap(); else await page.locator('#go').click();
    await page.waitForFunction(() => __gta.fauna().status === 'ready' && __gta.npc().status === 'ready', null, { timeout: 90000 });
    await page.waitForTimeout(1500); r.before = await state();
    check(r.before.phase === 'play' && r.before.fauna.renderer.loadedKinds.length === 2 && r.before.fauna.renderer.failedKinds.length === 0, 'Go starts play and both approved fauna load');
    check(r.before.characters.primitiveHumanMeshes === 0 && r.before.characters.rendered.some(c => c.role === 'hero' && c.skinnedMeshes > 0) && r.before.npc.actor.bytes > 0, 'native hero and approved Simão load without primitive humans');
    check(r.before.dimensions.width === viewport.width && r.before.dimensions.height === viewport.height, 'actual viewport dimensions match requested profile');
    r.input = { type: mobile ? 'CDP real touch joystick' : 'real KeyW', samples: [] };
    if (mobile) {
      const box = await page.locator('#joy').boundingBox(); assert.ok(box && box.width > 0);
      r.input.joystickBox = box; cdp = await context.newCDPSession(page);
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 };
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [center] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...center, y: center.y - box.width * .45 }] });
    } else await page.keyboard.down('KeyW');
    try {
      for (let i = 0; i < 20; i++) { await page.waitForTimeout(100); r.input.samples.push(await page.evaluate(() => ({ at: performance.now(), time: __gta.state.time, pos: { ...__gta.player.pos }, blocked: __gta.blocked(__gta.player.pos.x, __gta.player.pos.z, false), camera: __gta.camera() }))); }
    } finally { if (mobile) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.keyboard.up('KeyW'); }
    r.after = await state(); r.input.displacement = Math.hypot(r.after.player.pos.x - r.before.player.pos.x, r.after.player.pos.z - r.before.player.pos.z);
    check(r.input.displacement > 1 && r.input.samples.every(s => !s.blocked && !s.camera.inside), 'real input moves player through free ground and camera space');
    check(r.after.time - r.before.time > 1, 'ordinary game clock advances during input');
    await page.screenshot({ path: path.join(dir, 'play-after-input.png') });
    await Promise.all(tasks); check(r.bundles.length > 0 && r.bundles.every(b => b.sha256 === expected), 'served build matches frozen bundle SHA');
    r.resources = await page.evaluate(() => performance.getEntriesByType('resource').map(e => ({ url: e.name, transferSize: e.transferSize, encodedBodySize: e.encodedBodySize })));
    r.bytes = { transfer: r.resources.reduce((n, e) => n + e.transferSize, 0), encoded: r.resources.reduce((n, e) => n + e.encodedBodySize, 0) };
    check(!r.pageErrors.length && !r.consoleErrors.length && !r.httpErrors.length && !r.requestFailures.length && !r.blockedWrites.length, 'no captured shader/page/console/HTTP/request errors or writes'); r.passed = true;
  } catch (e) { r.failure = String(e.stack || e); try { r.failureState = await state(); await page.screenshot({ path: path.join(dir, 'failure.png') }); } catch {} }
  finally { await context?.close(); await browser?.close(); r.finishedAt = new Date().toISOString(); save(); console.log(JSON.stringify({ id, passed: r.passed, checks: r.checks.length, backend: r.before?.backend, displacement: r.input?.displacement, failure: r.failure })); }
}
report.finishedAt = new Date().toISOString(); report.passed = report.runs.every(r => r.passed); save();
const files = [];
function walk(dir) { for (const e of readdirSync(dir, { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) walk(f); else if (e.name !== 'MANIFEST.json') { const b = readFileSync(f); files.push({ file: path.relative(out, f).replaceAll('\\', '/'), bytes: b.length, sha256: hash(b) }); } } }
walk(out); writeFileSync(path.join(out, 'MANIFEST.json'), JSON.stringify({ createdAt: new Date().toISOString(), passed: report.passed, files }, null, 2));
if (!report.passed) process.exitCode = 1;
