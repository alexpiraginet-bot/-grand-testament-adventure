// Every mesh in src/data/modelos.json exists and fits its budget (TRIPO.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

const modelos = JSON.parse(readFileSync(new URL("../src/data/modelos.json", import.meta.url)).toString()) as
  Record<string, { arquivo: string; altura: number; triangulos_max: number; textura_max: number }>;

test("every mesh fits its triangle and texture budget", async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  for (const [name, m] of Object.entries(modelos)) {
    const doc = await io.read(new URL(`../public/${m.arquivo}`, import.meta.url).pathname);
    let tris = 0;
    for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute("POSITION")!.getCount()) / 3;
    assert.ok(tris <= m.triangulos_max * 1.02, `${name}: ${tris} triangles > ${m.triangulos_max}`);
    for (const t of doc.getRoot().listTextures()) {
      const size = t.getSize();
      assert.ok(size && size[0] <= m.textura_max && size[1] <= m.textura_max, `${name}: texture ${size} > ${m.textura_max}`);
    }
  }
});
