// A kit of village houses made by code: basalt fieldstone walls, flat earthen roofs on timber beams, small high
// windows, a wooden door under a lintel, and around that the things that made one house differ from the next: a lower
// second room, a walled yard with its oven, a stair up to the roof, a shaded porch on posts, an upper room.
//
// What it is and is not. It is an artistic kit for a recreated village, in the same spirit as the rest of the scene:
// the forms follow what is commonly drawn of first-century Galilean houses, and nothing here is a survey of
// Capernaum or a source. It replaces nothing by itself: village-houses.ts (Codex's) still places the three sculpted
// meshes; this module only produces geometry, to be reviewed in tools/casas/ before any house goes into the town.
//
// The contract a house keeps: it stands inside its lot's footprint (so the lot's collider is still true), its
// facade is the lot's +Z side, its entrance is where the design says (and at the facade's centre when the lot asks
// for it, as the houses of the missions need), and the same lot and seed always give the same house.
// Pure: no three.js here. Geometry comes out as plain arrays, one part per material (test/house-kit.test.ts).

export type HouseLot = {
  /** The footprint in metres (x across the facade, z from back to front) and the height the lot allows. */
  w: number; d: number; h: number;
  seed: number;
  /** The entrance must be at the facade's centre (the missions' houses: their door point is computed from it). */
  centredEntrance?: boolean;
};
export type HouseKind = "sala" | "duas-salas" | "patio" | "escada" | "alpendre" | "sobrado";
export type HouseDesign = {
  kind: HouseKind; seed: number; lot: HouseLot;
  /** Where the entrance is on the facade side, in the lot's own frame: a door in the wall, or the gate of a yard. */
  /** `width` is what one can walk through. `inset`: how far behind the facade line it stands (a door under a porch
   * is the porch's depth in). `gate`: the opening in a yard's wall, not a door. */
  entrance: { x: number; z: number; width: number; inset: number; gate?: boolean };
  /** The built base's bounds, for the ground contact. */
  base: { x0: number; x1: number; z0: number; z1: number };
  /** A few words that tell two designs apart (tests count distinct ones). */
  signature: string;
  /** What is seen first from the street: the kind, the walls' finish and the roof. Two houses with one look read as
   * the same house; villageDesigns keeps them apart. */
  look: string;
  /** What the mesh builder draws. */
  build: (m: MeshBuilder) => void;
};
export type MaterialId = "wall" | "mud" | "wood";
export type HousePart = { positions: Float32Array; normals: Float32Array; uvs: Float32Array; colors: Float32Array; indices: Uint32Array };
/** `height`: the top of everything built, in metres above the ground. It can pass the lot's `h` (a booth on a
 * terrace, an upper room), so a collider that stops the camera must take its top from here, not from the lot. */
export type HouseMesh = Record<MaterialId, HousePart> & { triangles: number; height: number };

/** Metres. tile: the materials' sizes on the ground (tools/build_house_textures.mjs; wood from facade-materials-r13).
 * edge: how far every wall keeps inside the footprint, so beam ends and roof edges are still inside it. */
export const HOUSE_KIT = {
  tile: { wall: 2.4, mud: 2, wood: 0.5 },
  edge: 0.26, wallThick: 0.34, batter: 0.035, slab: 0.17, overhang: 0.05,
  door: { w: [0.82, 1.0], h: [1.72, 1.92], depth: 0.26 }, window: { w: [0.34, 0.5], h: [0.42, 0.6], depth: 0.24 },
  minRoom: 3.0, stair: { w: 0.86, rise: 0.235, run: 0.29 }, yardWall: [1.25, 1.7], post: 0.13,
  /** How far what stands against a room (a second room, a stair, a yard wall) runs on into it. Each wall leans and
   * wanders its own way, so two that only touch leave a crack one can see through. */
  into: 0.12,
  /** How far what stands beside a room keeps behind that room's face. Two walls in one plane, each with its own lean
   * and relief, show through each other in patches. */
  shy: 0.08,
  /** The height of the trodden earth over a house's base: just above the cap the town's foundations put under every
   * house (village-house-placement.ts, 1.2 cm over the lot's floor), so the two never lie in one plane. */
  floor: 0.03,
  /** A village: within `reach` metres no two houses share a look; a lot draws up to `draws` times to manage it. */
  village: { reach: 15, draws: 24 },
} as const;

