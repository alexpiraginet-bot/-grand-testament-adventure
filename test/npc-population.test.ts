// Who is drawn and what they do. The crowd used below is made of test doubles (models named "teste-*"): the game
// itself has one reviewed mesh, Simão's, and the first test pins that everyone else is absent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MARGIN, beach, read, routes, scene, start, t } from "./fixtures/town-scene.ts";
import { insideObstacle } from "../src/world-layout.ts";
import { NPC_MOTION, npcStandable } from "../src/npc-navigation.ts";
import { townLife, townNpcGround, townPlaces, type TownLifeInput } from "../src/town-life-layout.ts";
import {
  ABSENCE_NOTE, NPC_APPROVED, NPC_BUDGET, NPC_MODELS, NPC_ROUTINE, NPC_SECTOR_M, animationRate, cast, episodeIdentities, presence, sectorOf,
  select, settle, stepResidents, type NpcIdentity, type NpcModel, type Resident,
} from "../src/npc-population.ts";

const town = scene(256);
const input: TownLifeInput = { terrain: t, start, beach, routes, plans: town.plans, boxes: town.boxes, margin: MARGIN };
const life = townLife(input)!, places = townPlaces(input, life), ground = townNpcGround(t, town.boxes, MARGIN);
const episode = JSON.parse(read("src/data/mc-pescadores.json").toString());
const names: Record<string, string> = Object.fromEntries(episode.personagens.map((p: { id: string; nome: string }) => [p.id, p.nome]));
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

