// The town's life laid on the real terrain, against the colliders the scene has: the houses' final footprints and
// their fittings (jars, porch posts, low walls, timber, nets, rocks), rebuilt here the way village-houses.ts does.
// The fittings' meshes are stand-in boxes of the catalogued sizes: placement reads only their bounds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildingPoint, distanceToSegment, insideObstacle, type Obstacle } from "../src/world-layout.ts";
import { MARGIN, beach, lots, read, routes, scene, start, t } from "./fixtures/town-scene.ts";
import { npcCanTraverse } from "../src/npc-navigation.ts";
import type { Fala, Vec2 } from "../src/missions.ts";
import { TEACHING, beginTeaching, freshTeaching, stepTeaching, teachingLines, teachingView, type TeachingData, type TeachingEvent } from "../src/teaching-journey.ts";
import { TOWN_LIFE, distanceToBox, townLife, townNpcGround, type TownLifeInput } from "../src/town-life-layout.ts";

const data: TeachingData = JSON.parse(read("src/data/mc-ensino.json").toString());
const town = scene(256);
const input: TownLifeInput = { terrain: t, start, beach, routes, plans: town.plans, boxes: town.boxes, margin: MARGIN };
const life = townLife(input)!;

/** main.ts's own movement rule for the hero. */
const heroBlocked = (x: number, z: number, boxes: readonly Obstacle[]) =>
  !t.inside(x, z, MARGIN) || t.heightAt(x, z) < -0.55 || boxes.some((b) => insideObstacle(x, z, b, 0.3));
const clearance = (p: Vec2, boxes: readonly Obstacle[]) => Math.min(...boxes.map((b) => distanceToBox(p.x, p.z, b)));
const along = (points: readonly Vec2[], step: number): Vec2[] => {
  const out: Vec2[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i], b = points[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / step));
    for (let k = 0; k <= n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  return out;
};

test("the scene rebuilt for the test has the town's colliders: houses and their fittings", () => {
  assert.equal(town.plans.length, 158);
  assert.ok(town.boxes.length > town.plans.length + 150, `${town.boxes.length} colliders: the fittings are in`);
});

test("the yard is open, level, dry ground near the start and off the mission lane", () => {
  assert.ok(life, "a yard and a street exist in this village");
  assert.equal(life.revision, "town-life-r15");
  const c = life.court.at;
  // the place this revision of the village gives: a change here means the houses moved and the walk must be looked at again
  assert.deepEqual(c, { x: -39, z: 85 });
  assert.ok(life.court.clear >= TOWN_LIFE.courtClear);
  assert.ok(Math.abs(life.court.clear - clearance(c, town.boxes)) < 1e-9 || life.court.clear === TOWN_LIFE.courtClear + 8, "the free ground it reports is the measured one (capped)");
  assert.ok(Math.hypot(c.x - start.x, c.z - start.z) <= TOWN_LIFE.courtSearch);
  assert.ok(Math.min(...routes.map((s) => distanceToSegment(c.x, c.z, s))) >= TOWN_LIFE.courtOffRoute, "a gathering there never stands in the mission's passage");
  // everywhere the action is offered (and its slack) the hero can stand, on dry ground, and no collider is near
  const heights: number[] = [];
  for (let r = 0; r <= TEACHING.radius + TEACHING.slack; r += 0.5) for (let k = 0; k < 24; k++) {
    const p = { x: c.x + Math.sin((k * Math.PI) / 12) * r, z: c.z + Math.cos((k * Math.PI) / 12) * r };
    assert.equal(heroBlocked(p.x, p.z, town.boxes), false);
    assert.ok(clearance(p, town.boxes) > 0.3);
    heights.push(t.heightAt(p.x, p.z));
  }
  assert.ok(Math.min(...heights) >= TOWN_LIFE.dry);
  assert.ok(Math.max(...heights) - Math.min(...heights) <= TOWN_LIFE.courtFlat + 0.1, `level: ${(Math.max(...heights) - Math.min(...heights)).toFixed(2)} m across`);
  assert.deepEqual(life.teaching.court, c);
});

