// Budget ceilings for every asset of src/data/tripo-assets.json, frozen at what the catalog (tripo-runtime-r1) and the
// runtime GLBs held on 13/11/2026. A new Tripo export, a re-optimisation or a catalog edit may make an asset lighter,
// never heavier by accident. The table is literal on purpose: reading the ceilings from the files under test would
// always pass. It was printed once by a throwaway script that also cross-checked each texture count with gltf-transform.
//
// To raise a ceiling deliberately, edit that row in the same PR that grows the asset and give the reason there (a
// trailing comment on the row and a line in the PR description). When an asset gets lighter, lower its row to keep the gain.
//
// models.test.ts already ties each runtime GLB to its catalog row (same bytes, triangles, texture sizes), so the catalog
// ceilings below bound the files too. The texture count is the one number the catalog does not record, so it is read from
// the GLB JSON chunk here. Assets that are not 'runtime' have no GLB in public/: only their catalog numbers are checked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

type Ceiling = { bytes: number; triangles: number; textureSize: number; textures?: number };

const CEILINGS: Record<string, Ceiling> = {
  "arbusto-seco":     { bytes: 434812, triangles: 574, textureSize: 2048, textures: 3 },
  "arvore-espinhosa": { bytes: 641680, triangles: 1786, textureSize: 2048, textures: 3 },
  "barco-galileia":   { bytes: 1119572, triangles: 7453, textureSize: 2048, textures: 3 },
  "casa-basalto-a":   { bytes: 675572, triangles: 3824, textureSize: 2048, textures: 3 },
  "casa-basalto-b":   { bytes: 881860, triangles: 4910, textureSize: 2048, textures: 3 },
  "casa-basalto-c":   { bytes: 733116, triangles: 3262, textureSize: 2048, textures: 3 },
  "empregado":        { bytes: 751948, triangles: 7688, textureSize: 2048 }, // awaiting rig: no GLB in public/
  "heroi":            { bytes: 1397424, triangles: 17481, textureSize: 2048, textures: 3 },
  "junco":            { bytes: 378684, triangles: 561, textureSize: 2048, textures: 3 },
  "muro-pedra":       { bytes: 724620, triangles: 1192, textureSize: 2048, textures: 3 },
  "oliveira-a":       { bytes: 918560, triangles: 2037, textureSize: 2048, textures: 3 },
  "oliveira-b":       { bytes: 651700, triangles: 1139, textureSize: 2048, textures: 3 },
  "pedras-basalto":   { bytes: 840188, triangles: 3402, textureSize: 2048, textures: 3 },
  "pescador-andre":   { bytes: 897304, triangles: 11476, textureSize: 2048 }, // awaiting rig: no GLB in public/
  "pescador-joao":    { bytes: 985100, triangles: 11856, textureSize: 2048 }, // awaiting rig: no GLB in public/
  "pescador-simao":   { bytes: 792408, triangles: 11460, textureSize: 2048 }, // awaiting rig: no GLB in public/
  "pescador-tiago":   { bytes: 864956, triangles: 11446, textureSize: 2048 }, // awaiting rig: no GLB in public/
  "rede-amontoada":   { bytes: 814860, triangles: 1207, textureSize: 2048, textures: 3 },
  "rede-lancada":     { bytes: 1363608, triangles: 1349, textureSize: 2048, textures: 3 },
  "zebedeu":          { bytes: 840608, triangles: 9866, textureSize: 2048 }, // awaiting rig: no GLB in public/
};

type Asset = { file: string; bytes: number; triangles: number; textureSize: number; status: string };
const assets = JSON.parse(readFileSync(new URL("../src/data/tripo-assets.json", import.meta.url), "utf8")).assets as Record<string, Asset>;
const runtime = Object.entries(assets).filter(([, a]) => a.status === "runtime");
// tools/fetch_assets.mjs only ever writes runtime meshes here (it rejects any other path)
const RUNTIME_DIR = fileURLToPath(new URL("../public/models/tripo-r1", import.meta.url));

/** Length of the `textures` array in a GLB's JSON chunk, read from the binary container itself (glTF 2.0 GLB layout). */
function glbTextureCount(glb: Buffer, name: string): number {
  assert.ok(glb.length >= 20, `${name}: too short for a GLB`);
  assert.equal(glb.readUInt32LE(0), 0x46546c67, `${name}: not a GLB (magic 'glTF')`);
  assert.equal(glb.readUInt32LE(4), 2, `${name}: GLB container version`);
  assert.equal(glb.readUInt32LE(8), glb.length, `${name}: GLB header length differs from the file size`);
  const jsonLength = glb.readUInt32LE(12);
  assert.equal(glb.readUInt32LE(16), 0x4e4f534a, `${name}: first GLB chunk is not JSON`);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8")) as { textures?: unknown[] };
  return json.textures?.length ?? 0;
}

test("every catalog asset has exactly one ceiling row, and runtime rows bound the texture count", () => {
  assert.deepEqual(Object.keys(CEILINGS).sort(), Object.keys(assets).sort(), "add or remove the asset's row in CEILINGS (see the header)");
  const missing = runtime.filter(([name]) => CEILINGS[name]?.textures === undefined).map(([name]) => name);
  assert.deepEqual(missing, [], "runtime assets need a texture-count ceiling (a status change to 'runtime' must add one)");
});

test("catalog bytes, triangles and texture size stay at or under the frozen ceilings", () => {
  const over: string[] = [];
  for (const [name, a] of Object.entries(assets)) {
    const c = CEILINGS[name];
    if (!c) continue; // reported by the row test above
    for (const key of ["bytes", "triangles", "textureSize"] as const)
      if (!(a[key] <= c[key])) over.push(`${name}.${key}: ${a[key]} > ceiling ${c[key]}`);
  }
  assert.deepEqual(over, []);
});

test("runtime GLBs hold no more textures (and bytes) than their ceilings", (t) => {
  if (!existsSync(RUNTIME_DIR)) {
    t.skip("public/models/tripo-r1 is missing (fresh clone): run npm run assets to check the GLB texture counts");
    return;
  }
  const over: string[] = [];
  for (const [name, a] of runtime) {
    const c = CEILINGS[name];
    if (c?.textures === undefined) continue; // reported by the row test above
    const path = fileURLToPath(new URL(`../public/${a.file}`, import.meta.url));
    if (!existsSync(path)) { over.push(`${name}: ${a.file} missing; run npm run assets`); continue; }
    const glb = readFileSync(path);
    if (glb.length > c.bytes) over.push(`${name}: file ${glb.length} bytes > ceiling ${c.bytes}`);
    const textures = glbTextureCount(glb, name);
    if (textures > c.textures) over.push(`${name}: ${textures} textures > ceiling ${c.textures}`);
  }
  assert.deepEqual(over, []);
});
