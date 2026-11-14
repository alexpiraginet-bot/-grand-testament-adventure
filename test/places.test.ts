// The places of the region against the world and episode data they are built from.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeHeights, Terrain, type HeightsFile, type WorldMeta } from "../src/terrain.ts";
import { discover, distanceToEdge, EDGE_NOTICE_M, highestNear, LOOKOUT_SEARCH_M, nearestUnfound, ORIGIN_LABEL, parseFound, PLACE_RADIUS_M,
  PLACE_NOTICE, placeNoticeOpacity, PLACES_VERSION, regionPlaces, serializeFound, windName } from "../src/places.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const ep = JSON.parse(read("src/data/mc-pescadores.json")) as { ref_pt: string; lugar: string; personagens: { id: string; ref: string; nome: string }[] };
const meta = JSON.parse(read("public/world/cafarnaum.json")) as WorldMeta;
const terrain = new Terrain(meta, decodeHeights(JSON.parse(read("public/world/cafarnaum-heights.json")) as HeightsFile));
const MARGIN = 60;                                              // main.ts movementMargin
const heightAt = (x: number, z: number) => terrain.heightAt(x, z);
const places = regionPlaces(meta, ep, heightAt, MARGIN);

test("the region's places: names and positions from the data, each with its kind of origin", () => {
  assert.deepEqual(places.map((p) => [p.id, p.nome, p.origem, p.ref]), [
    ["Capernaum", "Cafarnaum", "fonte", null],
    ["margem", "Margem do mar da Galileia", "passagem", "Marcos 1:16"],
    ["redes", "Redes de Simão e André", "passagem", "Marcos 1:16"],
    ["barco", "Barco de Zebedeu", "passagem", "Marcos 1:20"],
    ["mirante", "Mirante do mar da Galileia", "relevo", null],
  ]);
  const at = (id: string) => { const p = places.find((q) => q.id === id)!; return [p.x, p.z]; };
  assert.deepEqual(at("Capernaum"), [meta.places[0].x, meta.places[0].z]);
  assert.deepEqual(at("margem"), meta.points.beach);
  assert.deepEqual(at("redes"), meta.points.simao);
  assert.deepEqual(at("barco"), meta.points.barco_margem);
  for (const p of places) {
    assert.equal(p.radius, PLACE_RADIUS_M[p.origem]);
    assert.ok(ORIGIN_LABEL[p.origem]);
    assert.ok(terrain.inside(p.x, p.z, MARGIN), `${p.id} is inside the walkable square`);
    assert.ok(terrain.heightAt(p.x, p.z) > -0.55, `${p.id} can be reached without swimming`);
  }
  assert.equal(new Set(places.map((p) => p.id)).size, places.length);
});

test("the lookout is the highest ground within reach of the village, on the real relief", () => {
  const top = places.find((p) => p.id === "mirante")!;
  const c = meta.places[0];
  assert.ok(Math.hypot(top.x - c.x, top.z - c.z) <= LOOKOUT_SEARCH_M);
  const h = terrain.heightAt(top.x, top.z);
  // literal values from public/world/cafarnaum-heights.json (computed apart with Python): 45.24 m at (-264, -300)
  assert.deepEqual([top.x, top.z], [-264, -300]);
  assert.ok(Math.abs(h - 45.24) < 0.005, `height ${h}`);
  // nothing on the grid inside the circle is higher
  for (let z = -meta.size / 2; z <= meta.size / 2; z += meta.step) for (let x = -meta.size / 2; x <= meta.size / 2; x += meta.step)
    if (Math.hypot(x - c.x, z - c.z) <= LOOKOUT_SEARCH_M) assert.ok(terrain.heightAt(x, z) <= h + 1e-9);
  assert.ok(h > terrain.heightAt(c.x, c.z) + 30, "well above the village: a view over it and the lake");
  // a flat or drowned world has no lookout, and the margin is respected
  assert.equal(highestNear(() => 0, meta, { x: 0, z: 0 }, 400, MARGIN), null);
  assert.equal(highestNear(() => -3, meta, { x: 0, z: 0 }, 400, MARGIN), null);
  const edge = highestNear((x) => x, meta, { x: meta.size / 2, z: 0 }, 200, MARGIN)!;
  assert.ok(edge.x <= meta.size / 2 - MARGIN);
});

test("missing data leaves a place out instead of inventing it", () => {
  const none = regionPlaces(meta, { ref_pt: ep.ref_pt, lugar: ep.lugar }, heightAt, MARGIN);
  assert.deepEqual(none.map((p) => p.id), ["Capernaum", "mirante"]);
  const noSource = regionPlaces({ ...meta, places: [] }, ep, heightAt, MARGIN);
  assert.deepEqual(noSource.map((p) => p.id), ["margem", "redes", "barco"]);
});

