// The house kit on the village's real lots: every house stands inside its lot (so the lot's collider stays true),
// puts its entrance where it says, is the same every time, differs from the houses near it, lets nobody see through
// it, and costs fewer triangles than the three sculpted meshes it could replace. What it looks like is judged by eye
// in tools/casas/, not here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { read, scene } from "./fixtures/town-scene.ts";
import { HOUSE_KIT, MeshBuilder, houseDesign, houseMesh, mergeHouses, villageDesigns, type HouseMesh, type HousePart, type VillageLot } from "../src/house-kit.ts";
import { buildingPoint } from "../src/world-layout.ts";
// @ts-expect-error a plain .mjs tool with no declaration file
import { render } from "../tools/build_house_report.mjs";

const town = scene(256), catalog = JSON.parse(read("src/data/tripo-assets.json").toString());
const lots: VillageLot[] = town.plans.map((p, i) => ({ w: p.w, d: p.d, h: p.h, seed: i + 1, x: p.x, z: p.z }));
const designs = villageDesigns(lots);
const built = lots.map((lot, i) => ({ lot, design: designs[i], mesh: houseMesh(designs[i]) }));
// Lots the village does not have today (narrower, shallower, lower, wider, deeper), with and without the entrance
// asked at the centre: what a house must keep, it keeps on these too.
const swept: VillageLot[] = [];
for (const w of [3.2, 4.3, 5.0, 5.7, 6.5, 8, 11]) for (const d of [2.6, 3.4, 4.0, 5.5, 8]) for (const h of [2.2, 2.9, 3.4]) for (const k of [0, 1, 2, 3])
  swept.push({ w, d, h, seed: 1000 + swept.length, centredEntrance: k % 2 === 1, x: 0, z: 0 });
const every = [...built, ...swept.map((lot) => { const design = houseDesign(lot); return { lot, design, mesh: houseMesh(design) }; })];
const PARTS = ["wall", "mud", "wood"] as const;
type P3 = [number, number, number];
const each = (m: HouseMesh, fn: (x: number, y: number, z: number, part: HousePart, id: (typeof PARTS)[number]) => void) => { for (const id of PARTS) { const P = m[id].positions; for (let k = 0; k < P.length; k += 3) fn(P[k], P[k + 1], P[k + 2], m[id], id); } };
const triangles = (m: HouseMesh, ids: readonly (typeof PARTS)[number][], fn: (t: [P3, P3, P3], part: HousePart, i: [number, number, number]) => void) => {
  for (const id of ids) { const { positions: P, indices: I } = m[id]; for (let k = 0; k < I.length; k += 3) { const i: [number, number, number] = [I[k], I[k + 1], I[k + 2]]; fn(i.map((v) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]) as [P3, P3, P3], m[id], i); } }
};
const cross = (a: P3, b: P3, c: P3): P3 => { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; };
const pairsAlike = (list: { look: string }[], reach: number) => { let n = 0; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (Math.hypot(lots[i].x - lots[j].x, lots[i].z - lots[j].z) < reach && list[i].look === list[j].look) n++; return n; };

test("one house for every lot of the village, the same every time", () => {
  assert.equal(built.length, 158); assert.equal(every.length, 158 + 420);
  // the low profile's ground gives the same lots, so the same village
  const low = scene(192).plans;
  assert.ok(low.length === 158 && low.every((p, i) => p.w === lots[i].w && p.d === lots[i].d && p.h === lots[i].h && p.x === lots[i].x && p.z === lots[i].z));
  const again = villageDesigns(lots.map((l) => ({ ...l })));
  again.forEach((d, i) => { assert.equal(d.signature, designs[i].signature); assert.equal(d.seed, designs[i].seed); });
  for (const { design, mesh } of every.filter((_, i) => i % 3 === 0)) {
    const twice = houseMesh(houseDesign({ ...design.lot })), again = houseMesh(design);                 // a new design, and the same one built again
    assert.deepEqual(again.mud.positions, mesh.mud.positions, `${design.signature}: building a design twice`); assert.deepEqual(again.wood.positions, mesh.wood.positions); assert.deepEqual(again.wall.positions, mesh.wall.positions);
    for (const id of PARTS) { assert.deepEqual(twice[id].positions, mesh[id].positions); assert.deepEqual(twice[id].indices, mesh[id].indices); assert.deepEqual(twice[id].colors, mesh[id].colors); assert.deepEqual(twice[id].uvs, mesh[id].uvs); }
  }
  assert.notDeepEqual(houseMesh(houseDesign({ ...lots[0], seed: 9001 })).wall.positions, built[0].mesh.wall.positions, "another seed, another house");
});