// ---------------------------------------------------------------- numbers
type V3 = [number, number, number];
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash3 = (x: number, y: number, z: number) => { let h = Math.imul(Math.round(x * 1000), 374761393) ^ Math.imul(Math.round(y * 1000), 668265263) ^ Math.imul(Math.round(z * 1000), 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

const KNOT = 0.5;

// ---------------------------------------------------------------- mesh builder
type Hole = { u0: number; u1: number; v0: number; v1: number; depth: number; back: "door" | "dark" | "open" };
type Tint = [number, number, number];
class Buffer { p: number[] = []; n: number[] = []; uv: number[] = []; c: number[] = []; i: number[] = []; }

export class MeshBuilder {
  private parts: Record<MaterialId, Buffer> = { wall: new Buffer(), mud: new Buffer(), wood: new Buffer() };
  /** The house's own tone: every colour is multiplied by it, so neighbours of the same stone do not match exactly. */
  tone: Tint = [1, 1, 1];

  private vertex(part: Buffer, p: V3, uv: [number, number], c: Tint): number {
    part.p.push(p[0], p[1], p[2]); part.n.push(0, 0, 0); part.uv.push(uv[0], uv[1]);
    part.c.push(c[0] * this.tone[0], c[1] * this.tone[1], c[2] * this.tone[2]);
    return part.p.length / 3 - 1;
  }
  /** A triangle, counter-clockwise seen from outside; its face normal is added to its three vertices. */
  private tri(part: Buffer, a: number, b: number, c: number) {
    const P = part.p, ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const ux = P[b * 3] - ax, uy = P[b * 3 + 1] - ay, uz = P[b * 3 + 2] - az, vx = P[c * 3] - ax, vy = P[c * 3 + 1] - ay, vz = P[c * 3 + 2] - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (Math.hypot(nx, ny, nz) < 1e-10) return;                              // a collapsed cell draws nothing
    for (const k of [a, b, c]) { part.n[k * 3] += nx; part.n[k * 3 + 1] += ny; part.n[k * 3 + 2] += nz; }
    part.i.push(a, b, c);
  }
  /** A flat four-sided face, its corners given counter-clockwise seen from outside, with its own vertices. */
  quad(mat: MaterialId, a: V3, b: V3, c: V3, d: V3, uv: [[number, number], [number, number], [number, number], [number, number]], tint: Tint | [Tint, Tint, Tint, Tint] = [1, 1, 1]) {
    const part = this.parts[mat], t = (typeof tint[0] === "number" ? [tint, tint, tint, tint] : tint) as [Tint, Tint, Tint, Tint];
    const ia = this.vertex(part, a, uv[0], t[0]), ib = this.vertex(part, b, uv[1], t[1]), ic = this.vertex(part, c, uv[2], t[2]), id = this.vertex(part, d, uv[3], t[3]);
    this.tri(part, ia, ib, ic); this.tri(part, ia, ic, id);
  }

  /** A wall face seen from outside: from `origin` (its lower left corner) `length` metres to the right and `height`
   * up, facing `normal`. It leans in a little as it rises (`batter`), its surface is not quite flat (`bump`), and
   * `holes` are real openings with their reveals. At a corner shared with another wall the lean follows both walls,
   * so the corner stays closed. */
  wall(mat: MaterialId, origin: V3, normal: V3, length: number, height: number, o: {
    holes?: Hole[]; batter?: number; bump?: number; step?: number; uOffset?: number; tint?: Tint; closeStart?: boolean; closeEnd?: boolean; seed?: number; baseShade?: boolean;
    /** Metres a corner wanders in and out as it rises, the same seen from either wall that meets at it. */
    wander?: number;
    /** Above `v` (an uneven line, `wobble` metres up or down) the wall is of another material: plaster over stone. */
    split?: { v: number; upper: MaterialId; wobble: number; tint: Tint };
  } = {}) {
    if (!(length > 0.02) || !(height > 0.02)) return;
    const U: V3 = [normal[2], 0, -normal[0]], holes = o.holes ?? [], split = o.split && o.split.v > 0.15 && o.split.v < height - 0.15 ? o.split : null;
    const batter = o.batter ?? 0, bump = o.bump ?? 0, step = o.step ?? 0.75, tint: Tint = o.tint ?? [1, 1, 1], seed = o.seed ?? 0, uOffset = o.uOffset ?? 0;
    const breaks = (limit: number, extra: number[], each: number) => {
      const out = [0, limit, ...extra.filter((v) => v > 0.01 && v < limit - 0.01)].sort((a, b) => a - b), all: number[] = [];
      out.forEach((v, k) => { if (k) { const from = out[k - 1], n = Math.max(1, Math.ceil((v - from) / each - 1e-6)); for (let j = 1; j <= n; j++) all.push(from + ((v - from) * j) / n); } else all.push(v); });
      return all.filter((v, k) => !k || v - all[k - 1] > 1e-6);
    };
    // rows every half metre: a wandering corner is a straight line between those heights, so the two walls that
    // share it put their points on the same line whatever other rows their openings add
    const wander = o.wander ?? 0, knots = wander ? Array.from({ length: Math.floor(height / KNOT) }, (_, k) => (k + 1) * KNOT).filter((v) => v < height - 0.01) : [];
    // the heights where a wandering corner turns, and how far out it is at each: none at the ground or at the top
    const turns = [0, ...knots, height];
    const turn = (i: number, cx: number, cz: number, axis: number) => i <= 0 || i >= turns.length - 1 ? 0
      : (hash3(cx + axis * 3.1, i * 1.7, cz - axis * 2.3) - 0.5) * 2 * wander * Math.min(1, turns[i] / 0.4, (height - turns[i]) / 0.45);
    const us = breaks(length, holes.flatMap((h) => [h.u0, h.u1]), split ? Math.min(step, 0.5) : step), vs = breaks(height, [...holes.flatMap((h) => [h.v0, h.v1]), ...(split ? [split.v] : []), ...knots], 1.05);
    const splitRow = split ? vs.findIndex((v) => Math.abs(v - split.v) < 1e-6) : -1;
    // the wall's relief changes smoothly from place to place (between the points of a lattice), so two rows of
    // points a few millimetres apart, as beside a window's sill, do not leave a ledge between them
    const along0 = origin[0] * U[0] + origin[2] * U[2], plane = origin[0] * normal[0] + origin[2] * normal[2];
    const relief = (u: number, v: number) => {
      const a = (along0 + u) / 0.45, b = v / 0.35, i = Math.floor(a), j = Math.floor(b), fa = a - i, fb = b - j;
      const h = (i: number, j: number) => hash3(i + seed * 0.37, j + plane * 1.9, normal[0] * 5 + normal[2] * 11);
      return lerp(lerp(h(i, j), h(i + 1, j), fa), lerp(h(i, j + 1), h(i + 1, j + 1), fa), fb);
    };
    const inHole = (u: number, v: number) => holes.some((h) => u > h.u0 && u < h.u1 && v > h.v0 && v < h.v1);
    const onHoleEdge = (u: number, v: number) => holes.some((h) => u >= h.u0 - 1e-6 && u <= h.u1 + 1e-6 && v >= h.v0 - 1e-6 && v <= h.v1 + 1e-6);
    // the plaster's edge rises and falls, but never as far as the row of points above or below it (it would fold
    // the wall over itself there), and not at a corner or an opening, where the two sides must agree
    const reach = split ? Math.max(0, Math.min(split.wobble, split.v - vs[splitRow - 1] - 0.04, vs[splitRow + 1] - split.v - 0.04)) : 0;
    const edgeV = (u: number) => split!.v + (u < 1e-6 || u > length - 1e-6 || onHoleEdge(u, split!.v) ? 0 : (hash3(origin[0] + U[0] * u, 31.7 + seed, origin[2] + U[2] * u) - 0.5) * 2 * reach);
    const at = (u: number, v0: number, row = -1): V3 => {
      const v = row === splitRow && split ? edgeV(u) : v0;
      const lean = batter * (v / height), first = u < 1e-6, last = u > length - 1e-6;
      // the surface moves in and out by a few centimetres, less and less towards the ground, the top, a corner or an
      // opening, where it is flat (a point pinned flat a few millimetres from a free one would leave a ledge)
      let edge = Math.min(u, length - u, v, height - v);
      for (const h of holes) edge = Math.min(edge, Math.max(h.u0 - u, u - h.u1, h.v0 - v, v - h.v1));
      const w = (relief(u, v) - 0.5) * 2 * bump * Math.max(0, Math.min(1, edge / 0.22));
      let p = add(add(origin, U, u), [0, 1, 0], v);
      p = add(p, normal, w - lean);
      if (first && o.closeStart !== false) p = add(p, U, lean);
      if (last && o.closeEnd !== false) p = add(p, U, -lean);
      if (wander && (first || last)) {
        // keyed by the corner's own place on the ground, so both walls move it alike; straight from one turn to the
        // next, so a point one wall adds between two turns (beside a window) is still on the other wall's edge
        const cx = origin[0] + U[0] * u, cz = origin[2] + U[2] * u;
        let j = 0; while (j + 2 < turns.length && v >= turns[j + 1]) j++;
        const f = (v - turns[j]) / (turns[j + 1] - turns[j]);
        p = [p[0] + lerp(turn(j, cx, cz, 0), turn(j + 1, cx, cz, 0), f), p[1], p[2] + lerp(turn(j, cx, cz, 1), turn(j + 1, cx, cz, 1), f)];
      }
      return p;
    };
    const shade = (v: number): Tint => { const k = o.baseShade === false ? 1 : 0.8 + 0.2 * Math.min(1, v / 0.55); return [tint[0] * k, tint[1] * k, tint[2] * k]; };
    const index = new Map<string, number>();
    const get = (id: MaterialId, iu: number, iv: number) => {
      const key = `${id}:${iu}:${iv}`; let k = index.get(key);
      if (k === undefined) {
        const u = us[iu], p = at(u, vs[iv], iv), tl = HOUSE_KIT.tile[id], base = shade(p[1] - origin[1]), tt = id === mat ? base : [base[0] * split!.tint[0] / tint[0], base[1] * split!.tint[1] / tint[1], base[2] * split!.tint[2] / tint[2]] as Tint;
        k = this.vertex(this.parts[id], p, [(u + uOffset) / tl, (p[1] - origin[1]) / tl], tt); index.set(key, k);
      }
      return k;
    };
    for (let iu = 0; iu + 1 < us.length; iu++) for (let iv = 0; iv + 1 < vs.length; iv++) {
      if (inHole((us[iu] + us[iu + 1]) / 2, (vs[iv] + vs[iv + 1]) / 2)) continue;
      const id = split && iv >= splitRow ? split.upper : mat, part = this.parts[id];
      const a = get(id, iu, iv), b = get(id, iu + 1, iv), c = get(id, iu + 1, iv + 1), d = get(id, iu, iv + 1);
      this.tri(part, a, b, c); this.tri(part, a, c, d);
    }
    // the openings: the thickness of the wall on each side, and what closes them at the back
    for (const h of holes) {
      // an opening mostly above the plaster's edge has plastered reveals
      const plastered = !!split && (h.v0 + h.v1) / 2 > split.v, mat2 = plastered ? split!.upper : mat, tile = HOUSE_KIT.tile[mat2], tint2 = plastered ? split!.tint : tint;
      const inward: V3 = [-normal[0] * h.depth, 0, -normal[2] * h.depth], dim: Tint = [tint2[0] * 0.5, tint2[1] * 0.5, tint2[2] * 0.5];
      const A = at(h.u0, h.v0), B = at(h.u1, h.v0), C = at(h.u1, h.v1), D = at(h.u0, h.v1);
      const Ai = add(A, inward), Bi = add(B, inward), Ci = add(C, inward), Di = add(D, inward), k = h.depth / tile;
      const side = (p: V3, q: V3, qi: V3, pi: V3, len: number) => this.quad(mat2, p, q, qi, pi, [[0, 0], [len / tile, 0], [len / tile, k], [0, k]], [tint2, tint2, dim, dim]);
      side(D, A, Ai, Di, h.v1 - h.v0);                                        // the left jamb, seen from outside
      side(B, C, Ci, Bi, h.v1 - h.v0);                                        // the right jamb
      side(C, D, Di, Ci, h.u1 - h.u0);                                        // the underside of the lintel
      if (h.v0 > 0.01) side(A, B, Bi, Ai, h.u1 - h.u0);                       // the sill
      const w = h.u1 - h.u0, t = h.v1 - h.v0;
      if (h.back === "door") { const wt = HOUSE_KIT.tile.wood; this.quad("wood", Ai, Bi, Ci, Di, [[0, 0], [w / wt, 0], [w / wt, t / wt], [0, t / wt]], [0.62, 0.56, 0.5]); }
      else if (h.back === "dark") this.quad(mat2, Ai, Bi, Ci, Di, [[0, 0], [w / tile, 0], [w / tile, t / tile], [0, t / tile]], [0.07, 0.065, 0.06]);
    }
  }

  /** A block between two corners. `top` subdivides its upper face and lets it rise and fall by `uneven` metres. */
  box(mat: MaterialId, min: V3, max: V3, o: { tint?: Tint; uneven?: number; top?: number; skip?: string; topMat?: MaterialId; topTint?: Tint; seed?: number } = {}) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    if (!(x1 - x0 > 1e-4) || !(y1 - y0 > 1e-4) || !(z1 - z0 > 1e-4)) return;
    const tint = o.tint ?? [1, 1, 1], tile = HOUSE_KIT.tile[mat], skip = o.skip ?? "", uneven = o.uneven ?? 0, seed = o.seed ?? 0;
    const h = (x: number, z: number) => y1 + (uneven ? (hash3(x + seed, 7.7, z) - 0.5) * 2 * uneven : 0);
    const low: Tint = [tint[0] * 0.82, tint[1] * 0.82, tint[2] * 0.82];
    const face = (a: V3, b: V3, c: V3, d: V3, w: number, t: number, cols: [Tint, Tint, Tint, Tint]) => this.quad(mat, a, b, c, d, [[0, 0], [w / tile, 0], [w / tile, t / tile], [0, t / tile]], cols);
    const sides: [Tint, Tint, Tint, Tint] = y1 - y0 > 0.5 ? [low, low, tint, tint] : [tint, tint, tint, tint];
    // a side in as many strips as its top edge has points, so an uneven top has no gap under it
    const each = o.top ?? 99, nx = Math.max(1, Math.ceil((x1 - x0) / each)), nz = Math.max(1, Math.ceil((z1 - z0) / each));
    const strip = (n: number, p: (k: number) => [number, number], flip: boolean) => {
      for (let k = 0; k < n; k++) {
        const [ax, az] = p(flip ? n - k : k), [bx, bz] = p(flip ? n - k - 1 : k + 1), w = Math.hypot(bx - ax, bz - az);
        face([ax, y0, az], [bx, y0, bz], [bx, h(bx, bz), bz], [ax, h(ax, az), az], w, y1 - y0, sides);
      }
    };
    if (!skip.includes("+z")) strip(nx, (k) => [lerp(x0, x1, k / nx), z1], false);
    if (!skip.includes("-z")) strip(nx, (k) => [lerp(x0, x1, k / nx), z0], true);
    if (!skip.includes("+x")) strip(nz, (k) => [x1, lerp(z0, z1, k / nz)], true);
    if (!skip.includes("-x")) strip(nz, (k) => [x0, lerp(z0, z1, k / nz)], false);
    if (!skip.includes("-y")) face([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], x1 - x0, z1 - z0, [low, low, low, low]);
    if (!skip.includes("+y")) {
      const tm = o.topMat ?? mat, tt = o.topTint ?? tint, part = this.parts[tm], tl = HOUSE_KIT.tile[tm], ids: number[] = [];
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
        const x = lerp(x0, x1, i / nx), z = lerp(z0, z1, j / nz), edge = i === 0 || j === 0 || i === nx || j === nz;
        // the middle of a roof is a little higher than its edges, so rain runs off
        const dome = uneven && !edge ? uneven * 1.5 : 0;
        ids.push(this.vertex(part, [x, h(x, z) + dome, z], [x / tl, z / tl], tt));
      }
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
        const a = ids[j * (nx + 1) + i], b = ids[j * (nx + 1) + i + 1], c = ids[(j + 1) * (nx + 1) + i + 1], d = ids[(j + 1) * (nx + 1) + i];
        this.tri(part, a, d, c); this.tri(part, a, c, b);
      }
    }
  }

  /** A cylinder lying on its side along x or z (the stone that rolls a roof flat, a rolled mat, a beam's end). Its
   * flat ends have their own points: the texture lies flat on them and their edge stays sharp. */
  roll(mat: MaterialId, centre: V3, along: "x" | "z", radius: number, length: number, tint: Tint = [1, 1, 1]) {
    const part = this.parts[mat], seg = 8, tile = HOUSE_KIT.tile[mat], ring: number[][] = [[], []], caps: number[][] = [[], []], mids: number[] = [];
    const dim: Tint = [tint[0] * 0.8, tint[1] * 0.8, tint[2] * 0.8], out = along === "x";    // which way round is outward depends on the axis
    const point = (side: number, c: number, q: number): V3 => along === "x" ? [centre[0] + side * length / 2, centre[1] + radius + q, centre[2] + c] : [centre[0] + c, centre[1] + radius + q, centre[2] + side * length / 2];
    for (const [e, side] of [[0, -1], [1, 1]] as const) {
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2, c = Math.cos(a) * radius, q = Math.sin(a) * radius, k = 0.75 + 0.25 * (q / radius + 1) / 2;
        ring[e].push(this.vertex(part, point(side, c, q), [(i / seg) * 2 * Math.PI * radius / tile, e * length / tile], [tint[0] * k, tint[1] * k, tint[2] * k]));
        caps[e].push(this.vertex(part, point(side, c, q), [c / tile, q / tile], dim));
      }
      mids.push(this.vertex(part, point(side, 0, 0), [0, 0], dim));
    }
    for (let i = 0; i < seg; i++) {
      const a = ring[0][i], b = ring[0][i + 1], c = ring[1][i + 1], d = ring[1][i];
      if (out) { this.tri(part, a, d, c); this.tri(part, a, c, b); this.tri(part, mids[0], caps[0][i], caps[0][i + 1]); this.tri(part, mids[1], caps[1][i + 1], caps[1][i]); }
      else { this.tri(part, a, b, c); this.tri(part, a, c, d); this.tri(part, mids[0], caps[0][i + 1], caps[0][i]); this.tri(part, mids[1], caps[1][i], caps[1][i + 1]); }
    }
  }

  /** A rounded mound (the oven, a heap): half an ellipsoid on the ground. */
  mound(mat: MaterialId, centre: V3, rx: number, ry: number, rz: number, tint: Tint = [1, 1, 1]) {
    const part = this.parts[mat], seg = 9, rings = 4, tile = HOUSE_KIT.tile[mat], ids: number[] = [];
    for (let j = 0; j <= rings; j++) for (let i = 0; i <= seg; i++) {
      if (j === rings && i === seg) continue;                                  // the top is one place: its last point would serve no face
      const a = (i / seg) * Math.PI * 2, b = (j / rings) * Math.PI / 2;
      const p: V3 = [centre[0] + Math.cos(a) * Math.cos(b) * rx, centre[1] + Math.sin(b) * ry, centre[2] + Math.sin(a) * Math.cos(b) * rz];
      ids.push(this.vertex(part, p, [(i / seg) * 2 * Math.PI * rx / tile, (j / rings) * ry * 1.6 / tile], [tint[0] * (0.8 + 0.2 * j / rings), tint[1] * (0.8 + 0.2 * j / rings), tint[2] * (0.8 + 0.2 * j / rings)]));
    }
    for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
      const a = ids[j * (seg + 1) + i], b = ids[j * (seg + 1) + i + 1], c = ids[(j + 1) * (seg + 1) + i + 1], d = ids[(j + 1) * (seg + 1) + i];
      if (j === rings - 1) this.tri(part, a, d, b); else { this.tri(part, a, d, c); this.tri(part, a, c, b); }
    }
  }

  /** How many vertices each part has now: with `raise`, lifts what is built afterwards (a room on a terrace). */
  mark(): Record<MaterialId, number> { return { wall: this.parts.wall.p.length / 3, mud: this.parts.mud.p.length / 3, wood: this.parts.wood.p.length / 3 }; }
  raise(from: Record<MaterialId, number>, dy: number) {
    for (const id of ["wall", "mud", "wood"] as const) { const P = this.parts[id].p; for (let k = from[id]; k < P.length / 3; k++) P[k * 3 + 1] += dy; }
  }

  finish(): HouseMesh {
    const out = {} as HouseMesh; let triangles = 0, height = 0;
    for (const id of ["wall", "mud", "wood"] as const) {
      const b = this.parts[id], normals = new Float32Array(b.n.length);
      for (let k = 0; k < b.n.length; k += 3) { const l = Math.hypot(b.n[k], b.n[k + 1], b.n[k + 2]) || 1; normals[k] = b.n[k] / l; normals[k + 1] = b.n[k + 1] / l; normals[k + 2] = b.n[k + 2] / l; }
      out[id] = { positions: new Float32Array(b.p), normals, uvs: new Float32Array(b.uv), colors: new Float32Array(b.c), indices: new Uint32Array(b.i) };
      triangles += b.i.length / 3;
      for (let k = 1; k < b.p.length; k += 3) height = Math.max(height, b.p[k]);
    }
    out.triangles = triangles; out.height = height;
    return out;
  }
}

