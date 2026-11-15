// Where the twenty steps of story-steps.ts happen, found on the real ground.
//
// Every position is the game's choice on its art-directed terrain: no source places the house, the solitary place,
// the tax post or "the mount" here, and none is claimed to be the historical spot. Three of them are the points the
// first episode already uses (the beach, the nets, the boat's shore: public/world/cafarnaum.json); the house is the
// one town-life-layout.ts chose for Mark 1:29; the rest are searched for by rule on the measured terrain, against the
// colliders the caller passes. Nothing is typed as a coordinate.
//
// Valid by construction, for that scene: inside the playable square and away from its edge notice, on ground the
// hero can stand on by the game's own movement rule, clear of every collider. When one place cannot be found the
// whole set is null and the story is not offered (the game stays as it was), rather than a step that cannot be
// reached. That each place can be walked to from the one before it is what the tests prove on the real terrain
// (test/story-places.test.ts), and tools/check_story_r16.mjs confirms against the running game's colliders.
import type { Vec2 } from "./missions.ts";
import { NPC_MOTION } from "./npc-navigation.ts";
import { buildingPoint, type Building, type Obstacle, type Segment } from "./world-layout.ts";
import { TOWN_LIFE, boxIndex, type TownGround } from "./town-life-layout.ts";
import type { StoryPlaceId } from "./story-steps.ts";

export type StoryPlacesInput = {
  terrain: TownGround;
  /** The mission's walking routes (missionRoutes): the lane down to the beach, then the shore road. */
  routes: readonly Segment[];
  plans: readonly Building[];
  boxes: readonly Obstacle[];
  /** The playable margin of the map, as the movement uses it. */
  margin?: number;
  /** meta.points: where the lane meets the lake, where the nets are, the shore by the boat. */
  beach: Vec2; nets: Vec2; boat: Vec2;
  /** The house town-life-layout.ts chose for Mark 1:29 (TownLife.onward); null when the town has none. */
  house: { at: Vec2; house: number } | null;
};

/** Level design, in metres; none is a measure of the historical place.
 * edge: kept from the playable limit, beyond its notice (places.ts EDGE_NOTICE_M, 40 m). wade: the lowest ground a
 * place may be on: the shore points are at the lake's level, and the hero is stopped at -0.55. clear: free ground
 * around a place (the hero's body takes 0.3). apart: a step that is lived by arriving is at least this far from the
 * step before it, more than twice the reach of story-journey.ts, so it is never lived without a walk.
 * streetReach: how far along the lane the street point is looked for. solitary / solitaryOffRoute / solitarySlope:
 * the solitary place has no house or fitting this near, is off every route and on gentle ground. search / grid: how
 * far and how finely the open ground is searched. meet: how far back towards the house they find him. roadOut: the
 * road out is at least this much farther from the house than the solitary place; roadClear: free ground there.
 * leper: metres back from it towards the town. near: a point that cannot be stood on is replaced by the nearest one
 * that can, within this. post: metres along the shore road from the beach; postAside: how far beside the road its
 * dry ground may be. leviNear / leviFar: how far from the
 * post the second house's door may be; leviApart: and from the first house. mountRise / mountSlope / mountClear:
 * "the mount" is the nearest ground to the boat's shore that rises this much above the lake, on a slope the hero's
 * followers could climb, free of colliders. */
export const STORY_PLACES = {
  edge: 80, wade: -0.2, clear: 1.2, apart: 18,
  streetReach: 60,
  solitary: 60, solitaryOffRoute: 30, solitarySlope: 0.25, search: 480, grid: 6,
  meet: 30, roadOut: 120, roadClear: 25, leper: 60, near: 12,
  post: 70, postAside: 30, leviNear: 20, leviFar: 160, leviApart: 30,
  mountRise: 15, mountSlope: 0.35, mountClear: 6, mountSearch: 720,
} as const;

export type StoryPlaces = {
  revision: "story-places-r16";
  at: Record<StoryPlaceId, Vec2>;
  /** The index in `plans` of the second house (the first is TownLife.onward.house). */
  leviHouse: number;
  note: string;
};

const NOTE = "Posição escolhida pelo jogo";
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

