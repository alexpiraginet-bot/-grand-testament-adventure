// The twelve places of the story on the real terrain, against the town's colliders rebuilt as the game builds them:
// each can be stood on by the game's own movement rule, none is near the region's edge notice, and every one can be
// walked to from the village (a flood fill by a rule stricter than the hero's, so a way found here is a way in play).
import { test } from "node:test";
import assert from "node:assert/strict";
import { MARGIN, P, beach, routes, scene, start, t } from "./fixtures/town-scene.ts";
import { townLife, boxIndex, TOWN_LIFE } from "../src/town-life-layout.ts";
import { STORY_PLACES, storyPlaces, type StoryPlacesInput } from "../src/story-places.ts";
import { STORY_STEPS, type StoryPlaceId } from "../src/story-steps.ts";
import { STORY } from "../src/story-journey.ts";
import { EDGE_NOTICE_M, distanceToEdge } from "../src/places.ts";
import { buildingPoint, distanceToSegment, type Obstacle } from "../src/world-layout.ts";
import type { Vec2 } from "../src/missions.ts";

const nets = { x: P.simao[0], z: P.simao[1] }, boat = { x: P.barco_margem[0], z: P.barco_margem[1] };
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const SHORE: StoryPlaceId[] = ["praia", "redes", "barco"];

function build(segments: number) {
  const town = scene(segments);
  const life = townLife({ terrain: t, start, beach, routes, plans: town.plans, boxes: town.boxes, margin: MARGIN });
  assert.ok(life?.onward, "the town has a yard, a street and a house");
  const input: StoryPlacesInput = { terrain: t, routes, plans: town.plans, boxes: town.boxes, margin: MARGIN, beach, nets, boat, house: life.onward };
  return { town, life, input, places: storyPlaces(input) };
}
/** main.ts `blocked`, without the follower's body: the hero cannot be here. */
const heroBlocked = (boxes: readonly Obstacle[]) => (x: number, z: number) => {
  if (!t.inside(x, z, MARGIN) || t.heightAt(x, z) < -0.55) return true;
  for (const b of boxes) {
    const c = Math.cos(b.rot), s = Math.sin(b.rot), dx = x - b.x, dz = z - b.z;
    if (Math.abs(dx * c - dz * s) < b.hx + 0.3 && Math.abs(dx * s + dz * c) < b.hz + 0.3) return true;
  }
  return false;
};

const main = build(256);

test("the twelve places are found on the real ground, the same for both ground resolutions", () => {
  assert.ok(main.places);
  assert.equal(main.places.revision, "story-places-r16");
  assert.deepEqual(Object.keys(main.places.at).sort(), [...new Set(STORY_STEPS.map((s) => s.place))].sort(), "one place for every place a step names");
  assert.equal(Object.keys(main.places.at).length, 12);
  assert.deepEqual(storyPlaces(main.input), main.places, "computed twice, the same");
  const low = build(192);
  assert.deepEqual(low.places, main.places, "the low ground's colliders give the same places");
});

test("every place can be stood on by the hero's own rule, clear of colliders and away from the edge notice", () => {
  const blocked = heroBlocked(main.town.boxes), index = boxIndex(main.town.boxes);
  for (const [id, p] of Object.entries(main.places!.at) as [StoryPlaceId, Vec2][]) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), id);
    assert.equal(blocked(p.x, p.z), false, `${id} is not blocked`);
    assert.ok(index.clearance(p.x, p.z, 4) >= TOWN_LIFE.doorClear - 1e-9, `${id} has free ground around`);
    assert.ok(distanceToEdge(t.meta.size, MARGIN, p.x, p.z) >= STORY_PLACES.edge, `${id} is far from the region's edge`);
    assert.ok(STORY_PLACES.edge > EDGE_NOTICE_M + STORY.radius + STORY.leave, "no step is lived under the edge notice");
    const h = t.heightAt(p.x, p.z);
    if (SHORE.includes(id)) assert.ok(h >= STORY_PLACES.wade && h < 0.3, `${id} is at the water's edge (${h.toFixed(2)})`);
    else assert.ok(h >= TOWN_LIFE.dry, `${id} is on dry ground (${h.toFixed(2)})`);
    // around it too: the ring where a step is offered has ground the hero can stand on in most directions
    let free = 0;
    for (let k = 0; k < 24; k++) if (!blocked(p.x + Math.sin((k * Math.PI) / 12) * 3, p.z + Math.cos((k * Math.PI) / 12) * 3)) free++;
    assert.ok(free >= 12, `${id}: ${free} of 24 directions are free at 3 m`);
  }
});

