// Look options under measurement, each behind its own flag, so tools/bench.mjs can compare them with the shipped render
// on the same shots. Without the flags the game renders exactly as before: ACES at exposure 1.08, the linear
// THREE.Fog (400 m to 16 km) and one 56 m shadow box that follows the hero.
//   ?tm=aces|agx|neutral|off   tone curve           ?exp=0.25..4   exposure (three ignores it with tm=off)
//   ?atmo=1                    height + distance haze, warmer toward the sun (one fog node, no extra draw call)
//   ?shadow=csm                three cascaded sun shadows out to CSM_SPLITS.far, instead of the single box
// Defaults change only after the measurement on the RTX PC and on physical phones, with Alex's OK (docs/PLANO-AAA.md).
import * as THREE from "three/webgpu";
import { cameraPosition, color, dot, exp, float, fog, max, mix, normalize, positionWorld, pow, select, uniform } from "three/tsl";
import { CSMShadowNode } from "three/addons/csm/CSMShadowNode.js";

export type Tone = "aces" | "agx" | "neutral" | "off";
export const TONE_MAPPING: Record<Tone, THREE.ToneMapping> = {
  aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping, off: THREE.NoToneMapping,
};
export const DEFAULT_EXPOSURE = 1.08;

export function parseTone(value: string | null | undefined): Tone {
  return value === "agx" || value === "neutral" || value === "off" ? value : "aces";
}

/** ?exp=: a finite number, clamped to [0.25, 4]; anything else keeps the shipped exposure. */
export function parseExposure(value: string | null | undefined): number {
  if (value === null || value === undefined || value.trim() === "") return DEFAULT_EXPOSURE;
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(4, Math.max(0.25, n)) : DEFAULT_EXPOSURE;
}

export const parseAtmo = (value: string | null | undefined): boolean => value === "1";

export type ShadowMode = "box" | "csm";
export const parseShadow = (value: string | null | undefined): ShadowMode => (value === "csm" ? "csm" : "box");

/** The haze, in the world's units (metres, y = 0 at the lake surface). Chosen, not measured: about 8% of the light is
 * lost over 1 km at lake level and about half over 10 km (the far shore), thinning with height (scale height 1.2 km),
 * so the hills stand out of a lower haze. The colour is the shipped fog colour, so the horizon still meets the sky. */
export const ATMO = {
  sigma0: 8e-5,          // extinction per metre at y = 0
  scaleHeight: 1200,     // metres for the density to fall by e
  haze: 0x9daab9,        // the shipped THREE.Fog colour
  sunTint: 0xffe2b8,     // the haze looking toward the sun
  sunLobe: 4,            // exponent of the forward-scattering lobe
  sunMix: 0.6,           // at most this much of sunTint, straight at the sun
} as const;

/** Optical depth from (y0) to a point dist metres away at height y1, through density sigma0·exp(-y/H). The closed form
 * of the integral; when the two heights almost match it falls back to the constant density at their mean height. */
export function opticalDepth(dist: number, y0: number, y1: number, sigma0 = ATMO.sigma0, H = ATMO.scaleHeight): number {
  const a = Math.max(y0, 0), b = Math.max(y1, 0);   // below the lake surface counts as at it
  const dy = b - a;
  if (Math.abs(dy) < 1e-3) return sigma0 * dist * Math.exp(-(a + b) / 2 / H);
  return sigma0 * dist * H * (Math.exp(-a / H) - Math.exp(-b / H)) / dy;
}

/** Fraction of the haze colour mixed in: 1 - transmittance. */
export const hazeAmount = (dist: number, y0: number, y1: number): number => 1 - Math.exp(-opticalDepth(dist, y0, y1));

/** scene.fogNode for ?atmo=1: the same formula as opticalDepth/hazeAmount, per pixel, in TSL. */
export function atmosphereFog(sunDir: THREE.Vector3) {
  const sun = uniform(sunDir.clone().normalize());
  const sigma0 = float(ATMO.sigma0), H = float(ATMO.scaleHeight);
  const toPoint = positionWorld.sub(cameraPosition);
  const dist = toPoint.length();
  const y0 = max(cameraPosition.y, 0), y1 = max(positionWorld.y, 0);
  const dy = y1.sub(y0);
  const flat = sigma0.mul(dist).mul(exp(y0.add(y1).mul(-0.5).div(H)));
  const slope = sigma0.mul(dist).mul(H).mul(exp(y0.negate().div(H)).sub(exp(y1.negate().div(H)))).div(dy);
  const depth = select(dy.abs().lessThan(1e-3), flat, slope);
  const amount = float(1).sub(exp(depth.negate()));
  const lobe = pow(max(dot(normalize(toPoint), sun), 0), ATMO.sunLobe).mul(ATMO.sunMix);
  const tint = mix(color(ATMO.haze), color(ATMO.sunTint), lobe);
  return fog(tint, amount);
}

/** Cascade ends as fractions of CSM_SPLITS.far: about 24 m, 120 m and 600 m from the camera. The first cascade stays
 * close to the hero so its texels are not much coarser than the shipped 56 m box. */
export const CSM_SPLITS = { far: 600, breaks: [0.04, 0.2, 1] } as const;

/** Light-space depth of every cascade camera. CSMShadowNode puts each cascade's light lightMargin metres sunward of its
 * slice and only fits left/right/top/bottom, never near/far, so each clone keeps the box's own far (220 m) unless it
 * is set here: then everything past the first 20 m of a slice falls outside the shadow camera and is drawn lit. The
 * deepest slice spans up to 2 x CSM_SPLITS.far in light space (a sideways view), hence margin + 2 x far. */
export const CSM_LIGHT = { margin: 200, near: 1, far: 200 + 2 * CSM_SPLITS.far } as const;

/** ?shadow=csm: three cascades from the sun replace the single box. Each cascade clones sun.shadow (map size, bias,
 * camera), so the caller sets a map size that fits three of them; this sets the camera's depth range (CSM_LIGHT) and
 * rescales the bias, which is in normalised depth, so it stays the same distance in metres. The caller keeps the node
 * and calls updateFrustums() after the view camera's fov or aspect change. */
export function cascadedShadows(sun: THREE.DirectionalLight): CSMShadowNode {
  const cam = sun.shadow.camera;
  const metres = sun.shadow.bias * (cam.far - cam.near);
  cam.near = CSM_LIGHT.near; cam.far = CSM_LIGHT.far; cam.updateProjectionMatrix();
  sun.shadow.bias = metres / (CSM_LIGHT.far - CSM_LIGHT.near);
  const csm = new CSMShadowNode(sun, {
    cascades: CSM_SPLITS.breaks.length, maxFar: CSM_SPLITS.far, mode: "custom", lightMargin: CSM_LIGHT.margin,
    customSplitsCallback: (_n, _near, _far, breaks) => { breaks.push(...CSM_SPLITS.breaks); },
  });
  csm.fade = true;
  sun.shadow.shadowNode = csm;
  return csm;
}
