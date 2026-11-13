import test from "node:test";
import assert from "node:assert/strict";
import { BUILD_SHA, BUILD_SHORT, describeGpu } from "../src/build-info.ts";
import { SECTIONS } from "../src/credits.ts";

test("outside Vite the stamp says it is unknown instead of throwing, and the credits carry it", () => {
  assert.equal(BUILD_SHA, "desconhecido");
  assert.equal(BUILD_SHORT, "desconhecido");
  assert.ok(SECTIONS.some((s) => s.p.some((line) => line.includes(`commit ${BUILD_SHORT}`))));
});

test("the GPU line comes from what the browser exposes, WebGPU first, without repeating itself", () => {
  assert.equal(describeGpu({ webgpu: { vendor: "nvidia", architecture: "blackwell", device: "", description: "" } }), "nvidia · blackwell");
  assert.equal(describeGpu({ webgpu: { vendor: "apple", architecture: "apple", description: " " } }), "apple");
  assert.equal(describeGpu({ webgpu: {}, webglRenderer: "ANGLE (Intel, Mesa)" }), "ANGLE (Intel, Mesa)", "empty WebGPU info falls back");
  assert.equal(describeGpu({ webgpu: null, webglRenderer: "  " }), null);
  assert.equal(describeGpu({}), null);
});