// ---------------------------------------------------------------- the pieces a house is made of
type Rect = { x0: number; x1: number; z0: number; z1: number };
type Opening = { side: "front" | "back" | "left" | "right"; at: number; w: number; v0: number; v1: number; kind: "door" | "window" };
/** How a wall is finished: bare stone; earth plaster down to a stone base; plaster left only on its upper part. */
type Finish = "pedra" | "reboco" | "meio";
type Room = Rect & { h: number; parapet: number; openings: Opening[]; beams: boolean; seed: number; hide?: string; finish?: Finish };
// (corner and jamb stones were tried as blocks proud of the wall: carrying the rubble texture they read as boxes; removed)
const PLASTER: Tint = [1.06, 1.0, 0.92], DRESSED: Tint = [1.22, 1.2, 1.17], TIMBER: Tint = [0.48, 0.42, 0.36];

/** A room: four walls with their openings, the roof slab (or a terrace inside a parapet), beam ends, door trim. */
function room(m: MeshBuilder, r: Room) {
  const K = HOUSE_KIT, W = r.x1 - r.x0, D = r.z1 - r.z0, hide = r.hide ?? "";
  const sides = [
    { id: "front", origin: [r.x0, 0, r.z1] as V3, normal: [0, 0, 1] as V3, length: W },
    { id: "right", origin: [r.x1, 0, r.z1] as V3, normal: [1, 0, 0] as V3, length: D },
    { id: "back", origin: [r.x1, 0, r.z0] as V3, normal: [0, 0, -1] as V3, length: W },
    { id: "left", origin: [r.x0, 0, r.z0] as V3, normal: [-1, 0, 0] as V3, length: D },
  ] as const;
  const wallTop = r.h, finish = r.finish ?? "pedra", pick = rng(r.seed * 31 + 7);
  // the plaster's edge keeps clear of the heights where the corners turn, so it has room to rise and fall
  const clear = (v: number) => { const k = Math.round(v / KNOT) * KNOT, d = v - k; return Math.abs(d) < 0.13 ? k + (d < 0 ? -0.13 : 0.13) : v; };
  const split = finish === "reboco" ? { v: clear(0.5 + pick() * 0.45), upper: "mud" as const, wobble: 0.08, tint: PLASTER }
    : finish === "meio" ? { v: clear(Math.min(wallTop - 0.5, 1.35 + pick() * 0.6)), upper: "mud" as const, wobble: 0.15, tint: PLASTER } : undefined;
  sides.forEach((s, k) => {
    if (hide.includes(s.id)) return;
    // a hidden side stands against another room: the walls beside it run on into that room (HOUSE_KIT.into)
    const U: V3 = [s.normal[2], 0, -s.normal[0]], before = hide.includes(sides[(k + 3) % 4].id) ? K.into : 0, after = hide.includes(sides[(k + 1) % 4].id) ? K.into : 0;
    const holes: Hole[] = r.openings.filter((o) => o.side === s.id).map((o) => ({ u0: before + o.at - o.w / 2, u1: before + o.at + o.w / 2, v0: o.v0, v1: o.v1,
      depth: o.kind === "door" ? K.door.depth : K.window.depth, back: o.kind === "door" ? "door" : "dark" }));
    m.wall("wall", add(s.origin, U, -before), s.normal, s.length + before + after, wallTop, { holes, batter: K.batter, bump: 0.034, uOffset: (r.seed % 97) * 0.13 + s.length - before, seed: r.seed, split, wander: 0.028, closeStart: !before, closeEnd: !after });
    // what frames an opening: a timber lintel over it, and a stone step at a door
    for (const o of r.openings.filter((q) => q.side === s.id)) {
      const c = add(s.origin, U, o.at), over = o.kind === "door" ? 0.2 : 0.12, tall = o.kind === "door" ? 0.16 : 0.1;
      const a = add(add(c, U, -(o.w / 2 + over)), s.normal, -0.06), b = add(add(c, U, o.w / 2 + over), s.normal, 0.035);
      const span = (p: V3, q: V3, y0: number, y1: number): [V3, V3] => [[Math.min(p[0], q[0]), y0, Math.min(p[2], q[2])], [Math.max(p[0], q[0]), y1, Math.max(p[2], q[2])]];
      m.box("wood", ...span(a, b, o.v1, o.v1 + tall), { tint: TIMBER });
      if (o.kind === "door") {
        m.box("wall", ...span(add(add(c, U, -(o.w / 2 + 0.06)), s.normal, -0.1), add(add(c, U, o.w / 2 + 0.06), s.normal, 0.16), 0, 0.07), { tint: DRESSED, skip: "-y" });
        // the door's leaf: two battens across its planks
        for (const y of [o.v1 * 0.26, o.v1 * 0.72]) m.box("wood", ...span(add(add(c, U, -(o.w / 2 - 0.03)), s.normal, -K.door.depth), add(add(c, U, o.w / 2 - 0.03), s.normal, -K.door.depth + 0.035), y, y + 0.09), { tint: [0.4, 0.35, 0.3] });
      }
    }
  });
  if (r.parapet > 0.05) {
    // a terrace: the roof lies below the wall's top, inside it; the wall's top is capped with earth
    const t = K.wallThick, roofY = r.h - r.parapet, lean = K.batter;
    m.box("mud", [r.x0 + t, roofY - 0.12, r.z0 + t], [r.x1 - t, roofY, r.z1 - t], { uneven: 0.022, top: 0.9, skip: "-y+x-x+z-z", seed: r.seed });
    const inner: [V3, V3, number][] = [[[r.x1 - t, roofY, r.z1 - t], [0, 0, -1], W - 2 * t], [[r.x1 - t, roofY, r.z0 + t], [-1, 0, 0], D - 2 * t], [[r.x0 + t, roofY, r.z0 + t], [0, 0, 1], W - 2 * t], [[r.x0 + t, roofY, r.z1 - t], [1, 0, 0], D - 2 * t]];
    for (const [origin, normal, length] of inner) m.wall("wall", origin, normal, length, r.parapet, { step: 1.6, tint: [0.8, 0.8, 0.8], baseShade: false, uOffset: length, seed: r.seed + 3 });
    const cap = (x0: number, x1: number, z0: number, z1: number) => m.box("mud", [x0, r.h - 0.02, z0], [x1, r.h + 0.05, z1], { uneven: 0.03, top: 0.6, skip: "-y", tint: [0.94, 0.92, 0.9], seed: r.seed + 5 });
    cap(r.x0 + lean - 0.02, r.x1 - lean + 0.02, r.z1 - lean - t, r.z1 - lean + 0.02); cap(r.x0 + lean - 0.02, r.x1 - lean + 0.02, r.z0 + lean - 0.02, r.z0 + lean + t);
    cap(r.x0 + lean - 0.02, r.x0 + lean + t, r.z0 + lean + t, r.z1 - lean - t); cap(r.x1 - lean - t, r.x1 - lean + 0.02, r.z0 + lean + t, r.z1 - lean - t);
  } else {
    // a slab of packed earth over the beams, a hand's width past the walls
    const e = K.overhang - K.batter, past = (side: string) => (hide.includes(side) ? K.into : e);
    m.box("mud", [r.x0 - past("left"), r.h, r.z0 - past("back")], [r.x1 + past("right"), r.h + K.slab, r.z1 + past("front")], { uneven: 0.032, top: 0.65, seed: r.seed, tint: [0.96, 0.95, 0.93] });
  }
  if (r.beams) {
    // the ends of the roof beams, through the front and the back walls under the roof
    const y1 = (r.parapet > 0.05 ? r.h - r.parapet : r.h) - 0.03, n = Math.max(2, Math.round(W / 0.78)), size = 0.12;
    for (let k = 0; k < n; k++) {
      const x = r.x0 + 0.3 + ((W - 0.6) * (k + 0.5)) / n + (hash3(r.seed, k, 3) - 0.5) * 0.12, out = 0.14 + hash3(r.seed, k, 9) * 0.07;
      if (!hide.includes("front")) m.roll("wood", [x, y1 - size, r.z1 + out / 2 - 0.05], "z", size / 2, out + 0.1, [0.44, 0.39, 0.33]);
      if (!hide.includes("back")) m.roll("wood", [x, y1 - size, r.z0 - out / 2 + 0.05], "z", size / 2, out + 0.1, [0.44, 0.39, 0.33]);
    }
  }
}

