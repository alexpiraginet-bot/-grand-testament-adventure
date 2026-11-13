// Post-processing toward the reference image, built only from three's own TSL nodes (r186, already a dependency).
// Off by default: ?fx=alto or ?fx=master turns it on so tools/bench.mjs can measure it against the plain render on the
// same shots. It becomes a default only after that measurement on the RTX PC and on physical phones
// (docs/GRAFICO-MASTER.md). Nothing here changes the scene, its meshes or its data.
import * as THREE from "three/webgpu";
import { float, mix, mrt, normalView, output, packNormalToRGB, pass, sample, unpackRGBToNormal, vec4, velocity } from "three/tsl";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { traa } from "three/addons/tsl/display/TRAANode.js";

/** off: the direct render the game shipped with. alto: ambient occlusion + bloom, MSAA kept.
 *  master: the same plus temporal anti-aliasing (TRAA), which needs MSAA off and a velocity buffer. */
export type FxLevel = "off" | "alto" | "master";

export function parseFx(value: string | null | undefined): FxLevel {
  return value === "alto" || value === "master" ? value : "off";
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

export type PostFx = { level: FxLevel; render(): void; dispose(): void };

/** The render pipeline for `level`, or null for "off" (the caller then renders directly, as before). */
export function createPostFx(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, level: FxLevel): PostFx | null {
  if (level === "off") return null;
  const s = FX_SETTINGS;
  // One scene pass writes colour, view-space normal and (for TRAA) motion; no second geometry pass.
  const scenePass = pass(scene, camera, { samples: level === "master" ? 0 : 4 });
  scenePass.setMRT(mrt(level === "master"
    ? { output, normal: packNormalToRGB(normalView), velocity }
    : { output, normal: packNormalToRGB(normalView) }));
  const color = scenePass.getTextureNode("output");
  const depth = scenePass.getTextureNode("depth");
  // GTAO samples the normal itself (normalNode.sample(uv)), so hand it a sampler that unpacks, not an unpacked value
  const packedNormal = scenePass.getTextureNode("normal");
  const normal = sample((uv) => unpackRGBToNormal(packedNormal.sample(uv)));

  const occlusion = ao(depth, normal, camera);
  occlusion.resolutionScale = s.aoResolution;
  occlusion.radius.value = s.aoRadius;
  const aoFactor = mix(float(1), occlusion.getTextureNode().r, float(s.aoStrength));
  const lit = vec4(color.rgb.mul(aoFactor), color.a);
  const glow = bloom(lit, s.bloomStrength, s.bloomRadius, s.bloomThreshold);
  let out = lit.add(glow);
  if (level === "master") out = traa(out, depth, scenePass.getTextureNode("velocity"), camera);

  const pipeline = new THREE.RenderPipeline(renderer);
  pipeline.outputNode = out;
  return { level, render: () => pipeline.render(), dispose: () => { pipeline.dispose(); scenePass.dispose(); } };
}
