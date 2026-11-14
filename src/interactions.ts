// Who receives the action button. The game has one button (E, or the hand on a phone) and, with encounters, more than
// one thing it could mean: the mission's call, a person to talk to, an object to pick up, the thing being carried.
// docs/INTERACOES-E-ENCONTROS.md asks for one reader of the button per frame and one destination, and that the label on
// screen be the thing that receives it. This module decides that destination from plain data, every frame, so the HUD
// shows `receiver(...)`'s label and a press goes to that same receiver: they cannot disagree.
// Pure (test/interactions.test.ts). Nothing here is wired into main.ts yet: no target exists until an approved actor
// and the hero's gestures do (docs/ENCONTROS-BASE.md).
import type { Vec2 } from "./missions.ts";

export type InteractionKind = "act" | "talk";

/** How close the hero must be to a target's anchor, in metres: the plan's starting values, to be checked against the
 * real meshes and gestures. `rise` (the height difference a gesture can bridge) and `cone` (how far off his heading a
 * target may be and still be in front of him) are this module's own starting values; the plan names no number. */
export const REACH = { act: 1.5, talk: 2.5, rise: 0.5, cone: (100 * Math.PI) / 180 } as const;

export type Target = {
  /** Stable across sessions: saved progress refers to it. */
  id: string;
  kind: InteractionKind;
  /** What the button says while this target would receive it ("Conversar", "Pegar rede"). */
  label: string;
  /** Where the hand or the voice goes, and the ground height there. */
  anchor: Vec2;
  height: number;
  /** The side it is used from: the heading from the anchor towards where the hero must stand (radians, as the game's
   * headings: 0 looks to -z, growing clockwise seen from above). Absent when any side will do. */
  from?: number;
  /** Its preconditions hold: the mesh and clip it needs have loaded, and its encounter is at a stage that offers it. */
  available: boolean;
};

export type Hero = { pos: Vec2; heading: number; height: number };

export type Surroundings = {
  /** Nothing solid between the two points. */
  clearLine(a: Vec2, b: Vec2): boolean;
  /** Water too deep to stand in at this point. */
  deepWater(p: Vec2): boolean;
};

/** Why a target cannot be used right now; each has a short instruction for the player (REASON_HINT). */
export type Unreachable = "indisponivel" | "longe" | "altura" | "agua" | "atras" | "parede" | "de-costas";

export const REASON_HINT: Record<Unreachable, string> = {
  indisponivel: "",                                   // not offered at all: nothing to say
  longe: "Chegue mais perto.",
  altura: "Não dá para alcançar daqui.",
  agua: "Fique em terra firme.",
  atras: "Dê a volta para o outro lado.",
  parede: "Há algo no caminho.",
  "de-costas": "Vire-se para lá.",
};

const angle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** The heading from `a` towards `b`, as the game measures headings. */
export const headingTo = (a: Vec2, b: Vec2) => Math.atan2(b.x - a.x, -(b.z - a.z));
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

/** Whether the hero can use the target from where he stands, and if not, the first reason, checked nearest first. */
export function reach(t: Target, hero: Hero, around: Surroundings): { ok: true } | { ok: false; why: Unreachable } {
  const no = (why: Unreachable) => ({ ok: false as const, why });
  if (!t.available) return no("indisponivel");
  if (distance(hero.pos, t.anchor) > REACH[t.kind]) return no("longe");
  if (Math.abs(hero.height - t.height) > REACH.rise) return no("altura");
  if (around.deepWater(hero.pos)) return no("agua");
  // not from behind the target: he stands on the side it is used from
  if (t.from !== undefined && Math.abs(angle(headingTo(t.anchor, hero.pos) - t.from)) > Math.PI / 2) return no("atras");
  if (!around.clearLine(hero.pos, t.anchor)) return no("parede");
  // and it is in front of him (standing on the anchor itself counts as facing it)
  if (distance(hero.pos, t.anchor) > 1e-6 && Math.abs(angle(headingTo(hero.pos, t.anchor) - hero.heading)) > REACH.cone) return no("de-costas");
  return { ok: true };
}

/** The targets he can use now, the likeliest first: things to do before people to talk to (a conversation is always
 * optional), then the one most squarely in front of him, then the nearest, then by id so the order never flickers. */
export function candidates(targets: readonly Target[], hero: Hero, around: Surroundings): Target[] {
  const off = (t: Target) => (distance(hero.pos, t.anchor) > 1e-6 ? Math.abs(angle(headingTo(hero.pos, t.anchor) - hero.heading)) : 0);
  return targets.filter((t) => reach(t, hero, around).ok).sort((a, b) =>
    (a.kind === b.kind ? 0 : a.kind === "act" ? -1 : 1) || off(a) - off(b) || distance(hero.pos, a.anchor) - distance(hero.pos, b.anchor) || a.id.localeCompare(b.id));
}

/** The next target when the player asks to switch (a key, or a tap on the label): through the candidates in their
 * order, round and round. Null when there is none. A choice that is no longer a candidate starts again from the first. */
export function switchFocus(list: readonly Target[], chosen: string | null, step: 1 | -1 = 1): string | null {
  if (!list.length) return null;
  const i = list.findIndex((t) => t.id === chosen);
  return list[i < 0 ? 0 : (i + step + list.length) % list.length].id;
}

export type Receiver =
  | { to: "ongoing"; label: string }            // a gesture or a carry in progress: finishing or releasing it comes first
  | { to: "target"; id: string; label: string }
  | { to: "mission"; label: string }
  | { to: "none" };

export type Situation = {
  /** Something already in his hands or under way, and what the button would do to it now (null label: nothing yet,
   * e.g. carrying with no valid place to put it down: the button does nothing rather than something else). */
  ongoing: { label: string | null } | null;
  /** The targets he can use now (candidates()). */
  candidates: readonly Target[];
  /** The target the player chose by switching; ignored once it is no longer a candidate. */
  chosen: string | null;
  /** The mission's own prompt is showing (missions.ts promptVisible) and what it says. */
  mission: { label: string } | null;
};

/** The one thing the button means this frame, in the plan's order: what is under way; the target the player chose;
 * the mission; otherwise the likeliest candidate. While something is under way nothing else can take the button. */
export function receiver(s: Situation): Receiver {
  if (s.ongoing) return s.ongoing.label ? { to: "ongoing", label: s.ongoing.label } : { to: "none" };
  const chosen = s.chosen ? s.candidates.find((t) => t.id === s.chosen) : undefined;
  if (chosen) return { to: "target", id: chosen.id, label: chosen.label };
  if (s.mission) return { to: "mission", label: s.mission.label };
  const first = s.candidates[0];
  return first ? { to: "target", id: first.id, label: first.label } : { to: "none" };
}
