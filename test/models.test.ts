// Every mesh of src/data/modelos.json that is present fits its budget (TRIPO.md). The meshes are not in the public
// repository (ASSETS.md): a missing file is reported and skipped, and the game falls back to the simple shapes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

const modelos = JSON.parse(readFileSync(new URL("../src/data/modelos.json", import.meta.url)).toString()) as
  Record<string, { arquivo: string; altura: number; triangulos_max: number; textura_max: number }>;

test("every mesh fits its triangle and texture budget", async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  for (const [name, m] of Object.entries(modelos)) {
    const path = new URL(`../public/${m.arquivo}`, import.meta.url).pathname;
    if (!existsSync(path)) { console.log(`# ${name}: ${m.arquivo} ausente (malha fora do git), não conferida`); continue; }
    const doc = await io.read(path);
    // the game loads meshes without the meshopt decoder (its WebAssembly may be blocked by the host)
    const required = doc.getRoot().listExtensionsRequired().map((e) => e.extensionName);
    assert.ok(!required.includes("EXT_meshopt_compression"), `${name}: needs EXT_meshopt_compression; run tools/optimize_model.mjs`);
    let tris = 0;
    for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute("POSITION")!.getCount()) / 3;
    assert.ok(tris <= m.triangulos_max * 1.02, `${name}: ${tris} triangles > ${m.triangulos_max}`);
    for (const t of doc.getRoot().listTextures()) {
      const size = t.getSize();
      assert.ok(size && size[0] <= m.textura_max && size[1] <= m.textura_max, `${name}: texture ${size} > ${m.textura_max}`);
    }
  }
});