// test doubles: unnamed adults whose mesh was (in the test only) reviewed for reuse
const double = (id: string, clips: NpcModel["clips"], maxCopies = 40): NpcModel => ({ id, approval: NPC_APPROVED, clips, walkSpeedMps: 0.7, portrays: null, maxCopies });
const people = (n: number, model: string, prefix = "morador"): NpcIdentity[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${String(i + 1).padStart(2, "0")}`, nome: null, role: "resident" as const, model, mission: false }));
const crowd = (n: number, clips: NpcModel["clips"] = ["idle", "walk"]) => {
  const models = [double("teste-a", clips)];
  return cast(people(n, "teste-a"), models, new Set(["teste-a"])).present;
};

test("today only Simão is drawn: the others of the passage are absent, each with the reason, and nothing stands in for them", () => {
  const identities = episodeIdentities(names, t.meta.level_design.empregados);
  assert.deepEqual(identities.map((i) => i.id), ["simao", "andre", "tiago", "joao", "zebedeu", "empregado1", "empregado2"]);
  assert.deepEqual(identities.map((i) => i.nome), ["Simão", "André", "Tiago", "João", "Zebedeu", null, null], "names come from the episode's data");
  const now = cast(identities, NPC_MODELS, new Set(["simao-r12"]));
  assert.deepEqual(now.present.map((m) => m.id), ["simao"]);
  assert.deepEqual(now.absent, ["andre", "tiago", "joao", "zebedeu", "empregado1", "empregado2"].map((id) => ({ id, why: "sem-modelo" })));
  for (const a of now.absent) assert.ok(ABSENCE_NOTE[a.why].length > 0);
  // before his file arrives, or on a device where it failed, he is absent too
  assert.deepEqual(cast(identities, NPC_MODELS, new Set()).present, []);
  assert.equal(cast(identities, NPC_MODELS, new Set()).absent[0].why, "nao-carregado");
  // the reviewed mesh in this list is the one the catalogue ships
  const catalogue = JSON.parse(read("src/data/npc-assets.json").toString());
  assert.equal(NPC_MODELS.length, 1);
  assert.deepEqual([NPC_MODELS[0].id, NPC_MODELS[0].approval, NPC_MODELS[0].walkSpeedMps], [catalogue.id, catalogue.approval, catalogue.animation.walkSpeedMps]);
  assert.deepEqual(NPC_MODELS[0].clips, ["idle", "walk"], "no talk or net clip exists yet");
  // settled, the only person is the mission's and no routine moves him
  const { residents } = settle(now.present, places, ground);
  assert.deepEqual(residents.map((r) => [r.id, r.routine.kind, r.mission]), [["simao", "mission", true]]);
  assert.deepEqual(presence(residents, new Set(["simao"])).drawn, [], "the mission draws its own people; the ambient lists stay empty");
});

test("a mesh is never worn by the wrong person, and an unreviewed or missing one draws nobody", () => {
  const simao = NPC_MODELS[0];
  const who = (identity: Partial<NpcIdentity>, models: NpcModel[], loaded = models.map((m) => m.id)) =>
    cast([{ id: "x", nome: null, role: "resident", model: models[0]?.id ?? null, mission: false, ...identity }], models, new Set(loaded));
  // Simão's mesh on André: refused. A copy of it under another id would still say whom it portrays.
  assert.deepEqual(who({ id: "andre", nome: "André", model: "simao-r12" }, [simao]).absent, [{ id: "andre", why: "de-outra-pessoa" }]);
  // an unnamed adult's mesh on a named person: refused; on an unnamed one: drawn
  assert.equal(who({ id: "andre", nome: "André" }, [double("teste-a", ["idle"])]).absent[0].why, "de-outra-pessoa");
  assert.deepEqual(who({}, [double("teste-a", ["idle"])]).present.map((m) => m.id), ["x"]);
  assert.equal(who({}, [{ ...double("teste-a", ["idle"]), approval: "awaiting-rig-not-used-in-game" }]).absent[0].why, "nao-aprovado");
  assert.equal(who({}, [double("teste-a", ["walk"])]).absent[0].why, "sem-idle");
  assert.equal(who({ model: "outro" }, [double("teste-a", ["idle"])]).absent[0].why, "modelo-desconhecido");
  assert.equal(who({ model: null }, [double("teste-a", ["idle"])]).absent[0].why, "sem-modelo");
  assert.equal(who({}, [double("teste-a", ["idle"])], []).absent[0].why, "nao-carregado");
  // copies: only as many as the art was reviewed for, always the same people
  const three = cast(people(3, "teste-a"), [double("teste-a", ["idle"], 2)], new Set(["teste-a"]));
  assert.deepEqual(three.present.map((m) => m.id), ["morador-01", "morador-02"]);
  assert.deepEqual(three.absent, [{ id: "morador-03", why: "copias-esgotadas" }]);
  assert.throws(() => cast([...people(1, "teste-a"), ...people(1, "teste-a")], [double("teste-a", ["idle"])], new Set()), /Duplicate identity/);
});

test("the places offered to people are standable, off the streets' lines and apart from one another", () => {
  assert.ok(places.spots.length >= 8, `${places.spots.length} places`);
  assert.deepEqual(places.lanes.map((l) => l.id), ["rua-do-patio", "rua-da-vila"]);
  for (const s of places.spots) {
    assert.ok(npcStandable(ground, s.at), `${s.id} is not standable`);
    assert.ok(t.heightAt(s.at.x, s.at.z) >= 0.015);
    for (const o of places.spots) if (o !== s) assert.ok(dist(o.at, s.at) >= 1, `${s.id} and ${o.id} overlap`);
    if (s.pair) assert.equal(places.spots.find((o) => o.id === s.pair)?.pair, s.id, "pairs point at each other");
  }
  // nobody is asked to stand where the hero walks to the yard or down to the shore
  const line = [...life.street.points.slice(1).map((b, i) => [life.street.points[i], b] as const), ...routes.map((r) => [{ x: r.ax, z: r.az }, { x: r.bx, z: r.bz }] as const)];
  for (const s of places.spots) for (const [a, b] of line) {
    const dx = b.x - a.x, dz = b.z - a.z, u = Math.max(0, Math.min(1, ((s.at.x - a.x) * dx + (s.at.z - a.z) * dz) / (dx * dx + dz * dz)));
    assert.ok(Math.hypot(s.at.x - a.x - u * dx, s.at.z - a.z - u * dz) >= 1.9 - 1e-9, `${s.id} stands in a passage`);
  }
  // the yard's ring looks at its centre and leaves the street's way in open
  const ring = places.spots.filter((s) => s.id.startsWith("patio-"));
  assert.ok(ring.length >= 5 && ring.length < 8, "the place on the way in is left out");
  for (const s of ring) assert.ok(Math.abs(Math.atan2(life.court.at.x - s.at.x, -(life.court.at.z - s.at.z)) - s.facing) < 1e-9);
});

test("settling is reproducible, puts each person on free ground, pairs people two by two and never stacks them", () => {
  const present = crowd(30);
  const a = settle(present, places, ground, 7), b = settle(present, places, ground, 7), c = settle(present, places, ground, 8);
  assert.deepEqual(a, b, "the same seed gives the same town");
  assert.notDeepEqual(a.residents.map((r) => [r.id, r.routine]), c.residents.map((r) => [r.id, r.routine]), "another seed, another arrangement");
  assert.equal(a.residents.length + a.unplaced.length, 30);
  for (const r of a.residents) {
    assert.ok(npcStandable(ground, r.pos), `${r.id} stands on bad ground`);
    for (const o of a.residents) if (o !== r) assert.ok(dist(o.pos, r.pos) >= 0.9, `${r.id} and ${o.id} are stacked`);
  }
  const kinds = a.residents.map((r) => r.routine.kind);
  assert.ok(kinds.includes("talk") && kinds.includes("walk") && kinds.includes("wait"));
  assert.ok(!kinds.includes("net"), "nobody tends a net without the reviewed clip");
  for (const r of a.residents) if (r.routine.kind === "talk") {
    const other = a.residents.find((o) => o.id === (r.routine as { with: string }).with)!;
    assert.equal(other.routine.kind, "talk"); assert.equal((other.routine as { with: string }).with, r.id);
    assert.ok(Math.abs(Math.atan2(other.pos.x - r.pos.x, -(other.pos.z - r.pos.z)) - r.heading) < 1e-9, "turned to each other");
    assert.equal(r.clip, "idle", "without a talk clip a conversation is two people standing, not a made-up gesture");
  }
  // a mesh with the net clip may take the shore's places; one that cannot walk only stands, and the rest are left out
  const withNet = settle(crowd(6, ["idle", "net"]), places, ground, 7);
  assert.equal(withNet.residents.filter((r) => r.routine.kind === "net").length, 2);
  const standing = settle(crowd(30, ["idle"]), places, ground, 7);
  assert.ok(standing.residents.every((r) => r.routine.kind !== "walk"));
  assert.equal(standing.residents.length, places.spots.filter((s) => s.use === "wait").length);
  assert.equal(standing.unplaced.length, 30 - standing.residents.length, "who finds no place is left out, not piled up");
});

test("the people drawn stay within the budget, nearest first, without flicker at the edge, and nobody in a dialogue vanishes", () => {
  const far = (id: string, x: number, z: number): Resident => ({ id, model: "teste-a", mission: false, routine: { kind: "wait", spot: "s" }, home: { x, z }, pos: { x, z }, heading: 0, speed: 0, clip: "idle", pace: 0.7, dir: 1, leg: 0, hold: 0 });
  const ring = Array.from({ length: 30 }, (_, i) => far(`p${String(i).padStart(2, "0")}`, 3 + i * 2, 0));       // 3 m, 5 m, ... 61 m east
  const player = { x: 0, z: 0 };
  for (const [name, budget] of Object.entries(NPC_BUDGET)) {
    const s = select(ring, player, budget, new Set());
    assert.equal(s.active.length, budget.near, `${name}: ${budget.near} at once`);
    assert.deepEqual(s.active, ring.slice(0, budget.near).map((r) => r.id), "the nearest");
    assert.deepEqual(s.added, s.active); assert.deepEqual(s.removed, []);
  }
  assert.deepEqual([NPC_BUDGET.mobile.near, NPC_BUDGET.desktop.near], [8, 20]);
  const B = NPC_BUDGET.mobile;
  // between the two radii: stays if already drawn, does not come in if not
  const edge = [far("edge", (B.load + B.unload) / 2, 0)];
  assert.deepEqual(select(edge, player, B, new Set()).active, []);
  assert.deepEqual(select(edge, player, B, new Set(["edge"])).active, ["edge"]);
  assert.deepEqual(select([far("gone", B.unload + 1, 0)], player, B, new Set(["gone"])).removed, ["gone"]);
  // someone being spoken to keeps the place even far away and past the budget; so do the mission's people
  const talking = far("talking", 500, 500), simao = { ...far("simao", 900, 0), mission: true };
  const s = select([...ring, talking, simao], player, B, new Set(), new Set(["talking"]));
  assert.ok(s.active.includes("talking") && s.active.includes("simao"));
  assert.equal(s.active.length, B.near, "they take slots from the budget, they are not added on top");
  const many = Array.from({ length: 12 }, (_, i) => far(`t${i}`, 400 + i, 0));
  assert.equal(select([...ring, ...many], player, B, new Set(), new Set(many.map((m) => m.id))).active.length, 12, "all twelve in dialogue stay; nobody else comes in");
  // sectors: people of far sectors are not even measured
  assert.equal(sectorOf({ x: -1, z: 130 }), "-1:2"); assert.equal(NPC_SECTOR_M, 64);
  assert.deepEqual(select([far("other-side", 2000, -2000)], player, NPC_BUDGET.desktop, new Set(["other-side"])).active, []);
  // out of view the mixer is suspended; in view it runs fully only near
  assert.equal(animationRate(10, false, B), "suspended");
  assert.equal(animationRate(B.full, true, B), "full");
  assert.equal(animationRate(B.full + 1, true, B), "reduced");
});

test("routines for two minutes: walkers keep to dry open ground at their pace, turn back at the ends, and standers stay put", () => {
  const { residents } = settle(crowd(30), places, ground, 7);
  const active = new Set(residents.map((r) => r.id)), away = { x: 800, z: -800 }, DT = 0.05;
  const before = residents.map((r) => ({ ...r.pos })), travelled = residents.map(() => 0), turned = residents.map((r) => r.dir);
  let reversed = 0;
  for (let frame = 0; frame < 120 / DT; frame++) {
    const was = residents.map((r) => ({ ...r.pos }));
    stepResidents(residents, active, places, ground, away, DT);
    residents.forEach((r, i) => {
      const moved = dist(was[i], r.pos);
      travelled[i] += moved;
      assert.ok(moved <= r.pace * DT + 1e-9, `${r.id} jumped ${moved.toFixed(3)} m in a frame`);
      if (moved > 0) {
        assert.ok(npcStandable(ground, r.pos), `${r.id} walked onto bad ground`);
        assert.ok(!town.boxes.some((b) => insideObstacle(r.pos.x, r.pos.z, b, NPC_MOTION.radius * 0.9)), `${r.id} walked into a collider`);
        assert.equal(r.clip, "walk"); assert.ok(Math.abs(r.speed - r.pace) < 1e-6 || r.speed < r.pace);
      }
      if (r.dir !== turned[i]) { turned[i] = r.dir; reversed++; }
    });
    for (let i = 0; i < residents.length; i++) for (let j = i + 1; j < residents.length; j++)
      assert.ok(dist(residents[i].pos, residents[j].pos) >= NPC_MOTION.radius * 2, `${residents[i].id} and ${residents[j].id} walked into each other`);
  }
  residents.forEach((r, i) => {
    if (r.routine.kind === "walk") assert.ok(travelled[i] > 5, `${r.id} only walked ${travelled[i].toFixed(1)} m in two minutes`);
    else { assert.deepEqual(r.pos, before[i]); assert.equal(travelled[i], 0); assert.equal(r.clip, "idle"); }
  });
  assert.ok(reversed > 0, "someone reached an end or met someone and turned back");
});

test("a pause moves nobody, people not drawn are not stepped, and those in a conversation hold still", () => {
  const { residents } = settle(crowd(12), places, ground, 7);
  const walker = residents.find((r) => r.routine.kind === "walk")!, all = new Set(residents.map((r) => r.id)), away = { x: 800, z: -800 };
  const snapshot = () => JSON.stringify(residents);
  let was = snapshot();
  for (const dt of [0, -1, NaN]) stepResidents(residents, all, places, ground, away, dt);
  assert.equal(snapshot(), was);
  stepResidents(residents, new Set(), places, ground, away, 0.05);
  assert.equal(snapshot(), was, "nobody is active: nothing is stepped");
  for (let i = 0; i < 100; i++) stepResidents(residents, all, places, ground, away, 0.05, new Set([walker.id]));
  assert.deepEqual(walker.pos, JSON.parse(was).find((r: Resident) => r.id === walker.id).pos, "busy: he does not walk off mid-sentence");
  assert.equal(walker.speed, 0); assert.equal(walker.clip, "idle");
});

test("a walker stops for the player in his way and goes on when the way is free; a waiting person turns to who comes near", () => {
  const { residents } = settle(crowd(12), places, ground, 7);
  const all = new Set(residents.map((r) => r.id)), away = { x: 800, z: -800 }, DT = 0.05;
  const walker = residents.find((r) => r.routine.kind === "walk")!;
  for (let i = 0; i < 200; i++) stepResidents(residents, all, places, ground, away, DT);     // let him turn and get going
  assert.ok(walker.speed > 0, "he is walking");
  // the player steps 1.2 m in front of him
  const front = { x: walker.pos.x + Math.sin(walker.heading) * 1.2, z: walker.pos.z - Math.cos(walker.heading) * 1.2 };
  for (let i = 0; i < 100; i++) {
    stepResidents(residents, all, places, ground, front, DT);
    assert.ok(dist(walker.pos, front) >= 1.2 - 0.7 * DT - 1e-9, "he does not walk into the player");
    assert.equal(walker.speed, 0);
  }
  assert.equal(walker.clip, "idle");
  const stopped = { ...walker.pos };
  // the way is free again: after a short wait he goes on
  for (let i = 0; i < NPC_ROUTINE.resume / DT - 2; i++) stepResidents(residents, all, places, ground, away, DT);
  assert.deepEqual(walker.pos, stopped, "he waits a moment first");
  for (let i = 0; i < 200; i++) stepResidents(residents, all, places, ground, away, DT);
  assert.ok(dist(walker.pos, stopped) > 1, "then walks on");
  // someone waiting looks at the player who comes within reach, and back to his own business when they leave
  const waiter = residents.find((r) => r.routine.kind === "wait")!, spot = places.spots.find((s) => s.id === (waiter.routine as { spot: string }).spot)!;
  const beside = { x: waiter.pos.x - Math.sin(spot.facing) * 2, z: waiter.pos.z + Math.cos(spot.facing) * 2 };   // 2 m behind him
  for (let i = 0; i < 100; i++) stepResidents(residents, all, places, ground, beside, DT);
  const toPlayer = Math.atan2(beside.x - waiter.pos.x, -(beside.z - waiter.pos.z));
  assert.ok(Math.abs(Math.atan2(Math.sin(waiter.heading - toPlayer), Math.cos(waiter.heading - toPlayer))) < 0.02, "he turned round to the player");
  for (let i = 0; i < 100; i++) stepResidents(residents, all, places, ground, away, DT);
  assert.ok(Math.abs(Math.atan2(Math.sin(waiter.heading - spot.facing), Math.cos(waiter.heading - spot.facing))) < 0.02);
});

test("only the people drawn exist for the rest of the game: colliders and targets come from that list alone", () => {
  const { residents } = settle(crowd(12), places, ground, 7);
  const active = new Set(residents.slice(0, 5).map((r) => r.id));
  const here = presence(residents, active);
  assert.deepEqual(here.drawn.map((d) => d.id).sort(), [...active].sort());
  assert.deepEqual(here.colliders.map((c) => c.id), here.drawn.map((d) => d.id));
  for (const c of here.colliders) assert.equal(c.radius, NPC_MOTION.radius);
  assert.deepEqual(presence(residents, new Set()).drawn, []);
  assert.deepEqual(presence(residents, new Set(["nobody"])).colliders, []);
});