test("every house stands inside its lot and on the ground; what rises above the lot's height is in the mesh's own height", () => {
  let over = 0, most = 0;
  for (const { lot, design, mesh } of every) {
    let top = 0, stone = 0;
    each(mesh, (x, y, z, _part, id) => {
      assert.ok(Number.isFinite(x + y + z), `${design.signature}: a number`);
      assert.ok(Math.abs(x) <= lot.w / 2 + 1e-4 && Math.abs(z) <= lot.d / 2 + 1e-4, `${design.signature}: (${x.toFixed(2)}, ${z.toFixed(2)}) is outside a ${lot.w.toFixed(1)} x ${lot.d.toFixed(1)} lot`);
      assert.ok(y >= -1e-4, `${design.signature}: below the ground`);
      top = Math.max(top, y); if (id === "wall") stone = Math.max(stone, y);
    });
    assert.ok(Math.abs(mesh.height - top) < 1e-6, "the mesh says how high it is");
    assert.ok(top >= 2.2, `${design.signature}: a house a person can stand in (${top.toFixed(2)} m)`);
    // the walls of a house of one storey end near the lot's height; a booth on a terrace or an upper room pass it
    if (design.kind !== "sobrado") assert.ok(stone <= lot.h + 0.7, `${design.signature}: stone ${stone.toFixed(2)} m high on a lot of ${lot.h.toFixed(2)} m`);
    assert.ok(top <= Math.max(lot.h, 2.6) + 1.9, `${design.signature}: ${top.toFixed(2)} m on a lot of ${lot.h.toFixed(2)} m`);
    if (lot.x || lot.z) { if (top > lot.h + 0.15) over++; most = Math.max(most, top - lot.h); }
    const b = design.base;
    assert.ok(b.x0 >= -lot.w / 2 && b.x1 <= lot.w / 2 && b.z0 >= -lot.d / 2 && b.z1 <= lot.d / 2);
  }
  // this is why a collider must take its top from the mesh: main.ts keeps the camera out of a box only below its top
  assert.ok(over > 0 && most > 1, `${over} houses of the village rise above their lot's height, by up to ${most.toFixed(2)} m`);
  for (const { lot, design } of every) if (lot.centredEntrance) assert.ok(Math.abs(design.entrance.x) <= 0.02, `${design.signature} on ${lot.w} x ${lot.d}`);
});

