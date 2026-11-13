import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three/webgpu";
import GTAONode from "three/addons/tsl/display/GTAONode.js";
import TRAANode from "three/addons/tsl/display/TRAANode.js";
import { createPostFx, parseAo, parseFx, type AoMode, type FxLevel } from "../src/postfx.ts";

test("post-processing flags: anything unknown keeps the direct render and the shipped occlusion", () => {
  assert.equal(parseFx(null), "off"); assert.equal(parseFx("alto"), "alto"); assert.equal(parseFx("master"), "master");
  assert.equal(parseFx("ALTO"), "off"); assert.equal(parseFx("ultra"), "off");
  assert.equal(parseAo(null), "final"); assert.equal(parseAo("indireta"), "indireta");
  assert.equal(parseAo("indirect"), "final"); assert.equal(parseAo(""), "final");
});

// These tests construct the real r186 effect graph and release its resources.
// Only the final render call is stubbed: no GPU,
// no browser, and no claim that this substitutes for the water-image regression.

function fixture() {
  const renderer = { toneMapping: THREE.ACESFilmicToneMapping, outputColorSpace: THREE.SRGBColorSpace } as THREE.WebGPURenderer;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1.6, .1, 30000);
  camera.setViewOffset(1280, 800, 2, 3, 1280, 800);
  const texture = new THREE.Texture();
  const material = new THREE.MeshPhysicalNodeMaterial({ map: texture, transparent: true, depthWrite: false, opacity: .35 });
  const geometry = new THREE.PlaneGeometry(20, 20);
  const water = new THREE.Mesh(geometry, material); water.name = "water-fixture"; scene.add(water);
  return { renderer, scene, camera, texture, material, geometry };
}

test("off allocates no effect graph and preserves direct-render ownership", t => {
  const f = fixture();
  const calls = t.mock.method(THREE.RenderPipeline.prototype, "render", () => { throw Error("Unexpected postfx render"); });
  assert.equal(createPostFx(f.renderer, f.scene, f.camera, "off"), null);
  assert.equal(createPostFx(f.renderer, f.scene, f.camera, "off", "indireta"), null);
  assert.equal(calls.mock.callCount(), 0);
});

