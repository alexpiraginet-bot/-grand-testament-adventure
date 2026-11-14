// Where the town's life happens, found on the real ground: the open yard where the teaching is staged, the way to
// it through the street, the house the game chose for Mark 1:29, and the points of interest around them.
// Every position here is the game's choice inside its art-directed village (world-layout.ts: "not an archaeological
// site plan"). No source places any of them, and each point of interest says so in its note.
//
// Nothing is typed as a coordinate. The yard, the street and the house are searched for on the measured terrain,
// against the colliders the caller passes (the houses' final footprints and their fittings), so a point this module
// returns is valid for that scene by construction: dry, level enough, inside the playable margin, clear of every
// collider. When no safe yard or no safe street exists it returns null and the step is not offered, rather than a
// spot inside a wall. Pure and deterministic (test/town-life-layout.test.ts runs it on the real terrain); the scene
// (main.ts, world.ts) is Codex's and is not touched from here.
import type { Vec2 } from "./missions.ts";
import { buildingPoint, distanceToSegment, type Building, type Obstacle, type Segment } from "./world-layout.ts";
import { NPC_MOTION, npcCanTraverse, npcCrossesBox, npcStandable, type NpcGround } from "./npc-navigation.ts";
import type { Lane, Spot } from "./npc-population.ts";
import type { TeachingPlace } from "./teaching-journey.ts";

export type TownGround = { heightAt(x: number, z: number): number; slopeAt(x: number, z: number): number; inside(x: number, z: number, margin?: number): boolean };

export type TownLifeInput = {
  terrain: TownGround;
  /** Where the walk began and the epilogue ends (meta.points.start). */
  start: Vec2;
  /** The shore the mission lane reaches (meta.points.beach). */
  beach: Vec2;
  /** The mission's walking routes (missionRoutes). */
  routes: readonly Segment[];
  /** The houses' final footprints (town.plans). */
  plans: readonly Building[];
  /** Every static collider of the town: houses and their fittings (town.boxes). */
  boxes: readonly Obstacle[];
  /** The playable margin of the map, as the movement uses it. */
  margin?: number;
};

/** Level design, in metres. The numbers are the game's, chosen for play; none is a measure of the historical town.
 * courtClear: free ground around the yard's centre, larger than the radius where the action is offered (6 m).
 * courtFlat: the most the ground may rise or fall across the yard. courtSearch: how far from the start a yard may be.
 * courtOffRoute: the yard keeps this far from the mission lane, so a gathering never stands in the passage.
 * streetClearance: free ground on each side of the street's line: the donkey's conservative radius (0.91 m) plus
 * margin. dry: the lowest ground the street or a standing point may use, above the lake. grid: the planner's step.
 * doorFront: how far in front of its facade a house's door point stands. onwardNear / onwardFar: how far from the
 * yard the next house may be, so the walk to it is a walk and not a search. onwardLane: it stays this close to the
 * mission lane, which leads there. */
export const TOWN_LIFE = {
  courtClear: 7, courtFlat: 0.7, courtSearch: 60, courtOffRoute: 10,
  streetClearance: 1.3, streetRadius: 1.35, dry: 0.3, grid: 1, window: 30,
  doorFront: 2.2, doorClear: 0.8, onwardNear: 40, onwardFar: 220, onwardLane: 14,
} as const;

export type TownPoiId = "quarteirao-inicial" | "passagem" | "patio-ensino" | "margem" | "casa-marcos-1-29";
export type TownPoi = { id: TownPoiId; at: Vec2; radius: number; note: string };

export type TownLife = {
  revision: "town-life-r15";
  /** The place of the teaching step, ready for teaching-journey.ts. */
  teaching: TeachingPlace;
  /** The yard: its centre and the metres of free ground around it. */
  court: { at: Vec2; clear: number };
  /** The way from the start to the yard: its points in walking order, its length, the least free ground beside it
   * and where that is (the narrow passage). */
  street: { points: Vec2[]; length: number; clearance: number; narrowest: Vec2 };
  /** The house chosen for Mark 1:29: the point in front of its door and its index in `plans`; null when no house
   * has a safe door point. */
  onward: { at: Vec2; house: number } | null;
  pois: TownPoi[];
  /** For vegetation and props only: the street and the yard, as segments to keep clear. Not for placing houses
   * (that would move the lots this layout was computed from) nor for the ground's path mask (it has a budget). */
  keepClear: Segment[];
};

const NOTE = "Posição escolhida pelo jogo";
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

