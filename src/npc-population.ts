// Who lives in the town, who is drawn, and what each one is doing. Three things are kept apart on purpose:
//   an identity   a person of the story or of the street, with a stable id (saved progress and encounters refer to it)
//   a model       a mesh with rig and clips that someone reviewed in the game
//   a routine     what the person does when nobody is talking to them
// A person is PRESENT only when a reviewed model that portrays them is loaded. Everyone else is ABSENT, with the
// reason, and an absent person is nothing: no mesh, no collider, no radar mark, no voice, no target for the action
// button. Alex's rule (R9): the absence of a person is better than a doll or an unfinished mesh. So nothing here
// invents a stand-in, and a named person's mesh is never worn by anybody else.
//
// The numbers are test budgets to start measuring from (8 people near on a phone, 20 on a desktop), not a count of
// the historical town nor a measured capacity. More people on the map come from loading by sectors, never from
// hundreds of animated skeletons at once: far ones are not updated and their mixers are suspended.
//
// Pure and deterministic (test/npc-population.test.ts). No three.js, no input, no clock: the scene's adapter
// (npc-actor.ts, main.ts) draws the active people where this module says they are. Movement uses the follower's own
// ground rules (npc-navigation.ts): body clearance, dry footing, slope, never through a house, never a teleport.
import type { Vec2 } from "./missions.ts";
import { rng } from "./world-layout.ts";
import { NPC_MOTION, npcCanTraverse, npcStandable, type NpcGround } from "./npc-navigation.ts";

export type NpcClip = "idle" | "walk" | "talk" | "net";
export const NPC_APPROVED = "reviewed-integration-candidate";

export type NpcModel = {
  id: string;
  /** Only NPC_APPROVED enters a scene. */
  approval: string;
  /** The reviewed clips this mesh has. Every model needs "idle"; a routine asks for its own. */
  clips: readonly NpcClip[];
  walkSpeedMps: number;
  /** The one person this mesh is (an identity id), or null for a mesh reviewed as an unnamed adult. */
  portrays: string | null;
  /** How many unnamed people may wear this mesh at the same time. 1 unless the art was reviewed for reuse. */
  maxCopies: number;
};

export type NpcIdentity = {
  id: string;
  /** The name as the BLIVRE writes it; null for the unnamed. */
  nome: string | null;
  role: "disciple" | "worker" | "resident";
  /** The model reviewed for this person; null while there is none. */
  model: string | null;
  /** A person of the mission: keeps a slot whatever the crowd, and is moved by the mission, not by a routine. */
  mission: boolean;
};

export type Absence = "sem-modelo" | "modelo-desconhecido" | "nao-aprovado" | "sem-idle" | "de-outra-pessoa" | "copias-esgotadas" | "nao-carregado";
export const ABSENCE_NOTE: Record<Absence, string> = {
  "sem-modelo": "ainda não tem malha com rig e animação revisados",
  "modelo-desconhecido": "o catálogo não tem o modelo indicado",
  "nao-aprovado": "o modelo ainda não foi aprovado no jogo",
  "sem-idle": "o modelo não tem a animação de repouso revisada",
  "de-outra-pessoa": "o modelo é de outra pessoa e não pode ser reutilizado",
  "copias-esgotadas": "todas as cópias permitidas desse modelo já estão em uso",
  "nao-carregado": "o modelo não foi carregado neste aparelho",
};

export type CastMember = { id: string; identity: NpcIdentity; model: NpcModel };
export type Cast = { present: CastMember[]; absent: { id: string; why: Absence }[] };

/** Who can be drawn: each identity against the catalogue and the models actually loaded. Order is the identities'
 * own, so the copies of a shared mesh always go to the same people. */
