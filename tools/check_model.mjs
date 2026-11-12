// Photographs a model from four sides in the viewer (front, right, back, left) and prints its numbers.
//   npx vite --port 5173 &   then   node tools/check_model.mjs /models/heroi.glb 1.76 out/heroi
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
const { chromium } = createRequire(import.meta.url)("playwright");   // the environment's Playwright

const [src = "/models/heroi.glb", h = "1.76", out = "shots/modelo", base = "http://localhost:5173"] = process.argv.slice(2);
mkdirSync(dirname(out), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 520, height: 760 } });
const stats = [];
for (const yaw of [0, 90, 180, 270]) {
  await page.goto(`${base}/tools/viewer/?src=${encodeURIComponent(src)}&h=${h}&yaw=${yaw}&gl=1`);
  await page.waitForFunction(() => window.__viewer, null, { timeout: 300000 });
  await page.waitForTimeout(500);
  stats.push(await page.evaluate(() => window.__viewer));
  await page.screenshot({ path: `${out}-${yaw}.png` });
}
await browser.close();
writeFileSync(`${out}.json`, JSON.stringify(stats[0], null, 1));
console.log(JSON.stringify(stats[0], null, 1));
