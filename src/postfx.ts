// Post-processing toward the reference image, built only from three's own TSL nodes (r186, already a dependency).
// Off by default: ?fx=alto or ?fx=master turns it on so tools/bench.mjs can measure it against the plain render on the
// same shots. It becomes a default only after that measurement on the RTX PC and on physical phones
// (docs/GRAFICO-MASTER.md). Nothing here changes the scene, its meshes or its data.
import * as THREE from "three/webgpu";
import { builtinAOContext, float, mix, mrt, normalView, output, packNormalToRGB, pass, rtt, sample, screenUV, unpackRGBToNormal, vec4, velocity } from "three/tsl";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { traa } from "three/addons/tsl/display/TRAANode.js";

/** off: the direct render the game shipped with. alto: ambient occlusion + bloom, MSAA kept.
 *  master: preserves the baseline TRAA with single-sample depth and a velocity buffer.
 *  R11 rejected the SMAA replacement after visible GTAO noise on water and the horizon.
 *  The earlier software-renderer water defect was not reproduced in the static RTX baseline.
 *  Both presets remain experimental and opt-in; TRAA here is not super-resolution or DLSS. */
export type FxLevel = "off" | "alto" | "master";

export function parseFx(value: string | null | undefined): FxLevel {
  return value === "alto" || value === "master" ? value : "off";
}

/** Where the occlusion goes. final: multiplies the finished colour, sunlit surfaces included (the shipped alto).
 *  indireta (?ao=indireta): a depth + normal pre-pass feeds GTAO, and the lit pass applies it only to the materials'
 *  ambient and indirect light (three's builtinAOContext), so the sun is never darkened. Costs a second geometry pass. */
export type AoMode = "final" | "indireta";

export function parseAo(value: string | null | undefined): AoMode {
  return value === "indireta" ? "indireta" : "final";
}

/** Tunables kept together so a measurement names exactly what it measured. */
export const FX_SETTINGS = {
  aoStrength: 0.85,        // 0 = no occlusion, 1 = full GTAO factor on the lit colour
  aoResolution: 0.5,       // GTAO at half resolution (the node's own resolutionScale)
  aoRadius: 0.6,           // metres
  bloomStrength: 0.12,
  bloomRadius: 0.35,
  bloomThreshold: 0.95,    // linear luminance; the LDR sky panorama stays under it
} as const;

export type PostFx = {
  level: FxLevel;
  ao: AoMode;
  antialiasing: "msaa4" | "traa";
  temporal: boolean;
  render(): void;
  dispose(): void;
};

type OwnedEffect = { dispose(): void };

/** GTAO uses textureGather on depth in r186. A multisampled depth attachment
 * is not a valid input on WebGPU, even when the colour attachment is resolved.
 * Opaque-only also keeps the normal and depth describing the same surface. */
function normalDepthPass(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  const prePass = pass(scene, camera, { samples: 0 });
  prePass.name = "postfx-opaque-normal-depth";
  prePass.transparent = false;
  prePass.setMRT(mrt({ output: normalView }));
  return prePass;
}

/** Explicit ownership: RenderPipeline.dispose() only frees its screen material in r186.
 * Never traverse the scene or recursively dispose textures from an input pass. */
function finishPipeline(renderer: THREE.WebGPURenderer, level: FxLevel, aoMode: AoMode,
  composite: THREE.Node, resources: OwnedEffect[], scenePass: THREE.PassNode, camera: THREE.PerspectiveCamera): PostFx {
  const owned = new Set(resources);
  let outputNode = composite;
  if (level === "master") {
    // Same RTT defaults and TRAA colour/depth/velocity inputs as the baseline.
    // Own the formerly implicit RTT explicitly: TRAANode.dispose() does not free it.
    const input = rtt(composite);
    const antialias = traa(input, scenePass.getTextureNode("depth"), scenePass.getTextureNode("velocity"), camera);
    owned.add(input); owned.add(antialias);
    outputNode = antialias;
  }
  let pipeline: THREE.RenderPipeline | null = new THREE.RenderPipeline(renderer);
  // Preserve the baseline: linear effects before the final tone/colour conversion.
  pipeline.outputNode = outputNode;
  return {
    level, ao: aoMode, antialiasing: level === "master" ? "traa" : "msaa4", temporal: level === "master",
    render: () => { pipeline?.render(); },
    dispose: () => {
      const active = pipeline;
      if (!active) return;
      pipeline = null;
      active.dispose();
      // Consumers before inputs; each owned node releases its internal targets.
      for (const effect of [...owned].reverse()) effect.dispose();
      owned.clear();
    },
  };
}