export function cast(identities: readonly NpcIdentity[], models: readonly NpcModel[], loaded: ReadonlySet<string>): Cast {
  const byId = new Map(models.map((m) => [m.id, m] as const)), copies = new Map<string, number>(), seen = new Set<string>();
  const out: Cast = { present: [], absent: [] };
  for (const identity of identities) {
    if (seen.has(identity.id)) throw Error(`Duplicate identity ${identity.id}`);
    seen.add(identity.id);
    const no = (why: Absence) => { out.absent.push({ id: identity.id, why }); };
    if (!identity.model) { no("sem-modelo"); continue; }
    const model = byId.get(identity.model);
    if (!model) { no("modelo-desconhecido"); continue; }
    if (model.approval !== NPC_APPROVED) { no("nao-aprovado"); continue; }
    if (!model.clips.includes("idle") || !(model.walkSpeedMps > 0)) { no("sem-idle"); continue; }
    if (model.portrays !== null ? model.portrays !== identity.id : identity.nome !== null) { no("de-outra-pessoa"); continue; }
    const used = copies.get(model.id) ?? 0;
    if (used >= (model.portrays !== null ? 1 : Math.max(1, Math.floor(model.maxCopies)))) { no("copias-esgotadas"); continue; }
    if (!loaded.has(model.id)) { no("nao-carregado"); continue; }
    copies.set(model.id, used + 1);
    out.present.push({ id: identity.id, identity, model });
  }
  return out;
}

// ---------------------------------------------------------------- where people stand and walk

/** A standing point of the town (town-life-layout.ts townPlaces): where, which way the person looks, and what it is for. */
export type Spot = { id: string; at: Vec2; facing: number; use: "wait" | "net"; pair?: string };
/** A walk: its points in order and the side the walker keeps to, in metres from its line (positive: right). */
export type Lane = { id: string; points: readonly Vec2[]; side: number };
export type TownPlaces = { spots: readonly Spot[]; lanes: readonly Lane[] };

export type Routine =
  | { kind: "mission" }                                  // moved by the mission (the follower): not stepped here
  | { kind: "wait"; spot: string }
  | { kind: "talk"; spot: string; with: string }         // two people at paired spots, turned to each other
  | { kind: "net"; spot: string }                        // only with the reviewed "net" clip
  | { kind: "walk"; lane: string };

export type Resident = {
  id: string;
  model: string;
  mission: boolean;
  routine: Routine;
  /** Where the person belongs: the spot, or the start of the lane. Used to choose who is loaded near the player. */
  home: Vec2;
  pos: Vec2;
  heading: number;
  speed: number;
  /** Which clip the adapter plays. */
  clip: NpcClip;
  /** The walking pace of this person's mesh, from its reviewed clip (metres per second). */
  pace: number;
  /** walk: 1 going along the lane's points, -1 coming back, and the stretch being walked. */
  dir: 1 | -1;
  leg: number;
  /** Seconds the walker still waits (after yielding or meeting something in the way). */
  hold: number;
};

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const turn = (from: number, to: number, most: number) => {
  const d = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + Math.max(-most, Math.min(most, d));
};
const headingTo = (a: Vec2, b: Vec2) => Math.atan2(b.x - a.x, -(b.z - a.z));

/** A point beside a lane's stretch, on the walker's side. */
function beside(a: Vec2, b: Vec2, u: number, side: number): Vec2 {
  const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
  return { x: a.x + dx * u - (dz / l) * side, z: a.z + dz * u + (dx / l) * side };
}

/** Gives each present person a place and something to do, the same for the same seed. Mission people keep the
 * mission's routine. The rest take, in order: paired spots two by two (a conversation needs two people), a net spot
 * if the mesh has the net clip, a walk if it has the walk clip, a waiting spot. Whoever finds no free, standable
 * place is left out (reported in `unplaced`), never stacked on someone else. */