test("the entrance is on the street side, at the facade's centre when the lot asks, and there is a way in there", () => {
  /** What one meets first looking at the facade from the street at (x, y): which material, and how far behind the facade. */
  const firstMet = (mesh: HouseMesh, x: number, y: number, zf: number) => {
    let best: { id: string; behind: number } | null = null;
    for (const id of PARTS) triangles(mesh, [id], ([a, b, c]) => {
      const det = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(det) < 1e-12) return;
      const l0 = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / det, l1 = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / det, l2 = 1 - l0 - l1;
      if (l0 < -1e-7 || l1 < -1e-7 || l2 < -1e-7) return;
      const behind = zf - (l0 * a[2] + l1 * b[2] + l2 * c[2]);
      if (!best || behind < best.behind) best = { id, behind };
    });
    return best as { id: string; behind: number } | null;
  };
  const wayIn = (design: (typeof every)[number]["design"], mesh: HouseMesh) => {
    const e = design.entrance, across = [-1, -0.5, 0, 0.5, 1].map((k) => e.x + k * (e.width / 2 - 0.06));
    for (const x of across) for (const y of [0.4, 1.0, 1.5]) {
      const met = firstMet(mesh, x, y, e.z), where = `${design.signature} (seed ${design.seed}) at (${x.toFixed(2)}, ${y})`;
      if (e.gate) assert.ok(!met || met.behind > 0.35 || (met.id === "wood" && y > 1.2), `${where}: a gate one can walk through, not ${met?.id} ${met?.behind.toFixed(2)} m in`);
      // a door: its wooden leaf (or a batten on it) set back in the wall's thickness
      else assert.ok(met && met.id === "wood" && met.behind - e.inset > 0.15 && met.behind - e.inset < HOUSE_KIT.door.depth + 0.08, `${where}: a wooden door in the wall's thickness${e.inset ? ` ${e.inset.toFixed(2)} m in, under the porch` : ""}, not ${met?.id} ${met?.behind.toFixed(2)} m in`);
    }
  };
  let gates = 0;
  for (const { lot, design, mesh } of every) {
    assert.ok(Math.abs(design.entrance.z - (lot.d / 2 - HOUSE_KIT.edge)) < 1e-6, "the entrance is on the facade");
    assert.ok(Math.abs(design.entrance.x) + design.entrance.width / 2 <= lot.w / 2 - 0.3, "and within it");
    assert.ok(design.entrance.width >= 0.7 && design.entrance.width <= 1.3);
    if (design.entrance.gate) assert.equal(design.kind, "patio", "only a yard has a gate");
    assert.ok(design.entrance.inset >= 0 && design.entrance.inset <= 1.75 && (design.kind === "alpendre") === (design.entrance.inset > 0.5), "only a porch puts the door far behind the facade line");
    if (design.entrance.gate) gates++;
    wayIn(design, mesh);
    const centred = houseDesign({ ...design.lot, centredEntrance: true });
    assert.ok(Math.abs(centred.entrance.x) <= 0.02, `${centred.signature}: entrance at ${centred.entrance.x.toFixed(2)} on a lot that asked for the centre`);
    wayIn(centred, houseMesh(centred));
  }
  assert.ok(gates >= 10, `${gates} yards with their gate on the street`);
  // the village helper keeps the request
  const asked = villageDesigns(lots.map((l, i) => ({ ...l, centredEntrance: i % 7 === 0 })));
  asked.forEach((d, i) => { if (i % 7 === 0) assert.ok(Math.abs(d.entrance.x) <= 0.02, `lot ${i + 1}`); });
});

test("a village of different houses: six kinds, three finishes, and no two alike within sight of each other", () => {
  const kinds = new Map<string, number>(), signatures = new Set(designs.map((d) => d.signature)), V = HOUSE_KIT.village;
  for (const d of designs) kinds.set(d.kind, (kinds.get(d.kind) ?? 0) + 1);
  assert.deepEqual([...kinds.keys()].sort(), ["alpendre", "duas-salas", "escada", "patio", "sala", "sobrado"]);
  for (const [kind, n] of kinds) assert.ok(n >= 5, `${kind}: ${n}`);
  assert.ok(kinds.get("sobrado")! <= 20, "an upper room is the exception");
  assert.ok(kinds.get("sala")! <= 79, "the plain single room is not most of the village");
  assert.ok(signatures.size >= 100, `${signatures.size} different houses on 158 lots`);
  for (const finish of ["pedra", "reboco", "meio"]) assert.ok(designs.filter((d) => d.look.split("|")[1] === finish).length >= 15, finish);
  for (const d of designs) assert.match(d.look, /^(sala|duas-salas|patio|escada|alpendre|sobrado)\|(pedra|reboco|meio)\|(terraço|laje)$/);
  // each lot drawing for itself leaves look-alikes near each other; the village helper leaves none
  const plain = lots.map((l) => houseDesign({ w: l.w, d: l.d, h: l.h, seed: l.seed }));
  assert.ok(pairsAlike(plain, V.reach) >= 3, `drawn one by one: ${pairsAlike(plain, V.reach)} pairs alike within ${V.reach} m`);
  assert.equal(pairsAlike(designs, V.reach), 0);
  const redrawn = designs.filter((d, i) => d.seed !== lots[i].seed).length;
  assert.ok(redrawn >= 3 && redrawn <= 40, `${redrawn} lots drew again`);
  // and a lot that cannot differ still gets a house: twenty identical lots on one spot
  const crowd = villageDesigns(Array.from({ length: 20 }, () => ({ w: 4.4, d: 3.6, h: 2.6, seed: 5, x: 0, z: 0 })));
  assert.equal(crowd.length, 20); assert.ok(new Set(crowd.map((d) => d.look)).size >= 5, "as many looks as so small a lot allows");
});