/** The render pipeline for `level`, or null for "off" (the caller then renders directly, as before). */
export function createPostFx(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, level: FxLevel,
  aoMode: AoMode = "final"): PostFx | null {
  if (level === "off") return null;
  if (aoMode === "indireta") return indirectAo(renderer, scene, camera, level);
  const s = FX_SETTINGS;
  // Alto retains MSAA4 colour. Its single-sample normal/depth prepass avoids
  // GTAO's invalid WGSL textureGather(texture_depth_multisampled_2d, ...).
  // Master has no MSAA, so it can keep the original one-pass normal MRT path.
  const prePass = level === "alto" ? normalDepthPass(scene, camera) : null;
  const scenePass = pass(scene, camera, { samples: level === "master" ? 0 : 4 });
  if (!prePass) scenePass.setMRT(mrt({ output, normal: packNormalToRGB(normalView), velocity }));
  const color = scenePass.getTextureNode("output");
  const depth = (prePass ?? scenePass).getTextureNode("depth");
  // GTAO samples the normal itself (normalNode.sample(uv)), so hand it a sampler that unpacks, not an unpacked value
  const packedNormal = prePass ? null : scenePass.getTextureNode("normal");
  const normal = prePass ? prePass.getTextureNode()
    : sample((uv) => unpackRGBToNormal(packedNormal!.sample(uv)));

  const occlusion = ao(depth, normal, camera);
  occlusion.resolutionScale = s.aoResolution;
  occlusion.radius.value = s.aoRadius;
  const aoFactor = mix(float(1), occlusion.getTextureNode().r, float(s.aoStrength));
  const lit = vec4(color.rgb.mul(aoFactor), color.a);
  const glow = bloom(lit, s.bloomStrength, s.bloomRadius, s.bloomThreshold);
  return finishPipeline(renderer, level, "final", lit.add(glow), [...(prePass ? [prePass] : []), scenePass, occlusion, glow], scenePass, camera);
}

/** ?ao=indireta: the pattern of three's GTAONode documentation (r186). The pre-pass draws the scene once more, writing
 * only depth and the view-space normal (half-float target, so no packing); transparent materials, like the lake, are
 * left without occlusion by builtinAOContext itself. Same strength, radius and bloom as "final". */
function indirectAo(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, level: FxLevel): PostFx {
  const s = FX_SETTINGS;
  const prePass = normalDepthPass(scene, camera);
  const occlusion = ao(prePass.getTextureNode("depth"), prePass.getTextureNode(), camera);
  occlusion.resolutionScale = s.aoResolution;
  occlusion.radius.value = s.aoRadius;
  const aoFactor = mix(float(1), occlusion.getTextureNode().sample(screenUV).r, float(s.aoStrength));

  const scenePass = pass(scene, camera, { samples: level === "master" ? 0 : 4 });
  if (level === "master") scenePass.setMRT(mrt({ output, velocity }));
  scenePass.contextNode = builtinAOContext(aoFactor);
  const color = scenePass.getTextureNode("output");
  const glow = bloom(color, s.bloomStrength, s.bloomRadius, s.bloomThreshold);
  return finishPipeline(renderer, level, "indireta", color.add(glow), [prePass, scenePass, occlusion, glow], scenePass, camera);
}
