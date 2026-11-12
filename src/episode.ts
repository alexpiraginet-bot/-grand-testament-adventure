// Episode 1, "Pescadores de gente" (Mark 1:16-20), laid on the world: goals and the people of the passage.
// Positions come from public/world/cafarnaum.json (tools/build_world.py); who is where comes from the text:
//   Mark 1:16  Simão and André casting a net into the sea
//   Mark 1:19  a little further on, Tiago and João in the boat, mending the nets
//   Mark 1:20  Zebedeu stays in the boat with the hired men (how many is ours: level_design.empregados)
import type { Goal, Vec2 } from "./missions.ts";
import type { WorldMeta } from "./terrain.ts";

export type Look = "simao" | "andre" | "tiago" | "joao" | "zebedeu" | "empregado";

export type NpcSpec = {
  id: string;
  nome: string | null;     // name as the BLIVRE writes it (null for the hired men, unnamed in the text)
  look: Look;
  pos: Vec2;
  facing: number;          // radians, 0 = looking north (-z)
  pose: "net" | "sit" | "stand";
  inBoat: boolean;
};

const v = (p: [number, number]): Vec2 => ({ x: p[0], z: p[1] });

/** Heading (radians, 0 = north, clockwise) from a to b. */
export function heading(a: Vec2, b: Vec2): number {
  return Math.atan2(b.x - a.x, -(b.z - a.z));
}

export function goals(meta: WorldMeta): Goal[] {
  const P = meta.points;
  return [
    { kind: "reach", at: v(P.beach), radius: 18, below: 0.6 },
    { kind: "call", at: v(P.simao), radius: 7, npcs: ["simao", "andre"] },
    { kind: "call", at: v(P.barco_margem), radius: 13, npcs: ["tiago", "joao"] },
  ];
}

/** The direction of the shoreline at a point (unit vector), from the json's shoreline polyline. */
export function shoreDir(meta: WorldMeta, p: Vec2): Vec2 {
  const s = meta.shoreline;
  let best = 0, bd = Infinity;
  for (let i = 0; i < s.length; i++) {
    const d = Math.hypot(s[i][0] - p.x, s[i][1] - p.z);
    if (d < bd) { bd = d; best = i; }
  }
  const a = s[Math.max(0, best - 3)], b = s[Math.min(s.length - 1, best + 3)];
  const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, z: dz / l };
}

export function npcs(meta: WorldMeta, names: Record<string, string>): NpcSpec[] {
  const P = meta.points;
  const s = v(P.simao), boat = v(P.barco), shore = v(P.barco_margem);
  const d1 = shoreDir(meta, s);
  const toSea = Math.atan2(boat.x - shore.x, -(boat.z - shore.z));   // shore -> boat: the way to the water
  const seaFacing = Math.atan2(boat.x - shore.x, -(boat.z - shore.z));
  const along = shoreDir(meta, boat);
  const out: NpcSpec[] = [
    { id: "simao", nome: names.simao, look: "simao", pos: { x: s.x - d1.x * 1.4, z: s.z - d1.z * 1.4 }, facing: toSea, pose: "net", inBoat: false },
    { id: "andre", nome: names.andre, look: "andre", pos: { x: s.x + d1.x * 1.6, z: s.z + d1.z * 1.6 }, facing: toSea, pose: "net", inBoat: false },
    { id: "tiago", nome: names.tiago, look: "tiago", pos: { x: boat.x - along.x * 1.4, z: boat.z - along.z * 1.4 }, facing: seaFacing + Math.PI, pose: "sit", inBoat: true },
    { id: "joao", nome: names.joao, look: "joao", pos: { x: boat.x + along.x * 0.2, z: boat.z + along.z * 0.2 }, facing: seaFacing + Math.PI, pose: "sit", inBoat: true },
    { id: "zebedeu", nome: names.zebedeu, look: "zebedeu", pos: { x: boat.x + along.x * 1.8, z: boat.z + along.z * 1.8 }, facing: seaFacing + Math.PI * 0.8, pose: "sit", inBoat: true },
  ];
  for (let k = 0; k < meta.level_design.empregados; k++) {
    const t = k === 0 ? -2.9 : 3.1;
    out.push({ id: `empregado${k + 1}`, nome: null, look: "empregado", pos: { x: boat.x + along.x * t, z: boat.z + along.z * t }, facing: seaFacing, pose: "stand", inBoat: true });
  }
  return out;
}