/** A low wall round a yard, with a gap for the gate; returns nothing, draws the wall, its cap and the gate posts. */
function yardWall(m: MeshBuilder, r0: Rect, h: number, gate: { x: number; w: number } | null, seed: number, open = "") {
  // on the side where the room stands the front and back walls run on into it (HOUSE_KIT.into)
  // and its front and back keep a little behind the room's own (HOUSE_KIT.shy)
  const r: Rect = { x0: r0.x0 - (open.includes("left") ? HOUSE_KIT.into : 0), x1: r0.x1 + (open.includes("right") ? HOUSE_KIT.into : 0), z0: r0.z0 + (open ? HOUSE_KIT.shy : 0), z1: r0.z1 - (open ? HOUSE_KIT.shy : 0) };
  const t = 0.3, seg = (x0: number, x1: number, z0: number, z1: number, k: number) => {
    if (x1 - x0 < 0.05 || z1 - z0 < 0.05) return;
    m.box("wall", [x0, 0, z0], [x1, h, z1], { skip: "-y", uneven: 0.035, top: 0.8, topMat: "mud", topTint: [0.9, 0.88, 0.85], seed: seed + k, tint: [0.97, 0.97, 0.97] });
  };
  if (!open.includes("front")) {
    if (gate) { seg(r.x0, gate.x - gate.w / 2, r.z1 - t, r.z1, 1); seg(gate.x + gate.w / 2, r.x1, r.z1 - t, r.z1, 2);
      for (const gx of [gate.x - gate.w / 2 - 0.02, gate.x + gate.w / 2 - 0.12]) m.box("wood", [gx, 0, r.z1 - t - 0.02], [gx + 0.14, h + 0.28, r.z1 + 0.02], { tint: [0.46, 0.4, 0.34], skip: "-y" });
      m.box("wood", [gate.x - gate.w / 2 - 0.1, h + 0.16, r.z1 - t + 0.04], [gate.x + gate.w / 2 + 0.1, h + 0.28, r.z1 - 0.06], { tint: [0.46, 0.4, 0.34] });
    } else seg(r.x0, r.x1, r.z1 - t, r.z1, 1);
  }
  if (!open.includes("back")) seg(r.x0, r.x1, r.z0, r.z0 + t, 3);
  if (!open.includes("left")) seg(r.x0, r.x0 + t, r.z0 + t, r.z1 - t, 4);
  if (!open.includes("right")) seg(r.x1 - t, r.x1, r.z0 + t, r.z1 - t, 5);
}