test("each place is what its rule says", () => {
  const { at, leviHouse } = main.places!, { town, life } = main, index = boxIndex(town.boxes), S = STORY_PLACES;
  const offRoutes = (p: Vec2) => Math.min(...routes.map((s) => distanceToSegment(p.x, p.z, s)));
  assert.deepEqual(at.casa, life!.onward!.at, "the house is the one the town's layout chose for Mark 1:29");
  assert.deepEqual(at.praia, beach); assert.deepEqual(at.redes, nets); assert.deepEqual(at.barco, boat);
  // the street before the door: on the lane, a walk from the door
  assert.ok(offRoutes(at["rua-da-casa"]) < 1e-6, "the street point is on the lane");
  assert.ok(dist(at["rua-da-casa"], at.casa) >= S.apart && dist(at["rua-da-casa"], at.casa) < S.apart + 2);
  // the solitary place: no collider near, off every route, farther than the street
  assert.ok(index.clearance(at["lugar-deserto"].x, at["lugar-deserto"].z, 200) >= S.solitary);
  assert.ok(offRoutes(at["lugar-deserto"]) >= S.solitaryOffRoute);
  assert.ok(dist(at["lugar-deserto"], at.casa) > S.solitary);
  // where they find him: between it and the house
  assert.ok(Math.abs(dist(at.encontro, at["lugar-deserto"]) - S.meet) < 1e-6);
  assert.ok(dist(at.encontro, at.casa) < dist(at["lugar-deserto"], at.casa));
  // the road out: clearly farther from the house; the leper's spot back from it
  assert.ok(dist(at["caminho-das-aldeias"], at.casa) >= dist(at["lugar-deserto"], at.casa) + S.roadOut);
  assert.ok(index.clearance(at["caminho-das-aldeias"].x, at["caminho-das-aldeias"].z, 200) >= S.roadClear);
  assert.ok(Math.abs(dist(at.caminho, at["caminho-das-aldeias"]) - S.leper) < 1e-6);
  assert.ok(dist(at.caminho, at.casa) < dist(at["caminho-das-aldeias"], at.casa));
  // the post: beside the shore road, a walk from the beach
  assert.ok(offRoutes(at.posto) <= S.postAside && dist(at.posto, at.praia) >= S.post - S.postAside);
  // the second house: another house's door
  assert.notEqual(leviHouse, life!.onward!.house);
  const plan = town.plans[leviHouse];
  assert.deepEqual(at["casa-de-levi"], buildingPoint(plan, 0, plan.d / 2 + TOWN_LIFE.doorFront));
  assert.ok(dist(at["casa-de-levi"], at.casa) >= S.leviApart);
  assert.ok(dist(at["casa-de-levi"], at.posto) <= S.leviFar);
  // the mount rises above the lake, and nothing nearer to the boat's shore does
  assert.ok(t.heightAt(at.monte.x, at.monte.z) >= S.mountRise);
  assert.ok(t.slopeAt(at.monte.x, at.monte.z) <= S.mountSlope);
  const near = dist(at.monte, at.barco);
  for (let x = Math.ceil((boat.x - near) / S.grid) * S.grid; x <= boat.x + near; x += S.grid)
    for (let z = Math.ceil((boat.z - near) / S.grid) * S.grid; z <= boat.z + near; z += S.grid)
      if (dist({ x, z }, boat) < near - 1e-6 && t.inside(x, z, MARGIN + S.edge) && t.slopeAt(x, z) <= S.mountSlope && index.clearance(x, z, S.mountClear) >= S.mountClear)
        assert.ok(t.heightAt(x, z) < S.mountRise, `(${x}, ${z}) is nearer and as high`);
});

