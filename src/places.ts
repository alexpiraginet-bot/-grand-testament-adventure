// The places of the region the player can find on foot. Nothing here is typed by hand: positions come from the world
// data (public/world/cafarnaum.json: the sourced place and the episode's points) and from the relief itself; names are
// built from the place and character names in the data. Every place says where it comes from, because they are not
// the same kind of fact:
//   fonte     a place with a source (OpenBible), at the source's coordinates;
//   passagem  something the passage names (the nets, the boat), at a position that is the game's choice;
//   relevo    a spot the game names on the real relief (the lookout): no text or source says anything about it.
// Pure (test/places.test.ts); main.ts only draws what this finds.
import type { Vec2 } from "./missions.ts";
import { verseRef } from "./freeroam.ts";

export type PlaceOrigin = "fonte" | "passagem" | "relevo";
export type Place = { id: string; nome: string; x: number; z: number; radius: number; origem: PlaceOrigin; ref: string | null };

/** What the HUD writes under a found place's name. */
export const ORIGIN_LABEL: Record<PlaceOrigin, string> = {
  fonte: "Lugar com fonte",
  passagem: "Posição escolhida pelo jogo",
  relevo: "Nome do jogo sobre o relevo real",
};

/** Level design, in metres: how near counts as found, and how far from the sourced place the lookout may be. */
export const PLACE_RADIUS_M = { fonte: 60, passagem: 25, relevo: 30 } as const;
export const LOOKOUT_SEARCH_M = 400;

type WorldLike = {
  size: number; step: number;
  places: { id: string; nome: string; x: number; z: number }[];
  points: Record<"beach" | "simao" | "barco_margem", [number, number]>;
};
type EpisodeLike = { ref_pt: string; lugar: string; personagens?: { id: string; ref: string; nome: string }[] };

/** The highest grid point within `within` metres of `around`, inside the walkable square (margin from the edge) and
 * above the lake; null when there is none. Ties keep the first found (north-west first), so the result is stable. */
export function highestNear(heightAt: (x: number, z: number) => number, world: Pick<WorldLike, "size" | "step">, around: Vec2,
  within: number, margin: number): { x: number; z: number; height: number } | null {
  const half = world.size / 2, lim = half - margin;
  let best: { x: number; z: number; height: number } | null = null;
  for (let z = -half; z <= half; z += world.step) for (let x = -half; x <= half; x += world.step) {
    if (Math.abs(x) > lim || Math.abs(z) > lim || Math.hypot(x - around.x, z - around.z) > within) continue;
    const height = heightAt(x, z);
    if (height > 0 && (!best || height > best.height)) best = { x, z, height };
  }
  return best;
}

/** The region's places, in the order a walk from the village meets them. A place whose data is missing is left out. */
export function regionPlaces(world: WorldLike, ep: EpisodeLike, heightAt: (x: number, z: number) => number, margin: number): Place[] {
  const out: Place[] = [];
  const who = (id: string) => ep.personagens?.find((p) => p.id === id) ?? null;
  for (const p of world.places) out.push({ id: p.id, nome: p.nome, x: p.x, z: p.z, radius: PLACE_RADIUS_M.fonte, origem: "fonte", ref: null });
  const at = (k: "beach" | "simao" | "barco_margem") => ({ x: world.points[k][0], z: world.points[k][1] });
  const simao = who("simao"), andre = who("andre"), zebedeu = who("zebedeu"), first = ep.personagens?.[0];
  // the shore where the walk meets the lake: the passage's own place name ("mar da Galileia"), as the episode data has
  // it, with the passage's first verse (the one of the first person it names)
  if (first) out.push({ id: "margem", nome: `Margem do ${ep.lugar}`, ...at("beach"), radius: PLACE_RADIUS_M.passagem, origem: "passagem", ref: verseRef(ep, first.ref) });
  if (simao && andre) out.push({ id: "redes", nome: `Redes de ${simao.nome} e ${andre.nome}`, ...at("simao"), radius: PLACE_RADIUS_M.passagem, origem: "passagem", ref: verseRef(ep, simao.ref) });
  if (zebedeu) out.push({ id: "barco", nome: `Barco de ${zebedeu.nome}`, ...at("barco_margem"), radius: PLACE_RADIUS_M.passagem, origem: "passagem", ref: verseRef(ep, zebedeu.ref) });
  const centre = world.places[0];
  const top = centre ? highestNear(heightAt, world, { x: centre.x, z: centre.z }, LOOKOUT_SEARCH_M, margin) : null;
  if (top) out.push({ id: "mirante", nome: `Mirante do ${ep.lugar}`, x: top.x, z: top.z, radius: PLACE_RADIUS_M.relevo, origem: "relevo", ref: null });
  return out;
}

/** The places the player stands in now that were not found before, in the list's order. Adds them to `found`. */
export function discover(places: readonly Place[], found: Set<string>, pos: Vec2): Place[] {
  const fresh: Place[] = [];
  for (const p of places) {
    if (found.has(p.id) || Math.hypot(pos.x - p.x, pos.z - p.z) > p.radius) continue;
    found.add(p.id); fresh.push(p);
  }
  return fresh;
}

/** The place not yet found that is nearest to the player, and how far; null when all were found. */
export function nearestUnfound(places: readonly Place[], found: ReadonlySet<string>, pos: Vec2): { place: Place; dist: number } | null {
  let best: { place: Place; dist: number } | null = null;
  for (const place of places) {
    if (found.has(place.id)) continue;
    const dist = Math.hypot(place.x - pos.x, place.z - pos.z);
    if (!best || dist < best.dist) best = { place, dist };
  }
  return best;
}

const WINDS = ["norte", "nordeste", "leste", "sudeste", "sul", "sudoeste", "oeste", "noroeste"] as const;

/** Which of the eight winds a step of (dx, dz) points to; the world's x grows east and z grows south. */
export function windName(dx: number, dz: number): (typeof WINDS)[number] {
  const eighth = Math.round(Math.atan2(dx, -dz) / (Math.PI / 4));
  return WINDS[((eighth % 8) + 8) % 8];
}

// ---------------------------------------------------------------- the edge of the region

/** How near the limit of the walkable square the player is told about it (the audit of R6 found an invisible wall). */
export const EDGE_NOTICE_M = 40;

/** Metres from (x, z) to the limit of the walkable square: the terrain's half-size less the margin kept from its
 * edge. Zero or less at and beyond the limit. */
export function distanceToEdge(size: number, margin: number, x: number, z: number): number {
  return size / 2 - margin - Math.max(Math.abs(x), Math.abs(z));
}

// ---------------------------------------------------------------- what was found, kept in this browser

export const PLACES_KEY = "gta:places";
export const PLACES_VERSION = 1;

/** Stored text -> the ids found, keeping only ids that are places of this build (a renamed or removed place is dropped). */
export function parseFound(text: string | null, places: readonly Place[]): Set<string> {
  const found = new Set<string>();
  if (!text) return found;
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return found; }
  const r = raw as { v?: unknown; ids?: unknown } | null;
  if (typeof r !== "object" || r === null || r.v !== PLACES_VERSION || !Array.isArray(r.ids)) return found;
  const known = new Set(places.map((p) => p.id));
  for (const id of r.ids) if (typeof id === "string" && known.has(id)) found.add(id);
  return found;
}

export function serializeFound(found: ReadonlySet<string>, places: readonly Place[]): string {
  return JSON.stringify({ v: PLACES_VERSION, ids: places.filter((p) => found.has(p.id)).map((p) => p.id) });
}