test("the street runs from the start to the yard on dry open ground, with room for the donkey, and the follower can walk it", () => {
  const s = life.street.points;
  assert.deepEqual(s[0], start);
  assert.deepEqual(s[s.length - 1], life.court.at);
  assert.deepEqual(life.teaching.street, s);
  let length = 0, least = Infinity;
  for (let i = 0; i + 1 < s.length; i++) length += Math.hypot(s[i + 1].x - s[i].x, s[i + 1].z - s[i].z);
  assert.ok(Math.abs(length - life.street.length) < 1e-9);
  const straight = Math.hypot(start.x - life.court.at.x, start.z - life.court.at.z);
  assert.ok(length < straight * 1.6, `${length.toFixed(1)} m for ${straight.toFixed(1)} m in a straight line: a street, not a detour`);
  for (const p of along(s, 0.1)) {
    assert.equal(heroBlocked(p.x, p.z, town.boxes), false, `hero blocked at ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`);
    assert.ok(t.heightAt(p.x, p.z) >= TOWN_LIFE.dry, "dry");
    const c = clearance(p, town.boxes);
    assert.ok(c >= TOWN_LIFE.streetClearance - 1e-9, `only ${c.toFixed(2)} m free at ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`);
    least = Math.min(least, c);
  }
  assert.ok(TOWN_LIFE.streetClearance >= 0.91 + 0.3, "the donkey's conservative radius plus margin");
  assert.ok(Math.abs(least - life.street.clearance) < 0.05, "the narrowest passage it reports is the measured one");
  assert.ok(Math.abs(clearance(life.street.narrowest, town.boxes) - life.street.clearance) < 1e-9);
  // the follower's own rules (npc-navigation.ts): body clearance, footing, slope, no cutting through a box
  const ground = townNpcGround(t, town.boxes, MARGIN);
  for (let i = 0; i + 1 < s.length; i++) assert.ok(npcCanTraverse(ground, s[i], s[i + 1]), `the follower cannot walk stretch ${i}`);
});

test("the house chosen for Mark 1:29 has a free door point by the mission lane, a walk away from the yard", () => {
  assert.ok(life.onward, "a house qualifies in this village");
  const { at, house } = life.onward!, p = town.plans[house];
  assert.deepEqual(life.teaching.onward, at);
  assert.deepEqual(at, buildingPoint(p, 0, p.d / 2 + TOWN_LIFE.doorFront), "in front of its facade (+Z is the entrance)");
  assert.equal(heroBlocked(at.x, at.z, town.boxes), false);
  assert.ok(clearance(at, town.boxes) >= TOWN_LIFE.doorClear);
  assert.ok(t.heightAt(at.x, at.z) >= TOWN_LIFE.dry);
  const far = Math.hypot(at.x - life.court.at.x, at.z - life.court.at.z);
  assert.ok(far >= TOWN_LIFE.onwardNear && far <= TOWN_LIFE.onwardFar, `${far.toFixed(0)} m from the yard`);
  assert.ok(Math.min(...routes.map((s) => distanceToSegment(at.x, at.z, s))) <= TOWN_LIFE.onwardLane, "the mission lane leads there");
  // the radius at which the journey says "you are there" reaches the lane
  assert.ok(TEACHING.onward >= TOWN_LIFE.doorFront);
});

test("the points of interest and the ground to keep clear describe the same places, each marked as the game's choice", () => {
  assert.deepEqual(life.pois.map((p) => p.id), ["quarteirao-inicial", "passagem", "patio-ensino", "margem", "casa-marcos-1-29"]);
  for (const p of life.pois) { assert.equal(p.note, "Posição escolhida pelo jogo"); assert.ok(p.radius > 0); }
  const poi = (id: string) => life.pois.find((p) => p.id === id)!;
  assert.deepEqual(poi("patio-ensino").at, life.court.at);
  assert.deepEqual(poi("passagem").at, life.street.narrowest);
  assert.deepEqual(poi("quarteirao-inicial").at, start);
  assert.deepEqual(poi("margem").at, beach);
  assert.deepEqual(poi("casa-marcos-1-29").at, life.onward!.at);
  assert.equal(life.keepClear.length, life.street.points.length);          // one per stretch, plus the yard
  const yard = life.keepClear[life.keepClear.length - 1];
  assert.deepEqual([yard.ax, yard.az, yard.bx, yard.bz, yard.r], [life.court.at.x, life.court.at.z, life.court.at.x, life.court.at.z, TOWN_LIFE.courtClear]);
});

test("the same scene gives the same layout, on the low ground too, and the original lots (larger) still give a valid one", () => {
  assert.deepEqual(townLife(input), life);
  const low = scene(192), lowLife = townLife({ ...input, plans: low.plans, boxes: low.boxes })!;
  assert.deepEqual(lowLife.court.at, life.court.at);
  assert.deepEqual(lowLife.onward, life.onward);
  for (const p of along(lowLife.street.points, 0.1)) assert.ok(clearance(p, low.boxes) >= TOWN_LIFE.streetClearance - 1e-9);
  const lotBoxes = lots.map((p) => ({ x: p.x, z: p.z, hx: p.w / 2 + 0.35, hz: p.d / 2 + 0.35, rot: p.rot }));
  const wide = townLife({ ...input, plans: lots, boxes: lotBoxes })!;
  assert.ok(wide);
  for (const p of along(wide.street.points, 0.1)) assert.ok(clearance(p, lotBoxes) >= TOWN_LIFE.streetClearance - 1e-9);
  assert.ok(clearance(wide.court.at, lotBoxes) >= TOWN_LIFE.courtClear);
});