test("the geometry is sound: indices in range, unit normals on the side their faces show, no collapsed or folded triangle", () => {
  for (const { design, mesh } of every) for (const id of PARTS) {
    const { positions: P, normals: N, uvs, colors, indices: I } = mesh[id], n = P.length / 3;
    assert.equal(N.length, P.length); assert.equal(uvs.length, n * 2); assert.equal(colors.length, P.length); assert.equal(I.length % 3, 0);
    for (let k = 0; k < N.length; k += 3) assert.ok(Math.abs(Math.hypot(N[k], N[k + 1], N[k + 2]) - 1) < 1e-4, `${design.signature} ${id}: a unit normal`);
    for (const c of colors) assert.ok(c >= 0 && c < 2.2);
    triangles(mesh, [id], ([a, b, c], _part, i) => {
      assert.ok(i.every((v) => v < n));
      const g = cross(a, b, c);
      assert.ok(Math.hypot(...g) / 2 > 1e-9, `${design.signature} ${id}: a collapsed triangle`);
      // a wall folded over itself (the plaster's edge pushed past the row above it did this) shows as a face turned
      // against the normals of its own corners
      for (const v of i) assert.ok(g[0] * N[v * 3] + g[1] * N[v * 3 + 1] + g[2] * N[v * 3 + 2] > 0, `${design.signature} ${id}: a face turned against its normals near (${a.map((q) => q.toFixed(2)).join(", ")})`);
    });
  }
});

test("stone and plaster are drawn at one size everywhere: no stretched or smeared texture on a face one can see", () => {
  for (const { design, mesh } of every) for (const id of ["wall", "mud"] as const) {
    const tile = HOUSE_KIT.tile[id], T = mesh[id].uvs;
    triangles(mesh, [id], ([a, b, c], _part, [ia, ib, ic]) => {
      const area = Math.hypot(...cross(a, b, c)) / 2;
      if (area < 0.02) return;                                                  // a sliver (the top of a jar) says little
      const s = [T[ib * 2] - T[ia * 2], T[ib * 2 + 1] - T[ia * 2 + 1]], t = [T[ic * 2] - T[ia * 2], T[ic * 2 + 1] - T[ia * 2 + 1]];
      const density = Math.sqrt(Math.abs(s[0] * t[1] - s[1] * t[0]) / 2 / area) * tile;      // 1: a metre of wall is a metre of texture
      assert.ok(density > 0.55 && density < 1.6, `${design.signature} ${id}: the texture is ${density.toFixed(2)} times its size on a face of ${area.toFixed(2)} m² near (${a.map((q) => q.toFixed(2)).join(", ")})`);
    });
  }
});

test("nobody sees through a house from the street or from behind", () => {
  // At a height y, the stretch of x that the faces turned to the street (or away from it) cover must be the whole
  // width of the house. Two rooms that only touch, a stair or a yard wall against a leaning wall, left cracks of up
  // to 4 cm here before they were made to run on into each other (HOUSE_KIT.into).
  const cover = (mesh: HouseMesh, y: number, sign: number) => {
    const spans: [number, number][] = [];
    triangles(mesh, PARTS, (t) => {
      if (cross(...t)[2] * sign <= 1e-9) return;                                // not turned that way
      const xs: number[] = [];
      for (let e = 0; e < 3; e++) { const p = t[e], q = t[(e + 1) % 3]; if ((p[1] - y) * (q[1] - y) <= 0 && p[1] !== q[1]) xs.push(p[0] + ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1])); }
      if (xs.length >= 2) spans.push([Math.min(...xs), Math.max(...xs)]);
    });
    return spans.sort((a, b) => a[0] - b[0]);
  };
  const widestGap = (spans: [number, number][], x0: number, x1: number) => { let x = x0, gap = 0; for (const [a, b] of spans) { if (a > x && a < x1) gap = Math.max(gap, Math.min(a, x1) - x); x = Math.max(x, b); if (x >= x1) break; } return Math.max(gap, x1 - x); };
  let checked = 0;
  for (const { design, mesh } of every) {
    // above a yard's wall (1.25 m at the lowest) one does see into the yard and past it: that is what a yard is
    const heights = design.kind === "patio" ? [0.15, 0.6, 1.1] : [0.15, 0.6, 1.1, 1.4];
    for (const [name, sign] of [["the street", 1], ["behind", -1]] as const) for (const y of heights) {
      const gap = widestGap(cover(mesh, y, sign), design.base.x0 + 0.06, design.base.x1 - 0.06);
      assert.ok(gap < 1e-6, `${design.signature} (seed ${design.seed}): a gap of ${(gap * 100).toFixed(1)} cm seen from ${name} at ${y} m`);
      checked++;
    }
  }
  assert.equal(checked, (every.length * 4 - every.filter((b) => b.design.kind === "patio").length) * 2);
});