/** What stands in a yard: the clay oven, a grindstone, a bench against the wall. */
function yardThings(m: MeshBuilder, r: Rect, seed: number) {
  const pick = rng(seed), cx = lerp(r.x0 + 0.9, r.x1 - 0.9, pick()), cz = lerp(r.z0 + 0.9, r.z1 - 1.2, pick());
  m.mound("mud", [cx, 0, cz], 0.5, 0.62, 0.5, [0.86, 0.8, 0.74]);
  m.box("mud", [cx - 0.16, 0.05, cz + 0.42], [cx + 0.16, 0.34, cz + 0.52], { tint: [0.12, 0.1, 0.09], skip: "-y-z" });     // its mouth, dark
  if (r.x1 - r.x0 > 2.6) { const gx = cx > (r.x0 + r.x1) / 2 ? r.x0 + 0.75 : r.x1 - 0.75; m.roll("wall", [gx, 0, r.z0 + 0.85], "x", 0.26, 0.2, [1.32, 1.3, 1.25]); jar(m, gx, 0, r.z1 - 0.9, 1); if (pick() < 0.6) jar(m, gx + (gx < cx ? 0.4 : -0.4), 0, r.z1 - 1.05, 0.8); }
}

/** A storage jar: a tall half-ellipsoid of fired clay with a short neck. */
function jar(m: MeshBuilder, x: number, y: number, z: number, size: number) {
  const clay: Tint = [1.3, 0.8, 0.56];
  m.mound("mud", [x, y, z], 0.2 * size, 0.52 * size, 0.2 * size, clay);
  m.box("mud", [x - 0.07 * size, y + 0.46 * size, z - 0.07 * size], [x + 0.07 * size, y + 0.6 * size, z + 0.07 * size], { tint: [clay[0] * 0.85, clay[1] * 0.85, clay[2] * 0.85], skip: "-y" });
}

/** What a family keeps on its roof: the stone roller that packs the earth after rain, a rolled mat, jars, and on a
 * terrace sometimes a booth of poles and branches for shade. All inside `r`, standing at height `y`. */