test("a point is valid for the colliders it was computed against: block the yard and another is found; block the way and none is", () => {
  const c = life.court.at;
  const stall: Obstacle = { x: c.x, z: c.z, hx: 3, hz: 3, rot: 0.4 };
  const moved = townLife({ ...input, boxes: [...town.boxes, stall] })!;
  assert.ok(moved, "the village has other open ground");
  assert.notDeepEqual(moved.court.at, c);
  assert.ok(distanceToBox(moved.court.at.x, moved.court.at.z, stall) >= TOWN_LIFE.courtClear);
  for (const p of along(moved.street.points, 0.1)) assert.ok(clearance(p, [...town.boxes, stall]) >= TOWN_LIFE.streetClearance - 1e-9);
  // something standing at the chosen house's door: that house no longer qualifies
  const crate: Obstacle = { x: life.onward!.at.x, z: life.onward!.at.z, hx: 0.4, hz: 0.4, rot: 0 };
  const other = townLife({ ...input, boxes: [...town.boxes, crate] })!;
  assert.deepEqual(other.court.at, c, "the yard is not affected by it");
  assert.notEqual(other.onward?.house, life.onward!.house);
  if (other.onward) assert.ok(distanceToBox(other.onward.at.x, other.onward.at.z, crate) >= TOWN_LIFE.doorClear);
  // the start itself inside a collider: nothing is offered
  assert.equal(townLife({ ...input, boxes: [...town.boxes, { x: start.x, z: start.z, hx: 2, hz: 2, rot: 0 }] }), null);
  // the start walled in on all four sides: yards exist, no street reaches one
  const wall = (dx: number, dz: number, hx: number, hz: number): Obstacle => ({ x: start.x + dx, z: start.z + dz, hx, hz, rot: 0 });
  const pen = [wall(0, -4, 6, 0.3), wall(0, 4, 6, 0.3), wall(-4, 0, 0.3, 6), wall(4, 0, 0.3, 6)];
  assert.equal(townLife({ ...input, boxes: [...town.boxes, ...pen] }), null);
  // a village with no houses at all: a yard, a street, and no house to go to
  const bare = townLife({ ...input, plans: [], boxes: [] })!;
  assert.ok(bare);
  assert.equal(bare.onward, null); assert.equal(bare.teaching.onward, null);
  // with open ground everywhere the nearest yard would be on the lane itself: it still keeps off it
  assert.ok(Math.min(...routes.map((s) => distanceToSegment(bare.court.at.x, bare.court.at.z, s))) >= TOWN_LIFE.courtOffRoute);
  assert.ok(Math.hypot(bare.court.at.x - start.x, bare.court.at.z - start.z) >= TOWN_LIFE.courtClear + 6, "and is a walk from the start, not the start itself");
  assert.deepEqual(bare.pois.map((p) => p.id), ["quarteirao-inicial", "passagem", "patio-ensino", "margem"]);
  // under water there is no start to walk from
  const sunk = { heightAt: () => -1, slopeAt: () => 0, inside: () => true };
  assert.equal(townLife({ ...input, terrain: sunk }), null);
});

test("the teaching step is lived on the real place: down the street at the hero's pace, the action in the yard, then the house", () => {
  const lines = teachingLines(data)!, place = life.teaching, DT = 0.05, SPEED = 2.5;
  let s = beginTeaching(freshTeaching()).next, pos = { ...place.street[0] };
  const events: TeachingEvent[] = [];
  const frame = (action = false) => { const r = stepTeaching(s, place, lines, { pos, action }, DT); s = r.next; events.push(...r.events); };
  let walked = 0;
  for (const target of place.street.slice(1)) {
    for (let guard = 0; guard < 4000 && Math.hypot(target.x - pos.x, target.z - pos.z) > 1e-6; guard++) {
      const d = Math.hypot(target.x - pos.x, target.z - pos.z), step = Math.min(d, SPEED * DT);
      const next = { x: pos.x + ((target.x - pos.x) / d) * step, z: pos.z + ((target.z - pos.z) / d) * step };
      assert.equal(heroBlocked(next.x, next.z, town.boxes), false);
      pos = next; walked += step; frame();
    }
  }
  assert.ok(Math.abs(walked - life.street.length) < 1e-6);
  assert.equal(s.phase, "ready", "the walk ends where the action is offered");
  assert.deepEqual(events.map((e) => e.type), ["arrived"]);
  // on the way the radar had the rest of the street, and here the button
  assert.equal(teachingView(s, place, data, lines, pos, false)!.action, "Ensinar");
  frame(true);
  const phase = (): string => s.phase;                         // the frames below move it on
  for (let i = 0; i < 2000 && phase() !== "done"; i++) frame();
  assert.equal(phase(), "done");
  assert.deepEqual(events.filter((e) => e.type === "line").map((e) => (e as { fala: Fala }).fala), lines);
  const v = teachingView(s, place, data, lines, pos, false)!;
  assert.equal(v.objective, "Siga para a casa de Simão e de André");
  assert.deepEqual(v.goal, life.onward!.at);
  assert.ok(Math.abs(v.dist! - Math.hypot(pos.x - life.onward!.at.x, pos.z - life.onward!.at.z)) < 1e-9);
  // at the house the step notices it once and the radar has nowhere left to point
  pos = { ...life.onward!.at }; events.length = 0; frame();
  assert.deepEqual(events.map((e) => e.type), ["onward"]);
  assert.equal(teachingView(s, place, data, lines, pos, false)!.goal, null);
});