test("seen from above and from its four sides, the first surface one meets faces the viewer", () => {
  // A face wound the wrong way round is drawn only from inside, so from outside there is a hole where it should be;
  // its normals come from the same winding, so only looking from outside tells. For each view the faces are drawn on
  // a grid of points 4 cm apart, nearest wins, and no point may show the back of a face in front of every front.
  const CELL = 0.04, views = [{ name: "above", d: 1, a: 0, b: 2, s: 1 }, { name: "the street", d: 2, a: 0, b: 1, s: 1 }, { name: "behind", d: 2, a: 0, b: 1, s: -1 }, { name: "the right", d: 0, a: 2, b: 1, s: 1 }, { name: "the left", d: 0, a: 2, b: 1, s: -1 }] as const;
  let points = 0;
  for (const { lot, design, mesh } of every) for (const view of views) {
    const size = [lot.w, mesh.height + 0.2, lot.d], low = [-lot.w / 2, -0.1, -lot.d / 2];
    const na = Math.ceil(size[view.a] / CELL) + 1, nb = Math.ceil(size[view.b] / CELL) + 1, front = new Float32Array(na * nb).fill(-Infinity), back = new Float32Array(na * nb).fill(-Infinity);
    triangles(mesh, PARTS, (t) => {
      const facing = cross(...t)[view.d] * view.s;
      if (Math.abs(facing) < 1e-9) return;                                       // seen edge-on
      const A = t.map((p) => [p[view.a], p[view.b], p[view.d] * view.s]), buffer = facing > 0 ? front : back;
      const det = (A[1][1] - A[2][1]) * (A[0][0] - A[2][0]) + (A[2][0] - A[1][0]) * (A[0][1] - A[2][1]);
      const i0 = Math.max(0, Math.ceil((Math.min(A[0][0], A[1][0], A[2][0]) - low[view.a]) / CELL)), i1 = Math.min(na - 1, Math.floor((Math.max(A[0][0], A[1][0], A[2][0]) - low[view.a]) / CELL));
      const j0 = Math.max(0, Math.ceil((Math.min(A[0][1], A[1][1], A[2][1]) - low[view.b]) / CELL)), j1 = Math.min(nb - 1, Math.floor((Math.max(A[0][1], A[1][1], A[2][1]) - low[view.b]) / CELL));
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const x = low[view.a] + i * CELL, y = low[view.b] + j * CELL;
        const l0 = ((A[1][1] - A[2][1]) * (x - A[2][0]) + (A[2][0] - A[1][0]) * (y - A[2][1])) / det, l1 = ((A[2][1] - A[0][1]) * (x - A[2][0]) + (A[0][0] - A[2][0]) * (y - A[2][1])) / det, l2 = 1 - l0 - l1;
        if (l0 < -1e-7 || l1 < -1e-7 || l2 < -1e-7) continue;
        const depth = l0 * A[0][2] + l1 * A[1][2] + l2 * A[2][2], k = i * nb + j;
        if (depth > buffer[k]) buffer[k] = depth;
      }
    });
    for (let k = 0; k < front.length; k++) {
      if (front[k] > -Infinity) points++;
      // and from above there is something everywhere over the house's base: a roof, or the trodden earth of a yard,
      // a porch or the strip before a room set back (on a slope those would be pits down to the terrain)
      else if (view.name === "above") {
        const x = low[0] + Math.floor(k / nb) * CELL, z = low[2] + (k % nb) * CELL, b = design.base;
        assert.ok(!(x > b.x0 + 0.08 && x < b.x1 - 0.08 && z > b.z0 + 0.08 && z < b.z1 - 0.08), `${design.signature} (seed ${design.seed}): nothing over the base at (${x.toFixed(2)}, ${z.toFixed(2)})`);
      }
      if (back[k] > front[k] + 2e-3) assert.fail(`${design.signature} (seed ${design.seed}): from ${view.name}, at (${(low[view.a] + Math.floor(k / nb) * CELL).toFixed(2)}, ${(low[view.b] + (k % nb) * CELL).toFixed(2)}) the back of a face is ${front[k] === -Infinity ? "all there is" : `${((back[k] - front[k]) * 100).toFixed(1)} cm in front of the nearest front`}`);
    }
  }
  assert.ok(points > 3_000_000, `${points} points looked at`);
});