function roofThings(m: MeshBuilder, r: Rect, y: number, seed: number, terrace: boolean) {
  const pick = rng(seed * 13 + 5), w = r.x1 - r.x0, d = r.z1 - r.z0;
  if (w < 2 || d < 1.8) return;
  const at = (mx: number, mz: number): [number, number] => [lerp(r.x0 + mx, r.x1 - mx, pick()), lerp(r.z0 + mz, r.z1 - mz, pick())];
  if (pick() < 0.75) { const [x, z] = at(0.6, 0.5); m.roll("wall", [x, y, z], pick() < 0.5 ? "x" : "z", 0.15, 0.62, [1.35, 1.32, 1.26]); }
  if (pick() < 0.55) { const [x, z] = at(0.9, 0.5); m.roll("mud", [x, y, z], pick() < 0.5 ? "x" : "z", 0.085, 1.25, [1.2, 1.1, 0.78]); }
  if (terrace && pick() < 0.6) { const [x, z] = at(0.5, 0.5); jar(m, x, y, z, 0.8 + pick() * 0.3); if (pick() < 0.5) jar(m, x + 0.42, y, z + 0.1, 0.7); }
  if (terrace && w > 3.2 && d > 2.8 && pick() < 0.45) {
    // a booth: four poles and a roof of branches, in a corner of the terrace
    const bw = 1.7 + pick() * 0.4, bd = 1.4 + pick() * 0.3, x0 = pick() < 0.5 ? r.x0 + 0.15 : r.x1 - 0.15 - bw, z0 = r.z0 + 0.15, top = y + 1.65 + pick() * 0.15, p = 0.07;
    for (const [px, pz] of [[x0, z0], [x0 + bw - p, z0], [x0, z0 + bd - p], [x0 + bw - p, z0 + bd - p]]) m.box("wood", [px, y, pz], [px + p, top, pz + p], { tint: TIMBER, skip: "-y" });
    m.box("mud", [x0 - 0.12, top, z0 - 0.12], [x0 + bw + 0.12, top + 0.09, z0 + bd + 0.12], { uneven: 0.04, top: 0.45, tint: [0.72, 0.74, 0.5], seed });
  }
}

// ---------------------------------------------------------------- designs
const between = (r: () => number, [a, b]: readonly [number, number] | readonly number[]) => lerp(a, b, r());

/** The house for a lot: which kind fits it, and every measure of it, from the lot's seed. When the lot asks for its
 * entrance at the facade's centre and the kind drawn cannot put it there, the lot gets a single room, which can. */
export function houseDesign(lot: HouseLot): HouseDesign {
  const first = design(lot, null);
  return lot.centredEntrance && Math.abs(first.entrance.x) > 0.02 ? design(lot, "sala") : first;
}