test("the second house is another house: not one beside the post, by the beach or at the first house's door", () => {
  const { at, leviHouse } = main.places!, { input, town, life } = main, S = STORY_PLACES;
  /** A house (not among the colliders) whose door point is exactly `door`. */
  const houseAt = (door: Vec2) => ({ ...town.plans[leviHouse], x: door.x, z: door.z - 3 - TOWN_LIFE.doorFront, d: 6, rot: 0 });
  const withHouse = (door: Vec2) => storyPlaces({ ...input, plans: [...town.plans, houseAt(door)] })!;
  const added = town.plans.length;
  // a door point the rules of standing accept (dry, open, gentle), found on the real ground by a further condition
  const index = boxIndex(town.boxes), reach = dist(at["casa-de-levi"], at.posto);
  const find = (ok: (p: Vec2) => boolean): Vec2 => {
    for (let x = -140; x <= 10; x++) for (let z = 290; z <= 345; z++) {
      const p = { x, z };
      if (t.heightAt(x, z) >= TOWN_LIFE.dry + 0.02 && index.clearance(x, z, 3) >= 2 && t.slopeAt(x, z) < 0.2 && ok(p)) return p;
    }
    throw new Error("no such point on this ground");
  };
  // a door right beside the post would be the nearest: it is not taken (the table is not the house)
  const beside = find((p) => dist(p, at.posto) > 4 && dist(p, at.posto) < S.leviNear - 2);
  assert.deepEqual(buildingPoint(houseAt(beside), 0, 3 + TOWN_LIFE.doorFront), beside);
  assert.equal(withHouse(beside).leviHouse, leviHouse);
  // a door nearer to the post than the chosen one, but by the beach where the step before it is lived: not taken
  const byBeach = find((p) => dist(p, at.praia) < S.apart - 0.5 && dist(p, at.posto) < reach - 1);
  assert.equal(withHouse(byBeach).leviHouse, leviHouse);
  // a door as near to the post, a little farther from the beach, is taken: the rule, not the ground, kept that one out
  const off = find((p) => dist(p, at.praia) >= S.apart + 1 && dist(p, at.praia) < S.apart + 8 && dist(p, at.posto) < reach - 1 && dist(p, at.posto) >= S.leviNear);
  assert.equal(withHouse(off).leviHouse, added);
  assert.deepEqual(withHouse(off).at["casa-de-levi"], off);
  // with no other house than one whose door is by the first house's door: no second house, no story
  const first = town.plans[life!.onward!.house], near = { x: at["rua-da-casa"].x, z: at["rua-da-casa"].z };
  assert.ok(dist(near, at.casa) < S.leviApart);
  assert.equal(storyPlaces({ ...input, plans: [first, houseAt(near)], house: { at: life!.onward!.at, house: 0 } }), null);
});

test("a step lived by arriving is always a walk away from the step before it", () => {
  const at = main.places!.at;
  STORY_STEPS.forEach((s, i) => {
    if (!i) return;
    const before = STORY_STEPS[i - 1], d = dist(at[s.place], at[before.place]);
    if (s.place === before.place) { assert.ok(s.action, `${s.id} at the same place needs its action`); return; }
    assert.ok(d >= 2 * STORY.radius + STORY.slack + 2, `${s.id}: ${d.toFixed(1)} m from ${before.id}: standing where the last step was lived is not yet at this one`);
    assert.ok(d > STORY.radius + STORY.leave, `${s.id}: its clauses are not on screen at the place of the step before`);
  });
});

test("every place can be walked to from where the walk begins, by a rule stricter than the hero's", () => {
  const { at } = main.places!, { town, life } = main, index = boxIndex(town.boxes), blocked = heroBlocked(town.boxes);
  // 1 m grid, 4 neighbours. A cell is open with a metre free of every collider and ground no deeper than the place
  // rule's own limit. Between two open neighbours the hero is never blocked: the distance to a box changes at most a
  // metre per metre (so it stays above 0.5, and his body takes 0.3), and the ground is linear along a grid line
  // inside one terrain cell (12 m, on integer metres), so it is never deeper than at the two ends.
  const x0 = -560, x1 = 140, z0 = -20, z1 = 620, nx = x1 - x0 + 1, nz = z1 - z0 + 1;
  const open = (x: number, z: number) => t.inside(x, z, MARGIN) && t.heightAt(x, z) >= -0.3 && index.clearance(x, z, 1.5) >= 1;
  const state = new Int8Array(nx * nz);                                   // 0 unknown, 1 open, -1 closed
  const ok = (i: number) => { if (!state[i]) state[i] = open(x0 + (i % nx), z0 + Math.floor(i / nx)) ? 1 : -1; return state[i] === 1; };
  /** The open cell nearest to a point, joined to it by a straight line the hero can walk. */
  const cellOf = (p: Vec2): number => {
    let best = -1, bd = Infinity;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const x = Math.round(p.x) + dx, z = Math.round(p.z) + dz;
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      const i = (z - z0) * nx + (x - x0), d = dist(p, { x, z });
      if (d >= bd || !ok(i)) continue;
      let clear = true;
      for (let k = 0; k <= 20 && clear; k++) clear = !blocked(p.x + ((x - p.x) * k) / 20, p.z + ((z - p.z) * k) / 20);
      if (clear) { bd = d; best = i; }
    }
    return best;
  };
  const from = cellOf(start);
  assert.ok(from >= 0, "the walk's beginning is on open ground");
  const seen = new Uint8Array(nx * nz), queue = new Int32Array(nx * nz);
  let head = 0, tail = 0;
  seen[from] = 1; queue[tail++] = from;
  while (head < tail) {
    const cur = queue[head++], ix = cur % nx, iz = Math.floor(cur / nx);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const jx = ix + dx, jz = iz + dz;
      if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
      const next = jz * nx + jx;
      if (!seen[next] && ok(next)) { seen[next] = 1; queue[tail++] = next; }
    }
  }
  assert.ok(tail > 100000, `the open ground is one large piece (${tail} m²)`);
  const targets: [string, Vec2][] = [["the yard", life!.court.at], ...(Object.entries(at) as [string, Vec2][])];
  for (const [id, p] of targets) {
    const cell = cellOf(p);
    assert.ok(cell >= 0, `${id} is joined to open ground`);
    assert.equal(seen[cell], 1, `${id} can be walked to from the start`);
  }
});