/** Metres from a point to an oriented box (0 inside it). Same axes as world-layout's insideObstacle. */
export function distanceToBox(x: number, z: number, b: Obstacle): number {
  const c = Math.cos(b.rot), s = Math.sin(b.rot), dx = x - b.x, dz = z - b.z;
  return Math.hypot(Math.max(0, Math.abs(dx * c - dz * s) - b.hx), Math.max(0, Math.abs(dx * s + dz * c) - b.hz));
}

/** The colliders indexed in cells, so a query looks only at the boxes around it. */
function boxIndex(boxes: readonly Obstacle[], cell = 16) {
  const cells = new Map<string, Obstacle[]>();
  for (const b of boxes) {
    const r = Math.hypot(b.hx, b.hz);
    for (let z = Math.floor((b.z - r) / cell); z <= Math.floor((b.z + r) / cell); z++)
      for (let x = Math.floor((b.x - r) / cell); x <= Math.floor((b.x + r) / cell); x++) {
        const k = `${x}:${z}`, list = cells.get(k);
        if (list) list.push(b); else cells.set(k, [b]);
      }
  }
  const near = (x: number, z: number, reach: number) => {
    const out = new Set<Obstacle>();
    for (let cz = Math.floor((z - reach) / cell); cz <= Math.floor((z + reach) / cell); cz++)
      for (let cx = Math.floor((x - reach) / cell); cx <= Math.floor((x + reach) / cell); cx++)
        for (const b of cells.get(`${cx}:${cz}`) ?? []) out.add(b);
    return out;
  };
  return {
    /** Free ground around the point, up to `cap` metres. */
    clearance(x: number, z: number, cap: number): number {
      let best = cap;
      for (const b of near(x, z, cap)) best = Math.min(best, distanceToBox(x, z, b));
      return best;
    },
    near,
  };
}

/** The ground as the follower's navigation reads it (npc-navigation.ts), over these colliders. */
export function townNpcGround(terrain: TownGround, boxes: readonly Obstacle[], margin = 60): NpcGround {
  const index = boxIndex(boxes);
  return {
    heightAt: (x, z) => terrain.heightAt(x, z),
    inside: (x, z) => terrain.inside(x, z, margin),
    blocked: (x, z) => index.clearance(x, z, 1) <= 0,
    segmentBlocked: (a, b, radius) => {
      const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      for (const box of index.near(mid.x, mid.z, dist(a, b) / 2 + radius + 1)) if (npcCrossesBox(a, b, box, radius)) return true;
      return false;
    },
  };
}

