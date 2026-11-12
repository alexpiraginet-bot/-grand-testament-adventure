// Brings a Tripo GLB down to the budget of its sheet (TRIPO.md, src/data/modelos.json) and writes it to public/models/.
//   node tools/optimize_model.mjs <original.glb> <name>     e.g.  node tools/optimize_model.mjs ~/Downloads/x.glb heroi
// Meshopt simplification to the triangle budget, textures resized to the budget and re-encoded as WebP, geometry
// quantized and meshopt-compressed (the game's GLTFLoader has the decoder). The original is not changed.
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

const [src, name] = process.argv.slice(2);
if (!src || !name) { console.error("uso: node tools/optimize_model.mjs <original.glb> <nome>"); process.exit(2); }
const spec = JSON.parse(readFileSync(new URL("../src/data/modelos.json", import.meta.url)))[name];
if (!spec) { console.error(`${name} não está em src/data/modelos.json`); process.exit(2); }
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });

async function triangles(path) {
  const doc = await io.read(path);
  let t = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) / 3;
  return t;
}

const before = await triangles(src);
const out = new URL(`../${spec.arquivo.replace(/^models\//, "public/models/")}`, import.meta.url).pathname;
let ratio = Math.min(1, spec.triangulos_max / before);
for (let pass = 0; pass < 4; pass++) {
  execFileSync("npx", ["gltf-transform", "optimize", src, out, "--simplify-ratio", String(ratio), "--simplify-error", "0.02",
    "--texture-compress", "webp", "--texture-size", String(spec.textura_max), "--compress", "meshopt"], { stdio: "inherit" });
  const after = await triangles(out);
  console.log(`pass ${pass + 1}: ratio ${ratio.toFixed(5)} -> ${after} triangles (budget ${spec.triangulos_max})`);
  if (after <= spec.triangulos_max * 1.02) break;
  ratio *= (spec.triangulos_max / after) * 0.98;
}
console.log(`${name}: ${before} -> ${await triangles(out)} triangles, ${statSync(src).size} -> ${statSync(out).size} bytes`);