export function settle(present: readonly CastMember[], places: TownPlaces, ground: NpcGround, seed = 1):
  { residents: Resident[]; unplaced: string[] } {
  const residents: Resident[] = [], unplaced: string[] = [];
  const order = present.filter((m) => !m.identity.mission).map((m) => ({ m, k: hash(`${seed}:${m.id}`) })).sort((a, b) => a.k - b.k || a.m.id.localeCompare(b.m.id)).map((x) => x.m);
  for (const m of present) if (m.identity.mission) {
    residents.push({ id: m.id, model: m.model.id, mission: true, routine: { kind: "mission" }, home: { x: 0, z: 0 }, pos: { x: 0, z: 0 }, heading: 0, speed: 0, clip: "idle", pace: m.model.walkSpeedMps, dir: 1, leg: 0, hold: 0 });
  }
  const free = places.spots.filter((s) => npcStandable(ground, s.at));
  const take = (pick: (s: Spot) => boolean) => { const i = free.findIndex(pick); return i < 0 ? null : free.splice(i, 1)[0]; };
  const stand = (m: CastMember, s: Spot, routine: Routine, clip: NpcClip, facing = s.facing) =>
    residents.push({ id: m.id, model: m.model.id, mission: false, routine, home: { ...s.at }, pos: { ...s.at }, heading: facing, speed: 0, clip, pace: m.model.walkSpeedMps, dir: 1, leg: 0, hold: 0 });
  const lanes = places.lanes.filter((l) => l.points.length >= 2);
  const walkers = new Map<string, number>();
  const queue = [...order];
  while (queue.length) {
    const m = queue.shift()!, r = rng(hash(`${seed}:${m.id}:routine`));
    const has = (c: NpcClip) => m.model.clips.includes(c);
    // a pair: this person and the next one still waiting, at two spots made for each other
    const partner = queue[0];
    const a = partner ? take((s) => s.use === "wait" && !!s.pair && free.some((o) => o.id === s.pair)) : null;
    if (a && partner) {
      const b = take((s) => s.id === a.pair)!;
      queue.shift();
      const clip = (who: CastMember): NpcClip => (who.model.clips.includes("talk") ? "talk" : "idle");
      stand(m, a, { kind: "talk", spot: a.id, with: partner.id }, clip(m), headingTo(a.at, b.at));
      stand(partner, b, { kind: "talk", spot: b.id, with: m.id }, clip(partner), headingTo(b.at, a.at));
      continue;
    }
    const net = has("net") ? take((s) => s.use === "net") : null;
    if (net) { stand(m, net, { kind: "net", spot: net.id }, "net"); continue; }
    if (has("walk") && lanes.length && r() < 0.6) {
      const lane = lanes.slice().sort((x, y) => (walkers.get(x.id) ?? 0) - (walkers.get(y.id) ?? 0) || x.id.localeCompare(y.id))[0];
      const n = walkers.get(lane.id) ?? 0;
      // spread along the lane, each on the walking side, at a standable point
      let placed = false;
      for (let attempt = 0; attempt < 12 && !placed; attempt++) {
        const leg = Math.floor(r() * (lane.points.length - 1)), u = 0.15 + r() * 0.7;
        const dir: 1 | -1 = (n + attempt) % 2 ? -1 : 1;
        const pos = beside(lane.points[leg], lane.points[leg + 1], u, lane.side * dir);
        if (!npcStandable(ground, pos) || residents.some((o) => !o.mission && dist(o.pos, pos) < 2.5)) continue;
        const to = dir === 1 ? lane.points[leg + 1] : lane.points[leg];
        residents.push({ id: m.id, model: m.model.id, mission: false, routine: { kind: "walk", lane: lane.id }, home: { ...pos }, pos, heading: headingTo(pos, to), speed: 0, clip: "idle", pace: m.model.walkSpeedMps, dir, leg, hold: 0 });
        walkers.set(lane.id, n + 1); placed = true;
      }
      if (placed) continue;
    }
    const spot = take((s) => s.use === "wait" && !s.pair) ?? take((s) => s.use === "wait");
    if (spot) stand(m, spot, { kind: "wait", spot: spot.id }, "idle"); else unplaced.push(m.id);
  }
  return { residents, unplaced };
}

// ---------------------------------------------------------------- who is drawn near the player

/** Test budgets to measure from. near: people drawn at once. load / unload: metres at which someone comes in and
 * goes out (apart, so nobody flickers at the edge). full: within this the mixer runs every frame; beyond it, at a
 * reduced rate; not drawn, not at all. */
export const NPC_BUDGET = {
  mobile: { near: 8, load: 70, unload: 85, full: 35 },
  desktop: { near: 20, load: 110, unload: 130, full: 55 },
} as const;
export type NpcBudget = { near: number; load: number; unload: number; full: number };
export const NPC_SECTOR_M = 64;
export const sectorOf = (p: Vec2) => `${Math.floor(p.x / NPC_SECTOR_M)}:${Math.floor(p.z / NPC_SECTOR_M)}`;

export type Selection = { active: string[]; added: string[]; removed: string[] };