test("finding a place: once, inside its radius, in the list's order", () => {
  const found = new Set<string>();
  const cap = places[0];
  assert.deepEqual(discover(places, found, { x: cap.x + cap.radius + 1, z: cap.z }), []);
  assert.deepEqual(discover(places, found, { x: cap.x + cap.radius - 1, z: cap.z }).map((p) => p.id), ["Capernaum"]);
  assert.deepEqual(discover(places, found, { x: cap.x, z: cap.z }), [], "not twice");
  const start = meta.points.start;
  assert.ok(Math.hypot(start[0] - cap.x, start[1] - cap.z) < cap.radius, "the walk begins inside the village's radius");
  const redes = places.find((p) => p.id === "redes")!;
  assert.deepEqual(discover(places, found, { x: redes.x, z: redes.z }).map((p) => p.id), ["redes"]);
  assert.deepEqual([...found], ["Capernaum", "redes"]);
});

test("what was found survives a reload and ignores anything it does not know", () => {
  const found = new Set(["redes", "Capernaum"]);
  const text = serializeFound(found, places);
  assert.equal(text, `{"v":${PLACES_VERSION},"ids":["Capernaum","redes"]}`, "stored in the list's order");
  assert.deepEqual([...parseFound(text, places)], ["Capernaum", "redes"]);
  for (const bad of [null, "", "{", "[]", "null", `{"v":2,"ids":["redes"]}`, `{"v":1,"ids":"redes"}`, `{"v":1}`])
    assert.equal(parseFound(bad, places).size, 0, String(bad));
  assert.deepEqual([...parseFound(`{"v":1,"ids":["redes",7,"lugar-que-nao-existe",null,"redes"]}`, places)], ["redes"]);
});

test("the edge of the region: distance to the limit of the walkable square", () => {
  const half = meta.size / 2;
  assert.equal(distanceToEdge(meta.size, MARGIN, 0, 0), half - MARGIN);
  assert.equal(distanceToEdge(meta.size, MARGIN, 0, -(half - MARGIN)), 0);
  assert.equal(distanceToEdge(meta.size, MARGIN, half - MARGIN - 10, 200), 10);
  assert.ok(distanceToEdge(meta.size, MARGIN, half, 0) < 0);
  // the same limit the game's collision uses
  assert.equal(terrain.inside(0, -(half - MARGIN) + 0.01, MARGIN), true);
  assert.equal(terrain.inside(0, -(half - MARGIN) - 0.01, MARGIN), false);
  assert.ok(EDGE_NOTICE_M > 0 && EDGE_NOTICE_M < 100);
});

test("the nearest place still to find, and the wind it lies to", () => {
  const start = { x: meta.points.start[0], z: meta.points.start[1] };
  const all = new Set(places.map((p) => p.id));
  assert.equal(nearestUnfound(places, all, start), null);
  const butLookout = new Set(["Capernaum", "margem", "redes", "barco"]);
  const next = nearestUnfound(places, butLookout, start)!;
  assert.equal(next.place.id, "mirante");
  // literal: from the start (-9.1, 35.1) to the lookout (-264, -300) is sqrt(254.9² + 335.1²) = 421.03 m, north-west
  assert.ok(Math.abs(next.dist - 421.03) < 0.005, `distance ${next.dist}`);
  assert.equal(windName(next.place.x - start.x, next.place.z - start.z), "noroeste");
  assert.equal(nearestUnfound(places, new Set(), start)!.place.id, "Capernaum", "with nothing found, the village he stands in");
  // x grows east, z grows south
  assert.deepEqual([[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]].map(([dx, dz]) => windName(dx, dz)),
    ["norte", "nordeste", "leste", "sudeste", "sul", "sudoeste", "oeste", "noroeste"]);
  assert.equal(windName(1, -3), "norte", "within 22.5° of north");
  assert.equal(windName(-0.01, 1), "sul");
});

test("the place notice comes in, stays and goes out in game time", () => {
  assert.deepEqual(PLACE_NOTICE, { stay: 6, fadeIn: 0.3, fadeOut: 0.7 });
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);
  near(placeNoticeOpacity(6), 0.2);            // just found: already there, faint
  near(placeNoticeOpacity(5.85), 0.6);         // half of the 0.3 s in: 0.2 + 0.8 * 0.5
  near(placeNoticeOpacity(5.7), 1);            // in
  near(placeNoticeOpacity(3), 1);
  near(placeNoticeOpacity(0.7), 1);            // about to go
  near(placeNoticeOpacity(0.35), 0.5);         // half of the 0.7 s out
  assert.equal(placeNoticeOpacity(0), 0);
  assert.equal(placeNoticeOpacity(-1), 0);
  assert.equal(placeNoticeOpacity(Number.NaN), 0);
  // less motion: no fade, there or gone
  assert.equal(placeNoticeOpacity(6, true), 1);
  assert.equal(placeNoticeOpacity(0.1, true), 1);
  assert.equal(placeNoticeOpacity(0, true), 0);
  // never outside 0..1, whatever the time left
  for (let left = -1; left <= 7; left += 0.05) { const o = placeNoticeOpacity(left); assert.ok(o >= 0 && o <= 1); }
});
