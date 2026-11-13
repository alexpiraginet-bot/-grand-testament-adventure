// Every mesh of src/data/modelos.json that is present fits its budget (TRIPO.md). The meshes are not in the public
// repository (ASSETS.md): a missing file is reported and skipped, and the game falls back to the simple shapes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

const modelos = JSON.parse(readFileSync(new URL("../src/data/tripo-assets.json", import.meta.url)).toString()).assets as
  Record<string, { file: string; sha256: string; bytes: number; triangles: number; textureSize: number; skins: number; clips: string[]; status: string }>;

test("every mesh fits its triangle and texture budget", async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  for (const [name, m] of Object.entries(modelos)) {
    if(m.status!=='runtime')continue;
    const path = fileURLToPath(new URL(`../public/${m.file}`, import.meta.url));
    assert.ok(existsSync(path), `${name}: run npm run assets before tests`);
    const bytes=readFileSync(path);
    assert.equal(bytes.length,m.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),m.sha256);
    const doc = await io.read(path);
    // the game loads meshes without the meshopt decoder (its WebAssembly may be blocked by the host)
    const required = doc.getRoot().listExtensionsRequired().map((e) => e.extensionName);
    assert.ok(!required.includes("EXT_meshopt_compression"), `${name}: needs EXT_meshopt_compression; run tools/optimize_model.mjs`);
    let tris = 0;
    for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute("POSITION")!.getCount()) / 3;
    assert.equal(tris,m.triangles);
    assert.ok(tris <= (name==='heroi'?18000:8000), `${name}: triangle budget exceeded`);
    assert.equal(doc.getRoot().listSkins().length,m.skins);
    if(name==='heroi') {
      assert.equal(doc.getRoot().listSkins()[0].listJoints().length,65);
      assert.deepEqual(doc.getRoot().listAnimations().map(c=>c.getName()),['walk']);
    }
    for (const t of doc.getRoot().listTextures()) {
      const size = t.getSize();
      assert.ok(size && size[0] <= m.textureSize && size[1] <= m.textureSize, `${name}: texture ${size} > ${m.textureSize}`);
    }
  }
});