export function townLife(input: TownLifeInput): TownLife | null {
  const { terrain: t, start, beach, routes, plans, boxes } = input, margin = input.margin ?? 60, L = TOWN_LIFE;
  const index = boxIndex(boxes);
  const offRoute = (p: Vec2) => (routes.length ? Math.min(...routes.map((s) => distanceToSegment(p.x, p.z, s))) : Infinity);
  /** Ground a person may stand or walk on with `clear` metres free around: dry, inside the map, off every collider. */
  const open = (x: number, z: number, clear: number) =>
    Number.isFinite(x) && Number.isFinite(z) && t.inside(x, z, margin) && t.heightAt(x, z) >= L.dry && index.clearance(x, z, clear) >= clear;
  const walk = (x: number, z: number) => open(x, z, L.streetClearance);
  /** The straight line between two points is walkable street all along. */
  const sight = (a: Vec2, b: Vec2) => {
    const n = Math.max(1, Math.ceil(dist(a, b) / 0.25));
    for (let i = 0; i <= n; i++) if (!walk(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n)) return false;
    return true;
  };
  const npcGround = townNpcGround(t, boxes, margin);

  // ---- the way from the start to a point: A* over the open ground, then the fewest straight stretches
  const from = { x: start.x, z: start.z };
  if (!walk(from.x, from.z)) return null;
  const plan = (to: Vec2): Vec2[] | null => {
    const g = L.grid, x0 = Math.floor((Math.min(from.x, to.x) - L.window) / g) * g, z0 = Math.floor((Math.min(from.z, to.z) - L.window) / g) * g;
    const nx = Math.ceil((Math.max(from.x, to.x) + L.window - x0) / g) + 1, nz = Math.ceil((Math.max(from.z, to.z) + L.window - z0) / g) + 1;
    const at = (i: number): Vec2 => ({ x: x0 + (i % nx) * g, z: z0 + Math.floor(i / nx) * g });
    const ok = new Int8Array(nx * nz);                                     // 0 unknown, 1 open, -1 closed
    const valid = (i: number) => { if (!ok[i]) { const p = at(i); ok[i] = walk(p.x, p.z) ? 1 : -1; } return ok[i] === 1; };
    const nearest = (p: Vec2) => {
      let best = -1, bd = Infinity;
      const cx = Math.round((p.x - x0) / g), cz = Math.round((p.z - z0) / g);
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
        const ix = cx + dx, iz = cz + dz;
        if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) continue;
        const i = iz * nx + ix, q = at(i), d = dist(p, q);
        if (d < bd && valid(i) && sight(p, q)) { bd = d; best = i; }
      }
      return best;
    };
    const a = nearest(from), b = nearest(to);
    if (a < 0 || b < 0) return null;
    const cost = new Float64Array(nx * nz).fill(Infinity), prev = new Int32Array(nx * nz).fill(-1), done = new Uint8Array(nx * nz);
    const goal = at(b), heap: [number, number][] = [[dist(at(a), goal), a]];
    cost[a] = 0;
    const push = (f: number, i: number) => { heap.push([f, i]); for (let k = heap.length - 1; k > 0;) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => {
      const top = heap[0], last = heap.pop()!;
      if (heap.length) { heap[0] = last; for (let k = 0;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } }
      return top;
    };
    while (heap.length) {
      const [, cur] = pop();
      if (done[cur]) continue;
      done[cur] = 1;
      if (cur === b) break;
      const ix = cur % nx, iz = Math.floor(cur / nx), p = at(cur);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dz) || ix + dx < 0 || iz + dz < 0 || ix + dx >= nx || iz + dz >= nz) continue;
        const next = (iz + dz) * nx + ix + dx;
        if (done[next] || !valid(next)) continue;
        const q = at(next);
        if (dx && dz && !sight(p, q)) continue;                            // no cutting a corner between two colliders
        // a little dearer close to walls, so the way keeps to the middle of a passage instead of hugging a house
        const c = cost[cur] + Math.hypot(dx, dz) * g * (1 + 0.6 / Math.max(0.5, index.clearance(q.x, q.z, 4) - L.streetClearance + 0.5));
        if (c < cost[next]) { cost[next] = c; prev[next] = cur; push(c + dist(q, goal), next); }
      }
    }
    if (!Number.isFinite(cost[b])) return null;
    const raw: Vec2[] = [to];
    for (let i = b; i !== -1; i = prev[i]) raw.unshift(at(i));
    raw.unshift(from);
    const out: Vec2[] = [raw[0]];
    for (let i = 0; i < raw.length - 1;) {
      let j = raw.length - 1;
      while (j > i + 1 && !sight(raw[i], raw[j])) j--;
      if (dist(out[out.length - 1], raw[j]) > 1e-6) out.push(raw[j]);
      i = j;
    }
    // the whole of it must also be walkable by the follower's own rules (body clearance, footing, slope)
    for (let i = 0; i + 1 < out.length; i++) if (!sight(out[i], out[i + 1]) || !npcCanTraverse(npcGround, out[i], out[i + 1])) return null;
    return out;
  };

  // ---- the yard: the most open level ground near the start, off the mission lane, that a street reaches
  type Yard = { at: Vec2; clear: number; far: number };
  const yards: Yard[] = [];
  const cap = L.courtClear + 8;
  for (let z = Math.round(start.z) - L.courtSearch; z <= Math.round(start.z) + L.courtSearch; z += 1)
    for (let x = Math.round(start.x) - L.courtSearch; x <= Math.round(start.x) + L.courtSearch; x += 1) {
      const at = { x, z }, far = dist(at, start);
      if (far > L.courtSearch || far < L.courtClear + 6) continue;
      if (!t.inside(x, z, margin) || offRoute(at) < L.courtOffRoute) continue;
      const clear = index.clearance(x, z, cap);
      if (clear < L.courtClear) continue;
      let lo = Infinity, hi = -Infinity;
      for (let k = 0; k < 16; k++) for (const r of [L.courtClear, L.courtClear / 2]) {
        const h = t.heightAt(x + Math.sin((k * Math.PI) / 8) * r, z + Math.cos((k * Math.PI) / 8) * r);
        lo = Math.min(lo, h); hi = Math.max(hi, h);
      }
      const h = t.heightAt(x, z);
      lo = Math.min(lo, h); hi = Math.max(hi, h);
      if (lo < L.dry || hi - lo > L.courtFlat) continue;
      yards.push({ at, clear, far });
    }
  // most open first; among equals the nearer to the start; then by coordinates, so the order never depends on chance
  yards.sort((a, b) => Math.round(b.clear * 2) - Math.round(a.clear * 2) || a.far - b.far || a.at.x - b.at.x || a.at.z - b.at.z);
  let court: Yard | null = null, way: Vec2[] | null = null;
  for (const y of yards.slice(0, 40)) { way = plan(y.at); if (way) { court = y; break; } }
  if (!court || !way) return null;

  let length = 0, clearance = Infinity, narrowest = way[0];
  for (let i = 0; i + 1 < way.length; i++) {
    const a = way[i], b = way[i + 1], l = dist(a, b), n = Math.max(1, Math.ceil(l / 0.25));
    length += l;
    for (let k = 0; k <= n; k++) {
      const p = { x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n }, c = index.clearance(p.x, p.z, 12);
      if (c < clearance) { clearance = c; narrowest = p; }
    }
  }

  // ---- the house for Mark 1:29: one whose door faces open ground, a walk away from the yard, by the mission lane
  // and the nearest such to the lakeward end of the village (a fishermen's house: the game's reading, not a source)
  const village = routes.findIndex((s) => Math.hypot(s.bx - beach.x, s.bz - beach.z) < 0.01);
  const lane = village >= 0 ? routes.slice(0, village + 1) : routes;
  const laneLength = lane.reduce((n, s) => n + Math.hypot(s.bx - s.ax, s.bz - s.az), 0);
  const along = (d: number): Vec2 => {
    let left = d;
    for (const s of lane) { const l = Math.hypot(s.bx - s.ax, s.bz - s.az); if (left <= l || s === lane[lane.length - 1]) { const u = l ? Math.min(1, left / l) : 0; return { x: s.ax + (s.bx - s.ax) * u, z: s.az + (s.bz - s.az) * u }; } left -= l; }
    return { ...beach };
  };
  const aim = lane.length ? along(laneLength * 0.7) : null;
  let onward: { at: Vec2; house: number } | null = null, best = Infinity;
  if (aim) plans.forEach((p, house) => {
    const at = buildingPoint(p, 0, p.d / 2 + L.doorFront);
    const far = dist(at, court!.at);
    if (far < L.onwardNear || far > L.onwardFar || !open(at.x, at.z, L.doorClear) || t.slopeAt(at.x, at.z) > NPC_MOTION.maxSlope) return;
    if (Math.min(...lane.map((s) => distanceToSegment(at.x, at.z, s))) > L.onwardLane) return;
    const score = dist(at, aim);
    if (score < best - 1e-9) { best = score; onward = { at, house }; }
  });

  const street = way.map((p) => ({ ...p }));
  const chosen = onward as { at: Vec2; house: number } | null;
  const pois: TownPoi[] = [
    { id: "quarteirao-inicial", at: { ...start }, radius: 25, note: NOTE },
    { id: "passagem", at: narrowest, radius: 4, note: NOTE },
    { id: "patio-ensino", at: { ...court.at }, radius: L.courtClear, note: NOTE },
    { id: "margem", at: { ...beach }, radius: 18, note: NOTE },
    ...(chosen ? [{ id: "casa-marcos-1-29" as const, at: { ...chosen.at }, radius: 12, note: NOTE }] : []),
  ];
  const keepClear: Segment[] = street.slice(1).map((b, i) => ({ ax: street[i].x, az: street[i].z, bx: b.x, bz: b.z, r: L.streetRadius }));
  keepClear.push({ ax: court.at.x, az: court.at.z, bx: court.at.x, bz: court.at.z, r: L.courtClear });
  return {
    revision: "town-life-r15",
    teaching: { court: { ...court.at }, street, onward: chosen ? { ...chosen.at } : null },
    court: { at: { ...court.at }, clear: court.clear },
    street: { points: street, length, clearance, narrowest },
    onward: chosen,
    pois, keepClear,
  };
}