function design(lot: HouseLot, force: HouseKind | null): HouseDesign {
  const K = HOUSE_KIT, r = rng(lot.seed * 2654435761 + 97), E = K.edge;
  const X0 = -lot.w / 2 + 0.07, X1 = lot.w / 2 - 0.07, Z0 = -lot.d / 2 + E, Z1 = lot.d / 2 - E, W = X1 - X0, D = Z1 - Z0;
  const top = Math.min(lot.h - K.slab - 0.06, 3.35), H = Math.max(2.35, between(r, [Math.max(2.35, top - 0.55), top]));
  // lighter or darker, a little warmer or cooler, never a colour of its own (a first version tinted each channel
  // apart and one house came out green)
  const light = 0.9 + r() * 0.22, warm = (r() - 0.5) * 0.07, tone: [number, number, number] = [light * (1 + warm), light, light * (1 - warm)];
  const f = r(), finish: Finish = f < 0.5 ? "pedra" : f < 0.8 ? "reboco" : "meio";
  const doorW = between(r, K.door.w), doorH = Math.min(between(r, K.door.h), H - 0.5);
  const win = (side: Opening["side"], at: number, y = 0): Opening => { const w = between(r, K.window.w), h = between(r, K.window.h), v0 = Math.min(H - h - 0.45, 1.55 + r() * 0.35) + y; return { side, at, w, v0, v1: v0 + h, kind: "window" }; };
  const door = (side: Opening["side"], at: number): Opening => ({ side, at, w: doorW, v0: 0, v1: doorH, kind: "door" });
  /** Somewhere along a wall of `length` for an opening `w` wide: the centre when asked, else off-centre. */
  const along = (length: number, w: number, centred: boolean, lo = 0.2, hi = 0.8) => centred ? length / 2 : Math.min(length - w / 2 - 0.45, Math.max(w / 2 + 0.45, length * lerp(lo, hi, r())));
  const kinds: HouseKind[] = ["sala"];
  if (W >= 5.6) kinds.push("duas-salas");
  if (W >= 5.6 && Math.round(H / K.stair.rise) * K.stair.run <= D - 0.3 - K.shy) kinds.push("escada");   // the whole flight fits the lot's depth
  if (W >= 6.4) kinds.push("patio", "patio");
  if (D >= 3.9 && W >= 4.2) kinds.push("alpendre");
  if (W >= 5.6) kinds.splice(kinds.indexOf("sala"), 1);                  // a wide lot is never just one plain room
  if (W >= 5 && lot.h >= 2.9 && r() < 0.12) kinds.length = 0, kinds.push("sobrado");   // an upper room is the exception
  const drawn = kinds[Math.floor(r() * kinds.length)], kind = force ?? drawn, flip = r() < 0.5 ? 1 : -1, seed = lot.seed;
  const base = { x0: X0, x1: X1, z0: Z0, z1: Z1 };
  const done = (entrance: HouseDesign["entrance"], terrace: boolean, signature: string, build: (m: MeshBuilder) => void): HouseDesign =>
    ({ kind, seed, lot, entrance, base, signature: `${kind}|${finish}|${signature}`, look: `${kind}|${finish}|${terrace ? "terraço" : "laje"}`, build: (m) => {
      m.tone = tone;
      // the trodden earth of the whole base: the floor of a yard, of a porch, of the strip before a room set back.
      // The lot's floor stands above the ground on a slope; without it those would be pits down to the terrain.
      const tl = K.tile.mud, y = K.floor; m.quad("mud", [X0, y, Z1], [X1, y, Z1], [X1, y, Z0], [X0, y, Z0], [[X0 / tl, Z1 / tl], [X1 / tl, Z1 / tl], [X1 / tl, Z0 / tl], [X0 / tl, Z0 / tl]], [0.8, 0.76, 0.7]);
      build(m);
    } });

  if (kind === "sala") {
    const parapet = r() < 0.4 ? between(r, [0.22, 0.42]) : 0, at = along(W, doorW, !!lot.centredEntrance, 0.25, 0.75), windows = W > 4.4 && r() < 0.7 ? 1 : 0;
    const ops: Opening[] = [door("front", at)];
    if (windows) ops.push(win("front", at < W / 2 ? Math.min(W - 0.7, at + 1.3 + r() * (W - at - 2)) : Math.max(0.7, at - 1.3 - r() * (at - 2))));
    if (r() < 0.6) ops.push(win(r() < 0.5 ? "left" : "right", D * (0.35 + r() * 0.3)));
    return done({ x: X0 + at, z: Z1, width: doorW, inset: 0 }, !!parapet, `${parapet ? "terraço" : "laje"}|j${ops.length - 1}|${H.toFixed(1)}`, (m) =>
      { room(m, { ...base, h: H + parapet, parapet, openings: ops, beams: true, seed, finish });
        const t = parapet ? K.wallThick + 0.1 : 0.35; roofThings(m, { x0: X0 + t, x1: X1 - t, z0: Z0 + t, z1: Z1 - t }, parapet ? H : H + K.slab + 0.02, seed, !!parapet); });
  }
  if (kind === "duas-salas") {
    // a main room and a lower one beside it, set back a little from the street
    const main = W * between(r, [0.54, 0.64]), back = r() < 0.6 ? between(r, [0.5, 1.1]) : K.into, low = H - between(r, [0.45, 0.85]), parapet = r() < 0.35 ? 0.3 : 0;
    const a: Rect = flip > 0 ? { x0: X0, x1: X0 + main, z0: Z0, z1: Z1 } : { x0: X1 - main, x1: X1, z0: Z0, z1: Z1 };
    const b: Rect = flip > 0 ? { x0: X0 + main, x1: X1, z0: Z0 + K.into, z1: Z1 - back } : { x0: X0, x1: X1 - main, z0: Z0 + K.into, z1: Z1 - back };
    const at = lot.centredEntrance ? -a.x0 : along(main, doorW, false, 0.3, 0.7), bw = b.x1 - b.x0;
    const opsA: Opening[] = [door("front", Math.min(main - doorW / 2 - 0.4, Math.max(doorW / 2 + 0.4, at)))];
    if (main > 4 && r() < 0.6) opsA.push(win("front", opsA[0].at < main / 2 ? main - 0.8 : 0.8));
    const opsB: Opening[] = r() < 0.5 && bw > 2.4 ? [{ side: "front", at: bw / 2, w: 0.78, v0: 0, v1: Math.min(1.7, low - 0.45), kind: "door" }] : [{ ...win("front", bw / 2), v0: 1.2, v1: 1.2 + 0.45 }];
    return done({ x: a.x0 + opsA[0].at, z: Z1, width: doorW, inset: 0 }, !!parapet, `${flip}|recuo${back.toFixed(1)}|${parapet ? "t" : "l"}|${opsB[0].kind}`, (m) => {
      room(m, { ...a, h: H + parapet, parapet, openings: opsA, beams: true, seed, finish });
      room(m, { ...b, h: low, parapet: 0, openings: opsB, beams: true, seed: seed + 11, hide: flip > 0 ? "left" : "right", finish: finish === "reboco" ? "reboco" : "pedra" });
      const t = parapet ? K.wallThick + 0.1 : 0.35; roofThings(m, { x0: a.x0 + t, x1: a.x1 - t, z0: a.z0 + t, z1: a.z1 - t }, parapet ? H : H + K.slab + 0.02, seed, !!parapet);
    });
  }
  if (kind === "patio") {
    // a room and, beside it, a yard behind a low wall: the gate is on the street, the room's door opens on the yard
    const yard = Math.max(2.4, W * between(r, [0.36, 0.46])), wallH = between(r, K.yardWall), parapet = r() < 0.5 ? between(r, [0.25, 0.4]) : 0;
    const a: Rect = flip > 0 ? { x0: X0, x1: X1 - yard, z0: Z0, z1: Z1 } : { x0: X0 + yard, x1: X1, z0: Z0, z1: Z1 };
    const y: Rect = flip > 0 ? { x0: X1 - yard, x1: X1, z0: Z0, z1: Z1 } : { x0: X0, x1: X0 + yard, z0: Z0, z1: Z1 };
    const gateW = 1.05 + r() * 0.2, gateX = lot.centredEntrance && Math.abs((y.x0 + y.x1) / 2) < yard / 2 - gateW / 2 - 0.35 ? 0 : (y.x0 + y.x1) / 2 + (r() - 0.5) * (yard - gateW - 1);
    const streetDoor = !!lot.centredEntrance && gateX !== 0 && -a.x0 >= doorW / 2 + 0.45 && a.x1 >= doorW / 2 + 0.45, aw = a.x1 - a.x0;
    const ops: Opening[] = [door(flip > 0 ? "right" : "left", D * (0.4 + r() * 0.25))];
    if (streetDoor) ops.push(door("front", -a.x0)); else if (aw > 3.4) ops.push(win("front", aw * (0.3 + r() * 0.4)));
    if (r() < 0.5) ops.push(win("back", aw / 2));
    return done(streetDoor ? { x: 0, z: Z1, width: doorW, inset: 0 } : { x: gateX, z: Z1, width: gateW - 0.24, inset: K.shy, gate: true }, !!parapet, `${flip}|pátio${yard.toFixed(1)}|muro${wallH.toFixed(1)}|${parapet ? "t" : "l"}`, (m) => {
      room(m, { ...a, h: H + parapet, parapet, openings: ops, beams: true, seed, finish });
      yardWall(m, y, wallH, { x: gateX, w: gateW }, seed + 21, flip > 0 ? "left" : "right");
      yardThings(m, { x0: y.x0 + 0.3, x1: y.x1 - 0.3, z0: y.z0 + 0.3, z1: y.z1 - 0.3 }, seed + 23);
      const t = parapet ? K.wallThick + 0.1 : 0.35; roofThings(m, { x0: a.x0 + t, x1: a.x1 - t, z0: a.z0 + t, z1: a.z1 - t }, parapet ? H : H + K.slab + 0.02, seed, !!parapet);
    });
  }
  if (kind === "escada") {
    // a room with a terrace, and a stone stair up to it along one side
    const sw = K.stair.w, parapet = between(r, [0.3, 0.45]), a: Rect = flip > 0 ? { x0: X0, x1: X1 - sw, z0: Z0, z1: Z1 } : { x0: X0 + sw, x1: X1, z0: Z0, z1: Z1 };
    const aw = a.x1 - a.x0, at = lot.centredEntrance ? -a.x0 : along(aw, doorW, false, 0.3, 0.7), roof = H;
    const ops: Opening[] = [door("front", Math.min(aw - doorW / 2 - 0.4, Math.max(doorW / 2 + 0.4, at)))];
    if (aw > 4.2 && r() < 0.7) ops.push(win("front", ops[0].at < aw / 2 ? aw - 0.8 : 0.8));
    return done({ x: a.x0 + ops[0].at, z: Z1, width: doorW, inset: 0 }, true, `${flip}|${H.toFixed(1)}`, (m) => {
      room(m, { ...a, h: H + parapet, parapet, openings: ops, beams: true, seed, finish });
      roofThings(m, { x0: a.x0 + K.wallThick + 0.1, x1: a.x1 - K.wallThick - 0.1, z0: a.z0 + K.wallThick + 0.1, z1: a.z1 - K.wallThick - 0.1 }, H, seed, true);
      // the flight rises from the street to the roof against the room's side, a little behind the room's face
      const sx0 = flip > 0 ? a.x1 - K.into : X0, sx1 = flip > 0 ? X1 : a.x0 + K.into, steps = Math.round(roof / K.stair.rise), rise = roof / steps, z = Z1 - K.shy;
      for (let k = 0; k < steps; k++) m.box("wall", [sx0, 0, z - (k + 1) * K.stair.run], [sx1, (k + 1) * rise, z - k * K.stair.run], { skip: "-y", tint: [1.08, 1.06, 1.03], uneven: 0.008, seed: seed + k });
    });
  }
  if (kind === "alpendre") {
    // the room stands back from the street behind a porch: posts, a beam, a roof of reeds and earth
    const depth = Math.min(between(r, [1.25, 1.7]), D - K.minRoom + 0.4), a: Rect = { x0: X0, x1: X1, z0: Z0, z1: Z1 - depth };
    const at = along(W, doorW, !!lot.centredEntrance, 0.25, 0.75), xd = X0 + at, way = doorW / 2 + 0.12, p = K.post;
    // a porch over half the front only when the door is well under it
    const side = flip > 0 ? [X0 + W * 0.45, X1] : [X0, X0 + W * 0.55], half = W > 5.2 && r() < 0.5 && xd - way - 0.3 > side[0] && xd + way + 0.3 < side[1];
    const px0 = half ? side[0] : X0, px1 = half ? side[1] : X1, ph = Math.min(H - 0.35, 2.25 + r() * 0.2);
    const ops: Opening[] = [door("front", at)];
    if (W > 4.6) ops.push(win("front", at < W / 2 ? W - 0.75 : 0.75));
    const parapet = r() < 0.3 ? 0.3 : 0;
    // the posts, none in the doorway: one that would stand there moves to the side it was already on
    const n = Math.max(2, Math.round((px1 - px0) / 2.1) + 1);
    const posts = Array.from({ length: n }, (_, k) => lerp(px0 + 0.12, px1 - 0.12 - p, k / (n - 1))).map((x) => Math.abs(x + p / 2 - xd) >= way + p / 2 ? x : xd + (x + p / 2 >= xd ? 1 : -1) * (way + p / 2) - p / 2);
    // a jar under the porch, beside the door (every draw is made here: building a design twice gives the same house)
    const jx = lerp(px0 + 0.5, px1 - 0.5, r()), jarSize = 0.9 + r() * 0.3, jarX = Math.abs(jx - xd) >= way + 0.3 ? jx : xd + (jx >= xd ? 1 : -1) * (way + 0.3);
    const withJar = r() < 0.7 && jarX > px0 + 0.3 && jarX < px1 - 0.3 && posts.every((x) => Math.abs(x + p / 2 - jarX) > 0.35);
    return done({ x: xd, z: Z1, width: doorW, inset: depth }, !!parapet, `${half ? "meio" : "inteiro"}${half ? flip : ""}|${depth.toFixed(1)}|${parapet ? "t" : "l"}`, (m) => {
      room(m, { ...a, h: H + parapet, parapet, openings: ops, beams: false, seed, finish });
      if (withJar) jar(m, jarX, 0, a.z1 + 0.42, jarSize);
      for (const x of posts) m.box("wood", [x, 0, Z1 - 0.2 - p], [x + p, ph, Z1 - 0.2], { tint: [0.5, 0.44, 0.38], skip: "-y" });
      m.box("wood", [px0 + 0.04, ph, Z1 - 0.22 - p], [px1 - 0.04, ph + 0.13, Z1 - 0.18], { tint: [0.46, 0.4, 0.34] });
      for (let x = px0 + 0.35; x < px1 - 0.2; x += 0.62) m.box("wood", [x, ph + 0.13, a.z1 - 0.08], [x + 0.08, ph + 0.21, Z1 - 0.1], { tint: [0.44, 0.39, 0.33] });
      m.box("mud", [px0, ph + 0.21, a.z1 - 0.1], [px1, ph + 0.3, Z1 - 0.04], { uneven: 0.016, top: 0.9, tint: [0.9, 0.86, 0.74], seed: seed + 31 });
    });
  }
  // sobrado: a room, and a smaller one on a corner of its terrace, reached by a ladder
  const parapet = between(r, [0.28, 0.4]), at = along(W, doorW, !!lot.centredEntrance, 0.25, 0.75), uw = Math.min(W * 0.55, 2.2 + r() * 0.8), ud = Math.min(D * 0.62, 2.0 + r() * 0.6), uh = Math.min(2.05, lot.h + 1.6 - H);
  // the upper room stands on the terrace inside the parapet, not in the planes of the walls below
  const inset = K.wallThick + 0.04, up: Rect = flip > 0 ? { x0: X1 - uw - inset, x1: X1 - inset, z0: Z0 + inset, z1: Z0 + inset + ud } : { x0: X0 + inset, x1: X0 + inset + uw, z0: Z0 + inset, z1: Z0 + inset + ud };
  const ops: Opening[] = [door("front", at)];
  if (W > 4.6) ops.push(win("front", at < W / 2 ? W - 0.75 : 0.75));
  // the ladder to the terrace stands against the front wall between the door and the window, across neither
  const edges = ops[1] ? (ops[1].at > at ? [at + doorW / 2, ops[1].at - ops[1].w / 2] : [ops[1].at + ops[1].w / 2, at - doorW / 2]) : (at < W / 2 ? [at + doorW / 2, W] : [0, at - doorW / 2]);
  const lx = X0 + (edges[0] + edges[1]) / 2 - 0.24;
  return done({ x: X0 + at, z: Z1, width: doorW, inset: 0 }, true, `${flip}|${uw.toFixed(1)}x${ud.toFixed(1)}|${H.toFixed(1)}`, (m) => {
    room(m, { ...base, h: H + parapet, parapet, openings: ops, beams: true, seed, finish });
    const lift = (fn: () => void) => { const before = m.mark(); fn(); m.raise(before, H); };
    lift(() => room(m, { ...up, h: uh, parapet: 0, openings: [{ side: "front", at: uw / 2, w: 0.74, v0: 0, v1: Math.min(1.62, uh - 0.3), kind: "door" }, { side: flip > 0 ? "left" : "right", at: ud / 2, w: 0.38, v0: 0.95, v1: 1.4, kind: "window" }], beams: false, seed: seed + 41, finish: finish === "pedra" ? "pedra" : "reboco" }));
    const rail = 0.05;
    for (const x of [lx, lx + 0.43]) m.box("wood", [x, 0, Z1 + 0.03], [x + rail, H + parapet + 0.25, Z1 + 0.03 + rail], { tint: [0.5, 0.44, 0.38], skip: "-y" });
    for (let y = 0.3; y < H + parapet; y += 0.3) m.box("wood", [lx, y, Z1 + 0.035], [lx + 0.48, y + 0.04, Z1 + 0.075], { tint: [0.5, 0.44, 0.38] });
  });
}

