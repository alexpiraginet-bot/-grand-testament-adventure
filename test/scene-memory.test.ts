import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three/webgpu";
import { sceneTextures, texelFormat } from "../src/scene-memory.ts";
import { memorySummary } from "../src/bench.ts";

test("scene textures become memory items: each texture once, its real size and format, unknown formats listed not guessed", () => {
  const data = new THREE.DataTexture(new Uint8Array(4 * 4 * 4), 4, 4, THREE.RGBAFormat, THREE.UnsignedByteType);
  data.generateMipmaps = false;                                       // 4×4 RGBA8, no mips: 64 bytes
  const img = new THREE.Texture({ width: 8, height: 8 } as unknown as HTMLImageElement);
  img.generateMipmaps = true;                                         // 8×8 RGBA8 + mips: 256+64+16+4 = 340 bytes
  const odd = new THREE.DataTexture(new Float32Array(4 * 4 * 3), 4, 4, THREE.RGBFormat as THREE.PixelFormat, THREE.FloatType);
  const scene = new THREE.Scene();
  const a = new THREE.MeshStandardNodeMaterial({ map: data, normalMap: img });
  const b = new THREE.MeshStandardNodeMaterial({ map: img });          // the same texture again: counted once
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), a), new THREE.Mesh(new THREE.BoxGeometry(), [b, new THREE.MeshBasicNodeMaterial({ alphaMap: odd })]));
  scene.background = img;
  const items = sceneTextures(scene);
  assert.equal(items.length, 3);
  const sum = memorySummary(items);
  assert.equal(sum.totalBytes, 64 + 340, "the unknown format adds nothing instead of a guess");
  assert.equal(sum.byOrigin.dados.count, 2); assert.equal(sum.byOrigin.imagem.bytes, 340);
  assert.ok(Object.keys(sum.byFormat).some((f) => f.startsWith("outro(")), "the unknown format is still listed");
});

test("texel formats map only where the estimate has a row", () => {
  assert.equal(texelFormat(THREE.RGBAFormat, THREE.UnsignedByteType), "rgba8");
  assert.equal(texelFormat(THREE.RGBAFormat, THREE.HalfFloatType), "rgba16f");
  assert.equal(texelFormat(THREE.RedFormat, THREE.UnsignedByteType), "r8");
  assert.equal(texelFormat(THREE.RedFormat, THREE.FloatType), null);
});