/** The people drawn this frame. Order of claim on the budget: whoever must not vanish (`pinned`: in a conversation,
 * being followed by the camera), then the mission's people, then the nearest. Pinned and mission people stay even
 * past the budget: nobody disappears in the middle of a dialogue. Sectors keep the search local. */
export function select(residents: readonly Resident[], player: Vec2, budget: NpcBudget, previous: ReadonlySet<string>,
  pinned: ReadonlySet<string> = new Set()): Selection {
  const kept: Resident[] = [], rest: { r: Resident; d: number }[] = [];
  const cells = Math.ceil(budget.unload / NPC_SECTOR_M), cx = Math.floor(player.x / NPC_SECTOR_M), cz = Math.floor(player.z / NPC_SECTOR_M);
  for (const r of residents) {
    if (pinned.has(r.id) || r.mission) { kept.push(r); continue; }
    const sx = Math.floor(r.pos.x / NPC_SECTOR_M), sz = Math.floor(r.pos.z / NPC_SECTOR_M);
    if (Math.abs(sx - cx) > cells || Math.abs(sz - cz) > cells) continue;                 // a sector out of reach
    const d = dist(r.pos, player);
    if (d <= (previous.has(r.id) ? budget.unload : budget.load)) rest.push({ r, d });
  }
  rest.sort((a, b) => a.d - b.d || a.r.id.localeCompare(b.r.id));
  const active = [...kept, ...rest.slice(0, Math.max(0, budget.near - kept.length)).map((x) => x.r)].map((r) => r.id);
  const now = new Set(active);
  return { active, added: active.filter((id) => !previous.has(id)), removed: [...previous].filter((id) => !now.has(id)).sort() };
}

/** How often an active person's animation runs: every frame near and in view; one frame in four further off; not
 * at all out of view (the mixer is suspended and the person keeps the pose). */
export function animationRate(distance: number, inView: boolean, budget: NpcBudget): "full" | "reduced" | "suspended" {
  return !inView ? "suspended" : distance <= budget.full ? "full" : "reduced";
}

// ---------------------------------------------------------------- what they do

/** Level design. yield: a walker stops when the player is this close in front of them; resume: and waits this long
 * after the way is free; blockedWait: after meeting something in the way, before turning back; turn: radians per
 * second a body turns; notice: within this a waiting person turns to the player. */
export const NPC_ROUTINE = { yield: 1.6, resume: 0.8, blockedWait: 1.5, turn: 3.2, notice: 3, arrive: 0.25 } as const;

/** One frame of the active people's routines. Mission people are not touched. dt is game seconds: 0 moves nothing.
 * `busy` are people in a conversation: they hold still and keep facing whoever they talk to (the conversation turns
 * them). Nobody is moved onto ground the follower's rules reject, into another person, or into the player. */
