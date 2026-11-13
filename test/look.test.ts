import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three/webgpu";
import { ATMO, cascadedShadows, CSM_LIGHT, CSM_SPLITS, DEFAULT_EXPOSURE, hazeAmount, opticalDepth, parseAtmo, parseExposure, parseShadow, parseTone,
  TONE_MAPPING } from "../src/look.ts";

test("look flags: anything unknown keeps the shipped render", () => {
  assert.equal(parseTone(null), "aces");
  assert.equal(parseTone("agx"), "agx"); assert.equal(parseTone("neutral"), "neutral"); assert.equal(parseTone("off"), "off");
  assert.equal(parseTone("AGX"), "aces"); assert.equal(parseTone("reinhard"), "aces");
  assert.equal(TONE_MAPPING.aces, THREE.ACESFilmicToneMapping);
  assert.equal(TONE_MAPPING.agx, THREE.AgXToneMapping);
  assert.equal(TONE_MAPPING.neutral, THREE.NeutralToneMapping);
  assert.equal(TONE_MAPPING.off, THREE.NoToneMapping);

  assert.equal(DEFAULT_EXPOSURE, 1.08);
  assert.equal(parseExposure(null), 1.08); assert.equal(parseExposure(""), 1.08); assert.equal(parseExposure("abc"), 1.08);
  assert.equal(parseExposure("Infinity"), 1.08);
  assert.equal(parseExposure("1.3"), 1.3); assert.equal(parseExposure("0"), 0.25); assert.equal(parseExposure("9"), 4);

  assert.equal(parseAtmo("1"), true); assert.equal(parseAtmo(null), false); assert.equal(parseAtmo("0"), false);
  assert.equal(parseAtmo("true"), false);
  assert.equal(parseShadow("csm"), "csm"); assert.equal(parseShadow(null), "box"); assert.equal(parseShadow("CSM"), "box");
});

test("haze: the numbers the comment in look.ts promises, at lake level", () => {
  // literal values: 1 - exp(-8e-5 * 1000) and 1 - exp(-8e-5 * 10000)
  assert.ok(Math.abs(hazeAmount(1000, 0, 0) - 0.07688365361336424) < 1e-12);
  assert.ok(Math.abs(hazeAmount(10000, 0, 0) - 0.5506710358827784) < 1e-12);
  assert.equal(hazeAmount(0, 0, 0), 0);
  assert.equal(ATMO.haze, 0x9daab9, "same colour as the shipped THREE.Fog, so the horizon still meets the sky");
});

test("haze: closed form against a numeric integral, continuous where the two heights meet", () => {
  // look.ts counts a point below the lake surface (the bed seen through the water) as at the surface, so the reference
  // integrates along the straight segment between the two clamped ends
  const numeric = (d: number, y0: number, y1: number) => {
    let s = 0; const n = 20000; const a = Math.max(y0, 0), b = Math.max(y1, 0);
    for (let i = 0; i < n; i++) { const y = a + (b - a) * (i + 0.5) / n; s += ATMO.sigma0 * Math.exp(-y / ATMO.scaleHeight); }
    return s * d / n;
  };
  for (const [d, y0, y1] of [[10000, 2, 400], [3000, 30, 0], [500, 1.6, 1.6], [15000, 600, -5]]) {
    const exact = opticalDepth(d, y0, y1), approx = numeric(d, y0, y1);
    assert.ok(Math.abs(exact - approx) / approx < 1e-6, `${d} m, ${y0}→${y1}: ${exact} vs ${approx}`);
  }
  // either side of the switch to the flat formula (|dy| < 1 mm): the two heights differ by 0.2 mm, so the true change is
  // ~1e-7 of the value; a wrong flat branch would jump by far more than 1e-6
  const flat = opticalDepth(5000, 100, 100.0009), closed = opticalDepth(5000, 100, 100.0011);
  assert.ok(Math.abs(flat - closed) / closed < 1e-6, `${flat} vs ${closed}`);
});

test("haze: thicker with distance, thinner with height", () => {
  let last = -1;
  for (const d of [10, 100, 1000, 5000, 20000]) { const h = hazeAmount(d, 2, 2); assert.ok(h > last); last = h; }
  assert.ok(hazeAmount(10000, 2, 600) < hazeAmount(10000, 2, 2), "a hilltop 10 km away is clearer than the lake at 10 km");
  assert.ok(hazeAmount(30, 1.6, 1.6) < 0.003, "the hero, 30 m away, gets no visible haze");
});

test("cascades: increasing breaks that end at the far limit", () => {
  assert.equal(CSM_SPLITS.breaks.at(-1), 1);
  for (let i = 1; i < CSM_SPLITS.breaks.length; i++) assert.ok(CSM_SPLITS.breaks[i] > CSM_SPLITS.breaks[i - 1]);
  assert.ok(CSM_SPLITS.breaks[0] * CSM_SPLITS.far <= 28, "the first cascade is no deeper than the shipped 56 m box's half-width");
});

test("cascades: the shadow camera holds the margin and the deepest slice; the bias keeps its length in metres", () => {
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  const c = sun.shadow.camera; c.near = 1; c.far = 220; c.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  const metres = -0.0004 * 219;
  const csm = cascadedShadows(sun);
  assert.equal(c.near, CSM_LIGHT.near); assert.equal(c.far, CSM_LIGHT.far);
  assert.equal(CSM_LIGHT.far, CSM_LIGHT.margin + 2 * CSM_SPLITS.far, "margin plus the deepest slice seen sideways");
  assert.ok(CSM_LIGHT.far > 220 + 1000, "far beyond the 220 m that left the cascades unshadowed");
  assert.ok(Math.abs(sun.shadow.bias * (c.far - c.near) - metres) < 1e-12, "same bias in metres");
  assert.equal(c.projectionMatrix.elements[10], -2 / (c.far - c.near), "projection rebuilt with the new range");
  assert.equal(sun.shadow.shadowNode, csm); assert.equal(csm.cascades, 3); assert.equal(csm.lightMargin, CSM_LIGHT.margin);
  assert.equal(csm.fade, true);
});