test("validity is by construction: a collider on a searched place moves it, one on a fixed place withholds the story", () => {
  const { at } = main.places!, { input } = main, crate = (p: Vec2, half = 3): Obstacle => ({ x: p.x, z: p.z, hx: half, hz: half, rot: 0 });
  // something built on the solitary place: another place is found, still solitary
  const moved = storyPlaces({ ...input, boxes: [...input.boxes, crate(at["lugar-deserto"])] });
  assert.ok(moved);
  assert.notDeepEqual(moved.at["lugar-deserto"], at["lugar-deserto"]);
  assert.ok(boxIndex([...input.boxes, crate(at["lugar-deserto"])]).clearance(moved.at["lugar-deserto"].x, moved.at["lugar-deserto"].z, 200) >= STORY_PLACES.solitary);
  // a crate where they find him (it is near the solitary place, which moves too): still free ground, still a
  // little back from the solitary place
  const beside = storyPlaces({ ...input, boxes: [...input.boxes, crate(at.encontro, 2)] });
  assert.ok(beside);
  assert.equal(heroBlocked([...input.boxes, crate(at.encontro, 2)])(beside.at.encontro.x, beside.at.encontro.z), false);
  assert.ok(Math.abs(dist(beside.at.encontro, beside.at["lugar-deserto"]) - STORY_PLACES.meet) <= STORY_PLACES.near);
  // a crate on the post: the nearest dry ground beside it, still beside the shore road
  const posted = storyPlaces({ ...input, boxes: [...input.boxes, crate(at.posto, 2)] });
  assert.ok(posted);
  assert.notDeepEqual(posted.at.posto, at.posto);
  assert.equal(heroBlocked([...input.boxes, crate(at.posto, 2)])(posted.at.posto.x, posted.at.posto.z), false);
  assert.ok(dist(posted.at.posto, at.posto) <= STORY_PLACES.postAside && t.heightAt(posted.at.posto.x, posted.at.posto.z) >= TOWN_LIFE.dry);
  assert.deepEqual(posted.at["lugar-deserto"], at["lugar-deserto"], "what does not depend on the post stays where it was");
  // the fixed points: the house's door, the beach, the nets, the boat's shore
  for (const id of ["casa", "praia", "redes", "barco"] as const) assert.equal(storyPlaces({ ...input, boxes: [...input.boxes, crate(at[id])] }), null, `${id} blocked: no story`);
  // no house, no lane to the beach, a point off the map: no story
  assert.equal(storyPlaces({ ...input, house: null }), null);
  assert.equal(storyPlaces({ ...input, routes: [] }), null);
  assert.equal(storyPlaces({ ...input, boat: { x: 1e6, z: 0 } }), null);
  assert.equal(storyPlaces({ ...input, nets: { x: Number.NaN, z: 0 } }), null);
  // a fixed point inside the playable square but under the region's edge notice: no story (a step is never lived
  // while the game is telling him the region ends here)
  let rim: Vec2 | null = null;
  for (let x = t.meta.size / 2 - MARGIN - 30; !rim && x > 0; x -= 600) for (let z = -1200; !rim && z <= 1200; z += 60)
    if (t.heightAt(x, z) >= 1 && distanceToEdge(t.meta.size, MARGIN, x, z) > 0 && distanceToEdge(t.meta.size, MARGIN, x, z) < STORY_PLACES.edge) rim = { x, z };
  assert.ok(rim, "the map has dry ground near its edge to try this with");
  assert.equal(storyPlaces({ ...input, nets: rim }), null);
  // a fixed point in water deeper than a place may stand in (where the boat floats): no story
  assert.ok(t.heightAt(P.barco[0], P.barco[1]) < STORY_PLACES.wade);
  assert.equal(storyPlaces({ ...input, nets: { x: P.barco[0], z: P.barco[1] } }), null);
  // a flat world has no mount: no story rather than a mount that is not one
  const flat = { ...t, heightAt: () => 1, slopeAt: () => 0, inside: (x: number, z: number, m = 0) => t.inside(x, z, m) };
  assert.equal(storyPlaces({ ...input, terrain: flat }), null);
});