for (const aoMode of ["final", "indireta"] as AoMode[]) {
  for (const level of ["alto", "master"] as FxLevel[]) {
    test(`${level}/${aoMode}: real graph preserves baseline AA inputs, colour ordering and scene materials`, t => {
      const f = fixture(), view = structuredClone(f.camera.view), matrix = f.camera.projectionMatrix.toArray();
      let captured: THREE.RenderPipeline | undefined;
      const aoNodes = new Set<GTAONode>(), getAoTexture = GTAONode.prototype.getTextureNode;
      t.mock.method(GTAONode.prototype, "getTextureNode", function (this: GTAONode) {
        aoNodes.add(this); return getAoTexture.call(this);
      });
      t.mock.method(THREE.RenderPipeline.prototype, "render", function (this: THREE.RenderPipeline) { captured = this; });
      const fx = createPostFx(f.renderer, f.scene, f.camera, level, aoMode)!;
      try {
        fx.render();
        assert.ok(captured);
        assert.equal(captured.outputColorTransform, true, "linear effects stay before the pipeline's final colour conversion");
        const nodes = new Set<THREE.Node>();
        captured.outputNode.traverse(node => { nodes.add(node); });
        const names = [...nodes].map(node => node.constructor.name);
        assert.ok(!names.includes("SMAANode"), "the visually rejected SMAA replacement must not return");
        const temporalNodes = [...nodes].filter((node): node is TRAANode => node instanceof TRAANode);
        assert.equal(temporalNodes.length, level === "master" ? 1 : 0);
        assert.equal(names.filter(name => name === "RTTNode").length, level === "master" ? 1 : 0, "one owned TRAA colour input, no hidden extra RTT");
        const passes = [...nodes].filter((node): node is THREE.PassNode => node instanceof THREE.PassNode);
        assert.ok(passes.length >= 1);
        for (const pass of passes) {
          const prePass = pass.name === "postfx-opaque-normal-depth";
          assert.equal(pass.renderTarget.samples, prePass || level === "master" ? 0 : 4);
          assert.equal(pass.transparent, !prePass, "only colour includes blended water; normal/depth prepasses stay coherent");
          assert.equal(pass.renderTarget.textures.some(texture => texture.name === "velocity"), level === "master" && !prePass);
        }
        for (const temporal of temporalNodes) {
          const depth = temporal.depthNode as unknown as { passNode: THREE.PassNode };
          const motion = temporal.velocityNode as unknown as { passNode: THREE.PassNode; value: THREE.Texture };
          assert.equal(depth.passNode.renderTarget.samples, 0, "TRAA requires single-sample depth, as in the baseline");
          assert.equal(depth.passNode, motion.passNode, "temporal depth and velocity must describe the same colour pass");
          assert.notEqual(depth.passNode.name, "postfx-opaque-normal-depth", "TRAA never takes its depth from the AO prepass");
          assert.equal(motion.value.name, "velocity");
          assert.equal(motion.passNode.getMRT()!.outputNodes.velocity.constructor.name, "VelocityNode");
          assert.equal(temporal.camera, f.camera);
        }
        assert.equal(aoNodes.size, 1);
        for (const occlusion of aoNodes) {
          const input = occlusion.depthNode as unknown as { passNode: THREE.PassNode };
          assert.equal(input.passNode.renderTarget.samples, 0, "GTAO textureGather must never receive multisampled depth");
          if (level === "alto" || aoMode === "indireta") {
            assert.equal(input.passNode.name, "postfx-opaque-normal-depth");
            assert.equal(input.passNode.transparent, false);
            const normal = occlusion.normalNode as unknown as { passNode: THREE.PassNode };
            assert.equal(normal.passNode, input.passNode, "normal and depth come from the same opaque prepass");
          }
        }
        assert.equal(fx.antialiasing, level === "master" ? "traa" : "msaa4");
        assert.equal(fx.temporal, level === "master");
        assert.equal(fx.ao, aoMode);
        assert.equal(f.material.transparent, true); assert.equal(f.material.depthWrite, false);
        assert.equal(f.material.opacity, .35); assert.equal(f.material.map, f.texture);
        assert.deepEqual(f.camera.view, view); assert.deepEqual(f.camera.projectionMatrix.toArray(), matrix);
      } finally { fx.dispose(); }
    });

    test(`${level}/${aoMode}: dispose releases every owned target once and never releases scene assets`, t => {
      const f = fixture(), targets: THREE.RenderTarget[] = [], textures: THREE.Texture[] = [], materials: THREE.Material[] = [];
      const disposeTarget = THREE.RenderTarget.prototype.dispose;
      const disposeTexture = THREE.Texture.prototype.dispose;
      const disposeMaterial = THREE.Material.prototype.dispose;
      t.mock.method(THREE.RenderTarget.prototype, "dispose", function (this: THREE.RenderTarget) { targets.push(this); disposeTarget.call(this); });
      t.mock.method(THREE.Texture.prototype, "dispose", function (this: THREE.Texture) { textures.push(this); disposeTexture.call(this); });
      t.mock.method(THREE.Material.prototype, "dispose", function (this: THREE.Material) { materials.push(this); disposeMaterial.call(this); });
      const render = t.mock.method(THREE.RenderPipeline.prototype, "render", () => {});
      let sharedGeometryDisposals = 0; f.geometry.addEventListener("dispose", () => { sharedGeometryDisposals++; });
      const fx = createPostFx(f.renderer, f.scene, f.camera, level, aoMode)!;
      fx.render(); fx.dispose();
      // r186 owns 11 Bloom targets, 1 GTAO target and the colour scene pass.
      // Alto and indirect AO need another single-sample normal/depth pass.
      // Master additionally owns 2 TRAA targets and its formerly implicit colour RTT.
      const expected = 13 + (aoMode === "indireta" || level === "alto" ? 1 : 0) + (level === "master" ? 3 : 0);
      assert.equal(targets.length, expected); assert.equal(new Set(targets).size, expected);
      assert.equal(targets.filter(target => target.texture.name === "GTAONode.AO").length, 1);
      assert.equal(targets.filter(target => target.texture.name.startsWith("UnrealBloomPass.")).length, 11);
      if (level === "master") {
        for (const name of ["TRAANode.history", "TRAANode.resolve"])
          assert.equal(targets.filter(target => target.texture.name === name).length, 1);
        const intermediate = targets.find(target => target.texture.name === "");
        assert.ok(intermediate); assert.equal(intermediate.depthBuffer, true, "the explicitly owned RTT retains baseline defaults");
      }
      assert.equal(textures.includes(f.texture), false); assert.equal(materials.includes(f.material), false);
      assert.equal(sharedGeometryDisposals, 0);
      const textureCount = textures.length, materialCount = materials.length;
      fx.dispose(); fx.render();
      assert.equal(targets.length, expected); assert.equal(textures.length, textureCount); assert.equal(materials.length, materialCount);
      assert.equal(render.mock.callCount(), 1, "a disposed graph cannot render again");
    });
  }
}

test("disposing an older graph does not dispose or suppress its replacement", t => {
  const f = fixture(), rendered: THREE.RenderPipeline[] = [];
  t.mock.method(THREE.RenderPipeline.prototype, "render", function (this: THREE.RenderPipeline) { rendered.push(this); });
  const first = createPostFx(f.renderer, f.scene, f.camera, "master")!;
  const replacement = createPostFx(f.renderer, f.scene, f.camera, "alto")!;
  first.render(); first.dispose(); replacement.render(); first.render(); replacement.render();
  assert.equal(rendered.length, 3); assert.notEqual(rendered[0], rendered[1]); assert.equal(rendered[1], rendered[2]);
  replacement.dispose();
});