test("a corner shared by two walls stays closed while it wanders", () => {
  // two walls of a room meeting at (2, y, 3), with different openings, as room() builds them
  const m = new MeshBuilder(), opts = { batter: 0.035, bump: 0.034, wander: 0.028 };
  m.wall("wall", [-2, 0, 3], [0, 0, 1], 4, 2.9, { ...opts, holes: [{ u0: 1.2, u1: 2.1, v0: 0, v1: 1.83, depth: 0.26, back: "door" }] });
  m.wall("wall", [2, 0, 3], [1, 0, 0], 5, 2.9, { ...opts, holes: [{ u0: 2, u1: 2.4, v0: 1.71, v1: 2.2, depth: 0.24, back: "dark" }, { u0: 3, u1: 3.4, v0: 2.56, v1: 2.8, depth: 0.24, back: "dark" }, { u0: 4, u1: 4.3, v0: 0.2, v1: 0.33, depth: 0.24, back: "dark" }] });
  const { positions: P, normals: N } = m.finish().wall, front: P3[] = [], side: P3[] = [];
  for (let k = 0; k < P.length; k += 3) {
    if (Math.hypot(P[k] - 2, P[k + 2] - 3) > 0.12) continue;                     // near the corner's line
    if (N[k + 2] > 0.9) front.push([P[k], P[k + 1], P[k + 2]]); else if (N[k] > 0.9) side.push([P[k], P[k + 1], P[k + 2]]);
  }
  assert.ok(front.length >= 6 && side.length > front.length, "both walls have points up the corner, the side wall more of them");
  const line = (pts: P3[]) => [...pts].sort((a, b) => a[1] - b[1]);
  const off = (p: P3, pts: P3[]) => {                                           // how far p is from the line through pts
    let best = Infinity;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
      const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1] + (p[2] - a[2]) * d[2]) / l2)) : 0;
      best = Math.min(best, Math.hypot(p[0] - a[0] - t * d[0], p[1] - a[1] - t * d[1], p[2] - a[2] - t * d[2]));
    }
    return best;
  };
  // the side wall's windows add points low, in the middle and near the top of the corner: each is on the front wall's edge
  for (const p of front) assert.ok(off(p, line(side)) < 1e-6, `a point of the front wall is ${(off(p, line(side)) * 1000).toFixed(2)} mm off the side wall's corner`);
  for (const p of side) assert.ok(off(p, line(front)) < 1e-6, `a point of the side wall at ${p[1].toFixed(2)} m is ${(off(p, line(front)) * 1000).toFixed(2)} mm off the front wall's corner`);
  // and it does wander: it is not the straight leaning line
  assert.ok(front.some((p) => Math.abs(p[0] - (2 - (0.035 * p[1]) / 2.9)) > 0.004), "the corner is not a ruled line");
  assert.ok(front.every((p) => Math.abs(p[0] - (2 - (0.035 * p[1]) / 2.9)) <= 0.028 + 1e-6), "and no further out than it may be");
});

test("cheaper than the three sculpted meshes it could replace", () => {
  const now = town.plans.reduce((n, p) => n + catalog.assets[["casa-basalto-a", "casa-basalto-b", "casa-basalto-c"][p.variant]].triangles, 0);
  const kit = built.reduce((n, b) => n + b.mesh.triangles, 0), most = Math.max(...built.map((b) => b.mesh.triangles));
  assert.ok(now > 500000, `the village's houses today, from the catalogue: ${now}`);
  assert.ok(kit < now * 0.4, `${kit} triangles against ${now}`);
  assert.ok(most <= 2600, `the heaviest house has ${most} triangles`);
  for (const b of built) assert.equal(b.mesh.triangles, PARTS.reduce((n, id) => n + b.mesh[id].indices.length / 3, 0));
});