/** Level design for where people stand and walk. rim: how far from the yard's centre the listeners' ring is, inside
 * the free ground and around whoever stands in the middle; rimSpots: how many places on it; offLine: a standing
 * person keeps this far from the line of a street, so the passage stays free; pairGap: metres between two people
 * talking; laneSide: how far from a street's line a walker keeps, leaving its middle to the player. */
export const TOWN_PLACES = { rim: 4.6, rimSpots: 8, offLine: 1.9, pairGap: 1.15, laneSide: 0.8, shoreBack: 3.2 } as const;

/** Where the town's people stand and walk, on the same ground and colliders as the layout: a ring of places around
 * the yard (those who wait and listen), pairs beside the street (two people talking), places by the shore for
 * whoever has the net clip, and the two walks (the street to the yard, the village lane to the shore). Every spot
 * passes the follower's own standing rules; one that does not is simply not offered. The positions are the game's. */
export function townPlaces(input: TownLifeInput, life: TownLife): { spots: Spot[]; lanes: Lane[] } {
  const P = TOWN_PLACES, ground = townNpcGround(input.terrain, input.boxes, input.margin ?? 60);
  const street = life.street.points, c = life.court.at;
  const lines: Segment[] = [...input.routes, ...street.slice(1).map((b, i) => ({ ax: street[i].x, az: street[i].z, bx: b.x, bz: b.z, r: 0 }))];
  const offLines = (p: Vec2) => lines.every((s) => distanceToSegment(p.x, p.z, s) >= P.offLine);
  const facing = (a: Vec2, b: Vec2) => Math.atan2(b.x - a.x, -(b.z - a.z));
  const spots: Spot[] = [];
  const ok = (p: Vec2) => npcStandable(ground, p) && offLines(p) && spots.every((s) => dist(s.at, p) >= 1);
  // the ring around the yard, each place looking at its centre
  for (let k = 0; k < P.rimSpots; k++) {
    const a = (k * 2 * Math.PI) / P.rimSpots, at = { x: c.x + Math.sin(a) * P.rim, z: c.z + Math.cos(a) * P.rim };
    if (ok(at)) spots.push({ id: `patio-${k + 1}`, at, facing: facing(at, c), use: "wait" });
  }
  // pairs beside the street: at a third and two thirds of it, on whichever side has room
  let walked = 0, pair = 0;
  const marks = [life.street.length / 3, (life.street.length * 2) / 3];
  for (let i = 0; i + 1 < street.length; i++) {
    const a = street[i], b = street[i + 1], l = dist(a, b), ux = (b.x - a.x) / (l || 1), uz = (b.z - a.z) / (l || 1);
    for (const mark of marks) {
      if (mark < walked || mark >= walked + l) continue;
      const u = mark - walked;
      search: for (const side of [1, -1]) for (let off = P.offLine + 0.3; off <= P.offLine + 2.4; off += 0.3) {
        const mid = { x: a.x + ux * u - uz * off * side, z: a.z + uz * u + ux * off * side };
        const one = { x: mid.x - (ux * P.pairGap) / 2, z: mid.z - (uz * P.pairGap) / 2 }, two = { x: mid.x + (ux * P.pairGap) / 2, z: mid.z + (uz * P.pairGap) / 2 };
        if (!ok(one) || !ok(two)) continue;
        pair++;
        spots.push({ id: `rua-${pair}a`, at: one, facing: facing(one, two), use: "wait", pair: `rua-${pair}b` },
          { id: `rua-${pair}b`, at: two, facing: facing(two, one), use: "wait", pair: `rua-${pair}a` });
        break search;
      }
    }
    walked += l;
  }
  // by the shore, back from the waterline and off the lane: for whoever has the net clip
  const last = input.routes.find((s) => Math.hypot(s.bx - input.beach.x, s.bz - input.beach.z) < 0.01);
  if (last) {
    const l = Math.hypot(last.bx - last.ax, last.bz - last.az) || 1, ux = (last.bx - last.ax) / l, uz = (last.bz - last.az) / l;
    [-1, 1].forEach((side, k) => {
      const at = { x: input.beach.x - ux * P.shoreBack - uz * (P.offLine + 1.2) * side, z: input.beach.z - uz * P.shoreBack + ux * (P.offLine + 1.2) * side };
      if (ok(at)) spots.push({ id: `margem-${k + 1}`, at, facing: facing(at, input.beach), use: "net" });
    });
  }
  const village = input.routes.findIndex((s) => Math.hypot(s.bx - input.beach.x, s.bz - input.beach.z) < 0.01);
  const lane = (village >= 0 ? input.routes.slice(0, village + 1) : []).flatMap((s, i) => (i ? [{ x: s.bx, z: s.bz }] : [{ x: s.ax, z: s.az }, { x: s.bx, z: s.bz }]));
  const lanes: Lane[] = [{ id: "rua-do-patio", points: street.map((p) => ({ ...p })), side: P.laneSide }];
  if (lane.length >= 2) lanes.push({ id: "rua-da-vila", points: lane, side: P.laneSide });
  return { spots, lanes };
}