/** The twelve places, or null when any of them cannot be found on this ground. */
export function storyPlaces(input: StoryPlacesInput): StoryPlaces | null {
  const { terrain: t, routes, plans, boxes, beach, nets, boat, house } = input, margin = input.margin ?? 60, S = STORY_PLACES;
  if (!house) return null;
  const index = boxIndex(boxes);
  const finite = (p: Vec2) => Number.isFinite(p.x) && Number.isFinite(p.z);
  /** Ground the hero can stand on with `clear` metres free around, away from the map's edge. */
  const stand = (p: Vec2, clear: number) => finite(p) && t.inside(p.x, p.z, margin + S.edge) && t.heightAt(p.x, p.z) >= S.wade
    && index.clearance(p.x, p.z, clear) >= clear;
  const dry = (p: Vec2) => t.heightAt(p.x, p.z) >= TOWN_LIFE.dry;
  const offRoutes = (p: Vec2) => {
    let best = Infinity;
    for (const s of routes) {
      const dx = s.bx - s.ax, dz = s.bz - s.az, l2 = dx * dx + dz * dz;
      const u = l2 ? Math.max(0, Math.min(1, ((p.x - s.ax) * dx + (p.z - s.az) * dz) / l2)) : 0;
      best = Math.min(best, Math.hypot(p.x - s.ax - u * dx, p.z - s.az - u * dz));
    }
    return best;
  };
  /** `target` when `ok` holds there; else the nearest point of the 1 m grid around it where it does, within
   * `reach`; null when there is none. Ties go to the smaller x, then the smaller z. */
  const settle = (target: Vec2, ok: (p: Vec2) => boolean, reach: number = S.near): Vec2 | null => {
    if (!finite(target)) return null;
    if (ok(target)) return { ...target };
    let best: Vec2 | null = null, bd = Infinity;
    const cx = Math.round(target.x), cz = Math.round(target.z);
    for (let x = cx - reach; x <= cx + reach; x++) for (let z = cz - reach; z <= cz + reach; z++) {
      const p = { x, z }, d = dist(p, target);
      if (d <= reach && d < bd - 1e-9 && ok(p)) { bd = d; best = p; }
    }
    return best;
  };
  /** The point of the search grid nearest to `from` where `ok` holds, within `reach`; null when there is none. The
   * grid is on absolute multiples of STORY_PLACES.grid, so the result does not depend on where the search starts. */
  const nearestOpen = (from: Vec2, reach: number, ok: (p: Vec2) => boolean): Vec2 | null => {
    const g = S.grid, list: { p: Vec2; d: number }[] = [];
    for (let x = Math.ceil((from.x - reach) / g) * g; x <= from.x + reach; x += g)
      for (let z = Math.ceil((from.z - reach) / g) * g; z <= from.z + reach; z += g) {
        const p = { x, z }, d = dist(p, from);
        if (d <= reach) list.push({ p, d });
      }
    list.sort((a, b) => a.d - b.d || a.p.x - b.p.x || a.p.z - b.p.z);
    for (const c of list) if (ok(c.p)) return c.p;
    return null;
  };
  const towards = (a: Vec2, b: Vec2, metres: number): Vec2 => {
    const l = dist(a, b);
    return l > 1e-9 ? { x: a.x + ((b.x - a.x) * metres) / l, z: a.z + ((b.z - a.z) * metres) / l } : { ...a };
  };
  const along = (path: readonly Segment[], metres: number): Vec2 | null => {
    let left = metres;
    for (const s of path) {
      const l = Math.hypot(s.bx - s.ax, s.bz - s.az);
      if (left <= l) { const u = l ? left / l : 0; return { x: s.ax + (s.bx - s.ax) * u, z: s.az + (s.bz - s.az) * u }; }
      left -= l;
    }
    return null;
  };

  // ---- the house of Mark 1:29, as the town's layout chose it
  const casa = stand(house.at, TOWN_LIFE.doorClear) ? { ...house.at } : null;
  if (!casa) return null;

  // ---- the lane and the shore road: the routes up to the beach, and from it on
  const turn = routes.findIndex((s) => Math.hypot(s.bx - beach.x, s.bz - beach.z) < 0.01);
  if (turn < 0) return null;
  const lane = routes.slice(0, turn + 1), shore = routes.slice(turn + 1);

  // ---- the street before the door: the lane's point nearest to it, then along the lane (towards the lake first)
  // to the first point that is a walk away from the door
  let onLane = 0, bestLane = Infinity, walked = 0;
  for (const s of lane) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, l = Math.hypot(dx, dz);
    const u = l ? Math.max(0, Math.min(1, ((casa.x - s.ax) * dx + (casa.z - s.az) * dz) / (l * l))) : 0;
    const d = Math.hypot(casa.x - s.ax - u * dx, casa.z - s.az - u * dz);
    if (d < bestLane) { bestLane = d; onLane = walked + u * l; }
    walked += l;
  }
  let rua: Vec2 | null = null;
  for (const way of [1, -1]) {
    for (let k = 0; k <= S.streetReach && !rua; k++) {
      const p = along(lane, onLane + way * k);
      if (p && dist(p, casa) >= S.apart && stand(p, S.clear) && dry(p)) rua = p;
    }
    if (rua) break;
  }
  if (!rua) return null;

  // ---- the solitary place: the nearest open ground to the house with no house or fitting near, off every route
  const deserto = nearestOpen(casa, S.search, (p) => stand(p, S.clear) && dry(p) && offRoutes(p) >= S.solitaryOffRoute
    && t.slopeAt(p.x, p.z) <= S.solitarySlope && index.clearance(p.x, p.z, S.solitary) >= S.solitary);
  if (!deserto) return null;
  // where they find him: a little back towards the house
  const encontro = settle(towards(deserto, casa, S.meet), (p) => stand(p, S.clear) && dry(p) && dist(p, deserto) >= S.apart);
  if (!encontro) return null;
  // the road out: the nearest open ground to the solitary place that is clearly farther from the house than it
  const away = dist(deserto, casa) + S.roadOut;
  const aldeias = nearestOpen(deserto, S.search, (p) => dist(p, casa) >= away && stand(p, S.clear) && dry(p)
    && t.slopeAt(p.x, p.z) <= S.mountSlope && index.clearance(p.x, p.z, S.roadClear) >= S.roadClear);
  if (!aldeias) return null;
  // where the leper comes to him: back from there towards the town
  const caminho = settle(towards(aldeias, casa, S.leper), (p) => stand(p, S.clear) && dry(p)
    && dist(p, aldeias) >= S.apart && dist(p, encontro) >= S.apart && dist(p, deserto) >= S.apart);
  if (!caminho) return null;

  // ---- the lake: the three points of the first episode, where the hero already walks
  const shorePoint = (p: Vec2) => (stand(p, S.clear) ? { ...p } : null);
  const praia = shorePoint(beach), redes = shorePoint(nets), barco = shorePoint(boat);
  if (!praia || !redes || !barco) return null;

  // ---- the tax post: beside the shore road, a walk from the beach. The road itself runs through ankle-deep water
  // there, so the post stands on the nearest dry ground beside it
  const postAt = along(shore, S.post);
  const posto = postAt ? settle(postAt, (p) => stand(p, S.clear) && dry(p) && dist(p, praia) >= S.apart, S.postAside) : null;
  if (!posto) return null;

  // ---- the second house: the door nearest to the post, of a house that is not the first one
  let levi: Vec2 | null = null, leviHouse = -1, bestDoor = Infinity;
  plans.forEach((p, i) => {
    if (i === house.house) return;
    const at = buildingPoint(p, 0, p.d / 2 + TOWN_LIFE.doorFront), far = dist(at, posto);
    if (far < S.leviNear || far > S.leviFar || dist(at, casa) < S.leviApart || dist(at, praia) < S.apart) return;
    if (!stand(at, TOWN_LIFE.doorClear) || !dry(at) || t.slopeAt(at.x, at.z) > NPC_MOTION.maxSlope) return;
    if (far < bestDoor - 1e-9) { bestDoor = far; levi = at; leviHouse = i; }
  });
  const casaDeLevi = levi as Vec2 | null;
  if (!casaDeLevi) return null;

  // ---- the mount: the nearest ground to the boat's shore that rises well above the lake
  const monte = nearestOpen(barco, S.mountSearch, (p) => t.heightAt(p.x, p.z) >= S.mountRise && stand(p, S.clear)
    && t.slopeAt(p.x, p.z) <= S.mountSlope && index.clearance(p.x, p.z, S.mountClear) >= S.mountClear);
  if (!monte) return null;

  return {
    revision: "story-places-r16", leviHouse, note: NOTE,
    at: {
      casa, "rua-da-casa": rua, "lugar-deserto": deserto, encontro, "caminho-das-aldeias": aldeias, caminho,
      praia, posto, "casa-de-levi": casaDeLevi, redes, barco, monte,
    },
  };
}