export type VillageLot = HouseLot & { x: number; z: number };

/** A house for every lot of a village, in the order given. A lot whose house would look like one already standing
 * within HOUSE_KIT.village.reach metres (the same kind, finish and roof) draws again with another seed, a few times;
 * if every draw looks like a neighbour it keeps one that at least differs in its measures. The seed a lot ended with
 * is in its design. */
export function villageDesigns(lots: VillageLot[]): HouseDesign[] {
  const V = HOUSE_KIT.village, out: HouseDesign[] = [];
  lots.forEach((lot) => {
    const near = out.filter((_, j) => Math.hypot(lots[j].x - lot.x, lots[j].z - lot.z) < V.reach);
    let apart: HouseDesign | null = null, other: HouseDesign | null = null;
    for (let k = 0; k < V.draws && !apart; k++) {
      const d = houseDesign({ w: lot.w, d: lot.d, h: lot.h, seed: lot.seed + k * 7919, centredEntrance: lot.centredEntrance });
      if (!near.some((n) => n.look === d.look)) apart = d; else if (!other && !near.some((n) => n.signature === d.signature)) other = d;
    }
    out.push(apart ?? other ?? houseDesign({ w: lot.w, d: lot.d, h: lot.h, seed: lot.seed, centredEntrance: lot.centredEntrance }));
  });
  return out;
}

/** The geometry of a design, one part per material, in the lot's own frame (metres; the ground is y = 0). */
export function houseMesh(design: HouseDesign): HouseMesh {
  const m = new MeshBuilder();
  design.build(m);
  return m.finish();
}

/** Many houses as one mesh, each turned and put in its place: a village drawn in three calls, one per material.
 * `rot` turns a house about the vertical as the lots turn (world-layout's buildingPoint), so its facade, local +Z,
 * faces its street; `y` is the height of its floor. `height` is then the highest point of them all. */
export function mergeHouses(houses: readonly { mesh: HouseMesh; x: number; y: number; z: number; rot: number }[]): HouseMesh {
  const out = {} as HouseMesh; let triangles = 0, height = -Infinity;
  for (const id of ["wall", "mud", "wood"] as const) {
    const count = houses.reduce((n, h) => n + h.mesh[id].positions.length / 3, 0), faces = houses.reduce((n, h) => n + h.mesh[id].indices.length, 0);
    const part: HousePart = { positions: new Float32Array(count * 3), normals: new Float32Array(count * 3), uvs: new Float32Array(count * 2), colors: new Float32Array(count * 3), indices: new Uint32Array(faces) };
    let v = 0, f = 0;
    for (const h of houses) {
      const src = h.mesh[id], c = Math.cos(h.rot), s = Math.sin(h.rot), n = src.positions.length / 3;
      for (let k = 0; k < n; k++) {
        const x = src.positions[k * 3], z = src.positions[k * 3 + 2], nx = src.normals[k * 3], nz = src.normals[k * 3 + 2], o = (v + k) * 3;
        part.positions[o] = h.x + c * x + s * z; part.positions[o + 1] = h.y + src.positions[k * 3 + 1]; part.positions[o + 2] = h.z - s * x + c * z;
        part.normals[o] = c * nx + s * nz; part.normals[o + 1] = src.normals[k * 3 + 1]; part.normals[o + 2] = -s * nx + c * nz;
      }
      part.uvs.set(src.uvs, v * 2); part.colors.set(src.colors, v * 3);
      for (let k = 0; k < src.indices.length; k++) part.indices[f + k] = src.indices[k] + v;
      v += n; f += src.indices.length;
    }
    out[id] = part; triangles += faces / 3;
  }
  for (const h of houses) height = Math.max(height, h.y + h.mesh.height);
  out.triangles = triangles; out.height = houses.length ? height : 0;
  return out;
}