test("the whole village as three meshes: every house turned and put on its lot as the town turns its lots", () => {
  const placed = built.map((b, i) => ({ mesh: b.mesh, x: town.plans[i].x, y: town.plans[i].y, z: town.plans[i].z, rot: town.plans[i].rot }));
  const village = mergeHouses(placed);
  assert.equal(village.triangles, built.reduce((n, b) => n + b.mesh.triangles, 0));
  assert.ok(Math.abs(village.height - Math.max(...placed.map((h) => h.y + h.mesh.height))) < 1e-4);
  let offset = { wall: 0, mud: 0, wood: 0 }, faces = { wall: 0, mud: 0, wood: 0 };
  built.forEach((b, i) => {
    const plan = town.plans[i];
    for (const id of PARTS) {
      const src = b.mesh[id], dst = village[id], n = src.positions.length / 3;
      for (const k of [0, Math.floor(n / 2), n - 1]) {
        if (n === 0) break;
        const at = buildingPoint(plan, src.positions[k * 3], src.positions[k * 3 + 2]), o = (offset[id] + k) * 3;
        assert.ok(Math.abs(dst.positions[o] - at.x) < 1e-3 && Math.abs(dst.positions[o + 2] - at.z) < 1e-3 && Math.abs(dst.positions[o + 1] - plan.y - src.positions[k * 3 + 1]) < 1e-3, `house ${i + 1}: a point where the lot puts it`);
        // its normal turns with it: the facade's faces look where the lot's front looks
        const to = buildingPoint({ x: 0, z: 0, rot: plan.rot }, src.normals[k * 3], src.normals[k * 3 + 2]);
        assert.ok(Math.abs(dst.normals[o] - to.x) < 1e-4 && Math.abs(dst.normals[o + 2] - to.z) < 1e-4 && Math.abs(dst.normals[o + 1] - src.normals[k * 3 + 1]) < 1e-6);
        assert.equal(dst.uvs[(offset[id] + k) * 2], src.uvs[k * 2]); assert.equal(dst.colors[o], src.colors[k * 3]);
      }
      for (const k of [0, src.indices.length - 1]) if (src.indices.length) assert.equal(dst.indices[faces[id] + k], src.indices[k] + offset[id]);
      offset[id] += n; faces[id] += src.indices.length;
    }
  });
  for (const id of PARTS) { assert.equal(village[id].positions.length / 3, offset[id]); assert.equal(village[id].indices.length, faces[id]); assert.ok(village[id].indices.every((v) => v < offset[id])); }
  // every house's entrance is on the side of its lot that the town calls the front
  built.forEach((b, i) => {
    const plan = town.plans[i], front = buildingPoint(plan, 0, plan.d / 2), door = buildingPoint(plan, b.design.entrance.x, b.design.entrance.z);
    assert.ok(Math.hypot(door.x - front.x, door.z - front.z) <= plan.w / 2 + 0.3, `house ${i + 1}: its entrance is ${Math.hypot(door.x - front.x, door.z - front.z).toFixed(1)} m from the middle of its front`);
  });
  assert.deepEqual(mergeHouses([]).triangles, 0);
});

test("the kit is plain data: no renderer in it, and its materials are the files the catalogue names", () => {
  assert.doesNotMatch(readFileSync(new URL("../src/house-kit.ts", import.meta.url), "utf8"), /from ["']three/);
  const materials = JSON.parse(read("src/data/house-materials-r17.json").toString());
  assert.deepEqual(Object.keys(materials.materials), ["basalt-wall", "mud-plaster"]);
  let files = 0;
  for (const [name, m] of Object.entries(materials.materials) as [string, { tileMeters: number; profiles: Record<string, Record<string, { url: string; bytes: number; sha256: string; size: number }>> }][]) {
    assert.equal(m.tileMeters, name === "basalt-wall" ? HOUSE_KIT.tile.wall : HOUSE_KIT.tile.mud, "the kit draws the material at the size it was made for");
    for (const [profile, roles] of Object.entries(m.profiles)) for (const entry of Object.values(roles)) {
      const bytes = read(`public/${entry.url}`);
      assert.equal(bytes.length, entry.bytes); assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
      assert.equal(entry.size, profile === "mobile" ? 512 : 1024); files++;
    }
  }
  assert.equal(files, 12);
});

test("docs/CASAS-R17-NUMEROS.md is what the code gives on the village's lots", () => {
  const text: string = render();
  assert.equal(readFileSync(new URL("../docs/CASAS-R17-NUMEROS.md", import.meta.url), "utf8"), text, "run node tools/build_house_report.mjs");
  assert.match(text, /\| Triângulos das casas da vila \| [\d.]+ \| [\d.]+ \|/);
  assert.equal(text.split("\n").filter((l) => /^\| `(sala|duas-salas|patio|escada|alpendre|sobrado)` \|/.test(l)).length, 6, "six kinds of house");
});