export function stepResidents(residents: readonly Resident[], active: ReadonlySet<string>, places: TownPlaces, ground: NpcGround,
  player: Vec2, dt: number, busy: ReadonlySet<string> = new Set()): void {
  if (!(dt > 0)) return;
  const step = Math.min(dt, 0.05);
  const byId = new Map(residents.map((r) => [r.id, r] as const));
  for (const r of residents) {
    if (r.mission || !active.has(r.id)) continue;
    r.speed = 0;
    if (busy.has(r.id)) { if (r.clip === "walk") r.clip = "idle"; continue; }
    const k = r.routine;
    if (k.kind === "wait" || k.kind === "net" || k.kind === "talk") {
      const spot = places.spots.find((s) => s.id === k.spot);
      let want = spot?.facing ?? r.heading;
      if (k.kind === "talk") { const other = byId.get(k.with); if (other) want = headingTo(r.pos, other.pos); }
      else if (k.kind === "wait" && dist(r.pos, player) <= NPC_ROUTINE.notice) want = headingTo(r.pos, player);   // he notices who comes near
      r.heading = turn(r.heading, want, NPC_ROUTINE.turn * step);
      continue;
    }
    if (k.kind !== "walk") continue;
    const lane = places.lanes.find((l) => l.id === k.lane);
    if (!lane || lane.points.length < 2) { r.clip = "idle"; continue; }
    r.hold = Math.max(0, r.hold - step);
    const end = r.dir === 1 ? lane.points[r.leg + 1] : lane.points[r.leg], start = r.dir === 1 ? lane.points[r.leg] : lane.points[r.leg + 1];
    const target = beside(start, end, 1, lane.side);                         // the end of this stretch, on his side
    const ahead = headingTo(r.pos, target);
    // the player in front of him: he stops and lets them pass
    const toPlayer = dist(r.pos, player);
    if (toPlayer <= NPC_ROUTINE.yield && Math.abs(Math.atan2(Math.sin(headingTo(r.pos, player) - ahead), Math.cos(headingTo(r.pos, player) - ahead))) < Math.PI / 2) {
      r.hold = NPC_ROUTINE.resume; r.clip = "idle"; continue;
    }
    if (r.hold > 0) { r.clip = "idle"; continue; }
    const left = dist(r.pos, target);
    if (left <= NPC_ROUTINE.arrive) {                                        // next stretch, or turn back at the lane's end
      const next = r.leg + r.dir;
      if (next < 0 || next > lane.points.length - 2) r.dir = r.dir === 1 ? -1 : 1; else r.leg = next;
      r.clip = "idle"; continue;
    }
    r.heading = turn(r.heading, ahead, NPC_ROUTINE.turn * step);
    if (Math.abs(Math.atan2(Math.sin(ahead - r.heading), Math.cos(ahead - r.heading))) > 0.6) { r.clip = "idle"; continue; }   // turn first, then walk
    const move = Math.min(left, r.pace * step);
    const next = { x: r.pos.x + ((target.x - r.pos.x) / left) * move, z: r.pos.z + ((target.z - r.pos.z) / left) * move };
    const crowded = residents.some((o) => o !== r && active.has(o.id) && dist(o.pos, next) < NPC_MOTION.radius * 2 + 0.2) || dist(next, player) < NPC_MOTION.radius + 0.6;
    if (crowded || !npcCanTraverse(ground, r.pos, next)) {                   // something in the way: wait, then go back
      r.hold = NPC_ROUTINE.blockedWait; r.dir = r.dir === 1 ? -1 : 1; r.clip = "idle"; continue;
    }
    r.pos = next; r.speed = move / step; r.clip = "walk";
  }
}
/** The people who exist for the rest of the game this frame: drawn, with a collider, on the radar, able to be
 * spoken to. Only the active; an absent or far person is in none of these lists. */
export function presence(residents: readonly Resident[], active: ReadonlySet<string>) {
  const here = residents.filter((r) => active.has(r.id) && !r.mission);
  return {
    drawn: here.map((r) => ({ id: r.id, model: r.model, pos: { ...r.pos }, heading: r.heading, speed: r.speed, clip: r.clip })),
    colliders: here.map((r) => ({ id: r.id, pos: { ...r.pos }, radius: NPC_MOTION.radius })),
  };
}

// ---------------------------------------------------------------- the people this game has today

/** The reviewed meshes. One today: Simão (docs/NPC-ASSETS-R12.md). A new one enters here only after its rig, clips
 * and look were reviewed in the game. */
export const NPC_MODELS: readonly NpcModel[] = [
  { id: "simao-r12", approval: NPC_APPROVED, clips: ["idle", "walk"], walkSpeedMps: 0.7, portrays: "simao", maxCopies: 1 },
];

/** The people of the passage (Mark 1:16-20) and how many hired men the game drew (level_design.empregados: the text
 * gives no number). Names come from the episode's data. Only Simão has a model; the others are absent until theirs
 * are rigged, animated and reviewed (docs/NPC-PRODUCAO-R15.md lists what each one lacks). */
export function episodeIdentities(names: Record<string, string>, hired: number): NpcIdentity[] {
  const person = (id: string, model: string | null): NpcIdentity => ({ id, nome: names[id] ?? null, role: "disciple", model, mission: true });
  return [
    person("simao", "simao-r12"), person("andre", null), person("tiago", null), person("joao", null),
    { id: "zebedeu", nome: names.zebedeu ?? null, role: "worker", model: null, mission: false },
    ...Array.from({ length: Math.max(0, Math.floor(hired)) }, (_, i): NpcIdentity => ({ id: `empregado${i + 1}`, nome: null, role: "worker", model: null, mission: false })),
  ];
}
