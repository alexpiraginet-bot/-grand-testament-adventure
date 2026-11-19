// Pictures of the house kit's review page (tools/casas/index.html), for a person to look at.
//   npx vite --port 5179 &   then   node tools/shoot_casas.mjs [url] [outdir] [views]
// A software renderer here: the pictures show form, light and material, not a frame rate.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");
const URL_ = process.argv[2] ?? "http://127.0.0.1:5179/", OUT = process.argv[3] ?? "shots/casas-r17";
// views: rua, meio, alto, porta:<i> (a test street), comparar[:<0..2>] (today's meshes beside the kit) and
// vila, vila-alto, vila-rua[:<i>] (the kit on the village's real lots)
const VIEWS = (process.argv[4] ?? "rua,meio,alto,porta:0,porta:5,comparar:0,comparar:1,comparar:2,vila,vila-alto,vila-rua,vila-rua:60").split(",");
const ONLY = process.env.CASAS_RUN;                                           // pc | celular, to take one of the two
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [name, ctx] of [["pc", { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 }], ["celular", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  if (ONLY && ONLY !== name) continue;
  const page = await (await browser.newContext(ctx)).newPage(); page.setDefaultTimeout(600000);
  const errors = []; page.on("pageerror", (e) => errors.push(String(e))); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  for (const spec of VIEWS) {
    const [view, i] = spec.split(":");
    if (name === "celular" && !["rua", "porta", "vila-rua", "comparar"].includes(view)) continue;
    await page.goto(`${URL_}tools/casas/index.html?view=${view}${i ? `&i=${i}` : ""}&hud=0&gl=1${name === "celular" ? "&perfil=mobile" : ""}`, { waitUntil: "load" });
    const state = await (await page.waitForFunction(() => window.__casas, null, { timeout: 600000, polling: 200 })).jsonValue();
    if (!state.ready) throw new Error(`${name} ${spec}: ${state.error}`);
    await page.screenshot({ path: `${OUT}/${name}-${spec.replace(":", "-")}.png` });
    console.log(name, spec, JSON.stringify(state), errors.length ? `errors: ${errors.join(" | ")}` : "");
  }
}
await browser.close();
