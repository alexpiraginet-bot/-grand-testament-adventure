// An encounter: someone asks for help with a thing, the hero may help, and the thing ends somewhere else. The plan's
// first one is authored content, not a biblical episode ("Uma rede fora do lugar", docs/INTERACOES-E-ENCONTROS.md).
// This is its state, as plain data: the seven stages of the plan's table, the events that move between them, and what
// each move asks of the rest of the game (save this, the object is now there). No actor, mesh, clip or line of text is
// here: those arrive through the definition and the events, from adapters that do not exist yet. Pure
// (test/encounters.test.ts); nothing calls it from main.ts (docs/ENCONTROS-BASE.md).

/** The plan's table, in order. "resolved" keeps `thanked`: the object is in place before the person has thanked him. */
export type Stage = "available" | "talking" | "accepted" | "picking" | "carrying" | "placing" | "resolved";

/** The stages that are saved (world-state.ts): facts that survive a reload. Nothing in between is: no gesture, no
 * timer, no pose. */
export type StableStage = "accepted" | "returned" | "completed";
export const STABLE_ORDER: readonly StableStage[] = ["accepted", "returned", "completed"];

/** Where the object is. It changes hands only at a gesture's contact, never when the gesture starts. */
export type ObjectAt = "origin" | "hands" | "destination";

export type Encounter = {
  id: string;
  stage: Stage;
  object: ObjectAt;
  /** Seconds into the gesture being played (picking or placing); 0 otherwise. */
  gesture: number;
  /** The person has thanked him (only meaningful once resolved). */
  thanked: boolean;
};

/** The gestures' timings, in game seconds, taken by an adapter from the real animation clips when they exist. `contact`
 * is when the hands close on the object (or let go of it); it must fall inside the gesture. */
export type Gestures = { pick: { length: number; contact: number }; place: { length: number; contact: number } };

export function validGestures(g: Gestures): boolean {
  return [g.pick, g.place].every((x) => Number.isFinite(x.length) && Number.isFinite(x.contact) && x.length > 0 && x.contact > 0 && x.contact <= x.length);
}

export type EncounterEvent =
  | { type: "talk" }        // the action on the person
  | { type: "accept" }      // "Posso ajudar"
  | { type: "decline" }     // "Agora não", or walking away from the conversation
  | { type: "pick" }        // the action on the object, in reach
  | { type: "cancel" }      // letting go of a gesture: only before its contact
  | { type: "place" }       // the action while carrying; `atSupport` says he stands at a valid place for it
  | { type: "thank" };      // the person's thanks has been shown

export type Effect =
  | { type: "save"; stage: StableStage }
  | { type: "object"; at: ObjectAt }
  | { type: "refused"; why: "sem-apoio" | "ja-em-maos" };   // the press did nothing, and why, for a short instruction

export const fresh = (id: string): Encounter => ({ id, stage: "available", object: "origin", gesture: 0, thanked: false });

/** The encounter as a reload finds it: at the last saved fact, never mid-gesture. A reload while carrying puts the
 * object back at its last stable support (the origin) with the request still accepted; nothing is duplicated. */
export function restore(id: string, saved: StableStage | null): Encounter {
  if (saved === "accepted") return { id, stage: "accepted", object: "origin", gesture: 0, thanked: false };
  if (saved === "returned") return { id, stage: "resolved", object: "destination", gesture: 0, thanked: false };
  if (saved === "completed") return { id, stage: "resolved", object: "destination", gesture: 0, thanked: true };
  return fresh(id);
}

/** The saved fact the encounter is at now (null before it is accepted). */
export function stableStage(e: Encounter): StableStage | null {
  if (e.stage === "available" || e.stage === "talking") return null;
  if (e.stage !== "resolved") return "accepted";
  return e.thanked ? "completed" : "returned";
}

/** One event. An event that does not apply at this stage changes nothing and asks for nothing, so a double tap or a
 * repeated key cannot run a step twice. Returns the same object when nothing changed. */
export function apply(e: Encounter, ev: EncounterEvent, at: { atSupport: boolean } = { atSupport: false }): { next: Encounter; effects: Effect[] } {
  const same = { next: e, effects: [] as Effect[] };
  switch (ev.type) {
    case "talk": return e.stage === "available" ? { next: { ...e, stage: "talking" }, effects: [] } : same;
    case "decline": return e.stage === "talking" ? { next: { ...e, stage: "available" }, effects: [] } : same;
    case "accept": return e.stage === "talking" ? { next: { ...e, stage: "accepted" }, effects: [{ type: "save", stage: "accepted" }] } : same;
    case "pick":
      if (e.stage === "accepted") return { next: { ...e, stage: "picking", gesture: 0 }, effects: [] };
      return e.stage === "carrying" ? { next: e, effects: [{ type: "refused", why: "ja-em-maos" }] } : same;
    case "cancel":
      // before contact nothing has moved: back to accepted. After it, the object leaves his hands only by placing it.
      return (e.stage === "picking" || e.stage === "placing") && e.object === (e.stage === "picking" ? "origin" : "hands")
        ? { next: { ...e, stage: e.stage === "picking" ? "accepted" : "carrying", gesture: 0 }, effects: [] } : same;
    case "place":
      if (e.stage !== "carrying") return same;
      return at.atSupport ? { next: { ...e, stage: "placing", gesture: 0 }, effects: [] } : { next: e, effects: [{ type: "refused", why: "sem-apoio" }] };
    case "thank":
      return e.stage === "resolved" && !e.thanked ? { next: { ...e, thanked: true }, effects: [{ type: "save", stage: "completed" }] } : same;
  }
}

/** Time passing. Only gestures move with it: at the contact the object changes hands, at the end the stage does. A
 * step long enough to pass both does both, in that order. Paused time (dt 0) changes nothing. */
export function tick(e: Encounter, dt: number, g: Gestures): { next: Encounter; effects: Effect[] } {
  if (!(dt > 0) || (e.stage !== "picking" && e.stage !== "placing")) return { next: e, effects: [] };
  const clip = e.stage === "picking" ? g.pick : g.place, effects: Effect[] = [];
  let next: Encounter = { ...e, gesture: e.gesture + dt };
  const held: ObjectAt = e.stage === "picking" ? "hands" : "destination";
  if (next.gesture >= clip.contact && next.object !== held) { next = { ...next, object: held }; effects.push({ type: "object", at: held }); }
  if (next.gesture >= clip.length) {
    if (e.stage === "picking") next = { ...next, stage: "carrying", gesture: 0 };
    else { next = { ...next, stage: "resolved", gesture: 0, thanked: false }; effects.push({ type: "save", stage: "returned" }); }
  }
  return { next, effects };
}

/** The button's words for an encounter's person, its object, and the object once carried. */
export type Labels = { talk: string; pick: string; place: string };
/** The plan's words for its first encounter. */
export const NET_LABELS: Labels = { talk: "Conversar", pick: "Pegar rede", place: "Deixar a rede" };

/** What the button would say for this encounter's person and object at this stage (null: not offered). An adapter
 * turns these into interactions.ts targets when the actor and the object are really there. */
export function offers(e: Encounter, labels: Labels): { person: string | null; object: string | null; carrying: string | null } {
  return {
    person: e.stage === "available" ? labels.talk : null,
    object: e.stage === "accepted" ? labels.pick : null,
    carrying: e.stage === "carrying" ? labels.place : null,
  };
}
