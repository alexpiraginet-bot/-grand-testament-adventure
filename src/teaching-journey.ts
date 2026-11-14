// The step after the boat. The episode ends with the four called and its epilogue brings them back into Capernaum
// (freeroam.ts, the first clause of Mark 1:21). This module is what comes next: the walk through the street to the
// place where the town gathers, the action of beginning to teach, the people's response, and where the text goes
// after it. Mark 1:21-22, in the BLIVRE's words (src/data/mc-ensino.json, tools/build_teaching.py).
//
// What the text gives and what it does not. Mark 1:21 says that he taught; it gives no discourse. So the game shows
// two clauses of the narrator, literal and with their references, and puts no words in anyone's mouth:
//   the rest of Mark 1:21 after the epilogue's clause   "e assim que chegou o sábado, Jesus entrou na sinagoga e começou a ensinar."
//   Mark 1:22 up to its first comma                      "E ficavam admirados com o seu ensinamento"
// Everything else on screen in this step is the game's own and is labelled so by the HUD: `narrative` is "Narrativa
// do jogo", `guidance` is "Orientação". The place is the game's choice of a spot in its art-directed village: no
// source places it and no building is claimed to be the historical one (docs/CAFARNAUM-CENARIO.md).
//
// The Bible guides and never locks: nothing here asks whether the passage was read. Whoever reaches the place acts.
// Pure and deterministic (test/teaching-journey.test.ts plays it through). Nothing here reads the keyboard, the
// clock or the storage; main.ts passes position, the one action press of the frame and game seconds, and applies the
// "save" events to the world record (world-state.ts). docs/JORNADA-ENSINO-R15.md has the contract for the wiring.
import { readingTime, type Fala, type Vec2 } from "./missions.ts";
import type { StableStage } from "./encounters.ts";
import { verseRef } from "./freeroam.ts";
import { SCENE_DEVELOPMENT_NOTICE } from "./journey.ts";
import { recordStage, type WorldState } from "./world-state.ts";

/** The verses of this step and of what follows, as tools/build_teaching.py writes them. */
export type TeachingData = {
  id: string;
  ref_pt: string;                                              // "Marcos 1:21–22"
  versiculos: Record<string, string>;
  a_seguir: { de: string; ate: string; ref_pt: string };       // the text's next passage, in the same place: not staged
  depois: { versiculo: string; ref_pt: string; texto: string }; // the verse that names where the text goes afterwards
};

/** This step's id in the world record (world-state.ts). Stable: saved progress refers to it. */
export const TEACHING_ID = "ensino-cafarnaum";
export const TEACHING_VERSES = { begins: "Mark.1.21", response: "Mark.1.22" } as const;
/** Level design, not text. radius: how close to the spot the action is offered; slack: how far past it the offer
 * holds, so it does not flicker at the edge; leave: walking this far past the radius while the lines are on screen
 * ends them (he left the place: nothing is kept, and it can be begun again); onward: how close counts as having
 * reached the place the text goes to next. */
export const TEACHING = { radius: 6, slack: 1.5, leave: 6, onward: 12 } as const;
/** The button's word. */
export const TEACHING_ACTION = "Ensinar";

/** Where this step happens, from the layout of the town (town-life-layout.ts). */
export type TeachingPlace = {
  /** The spot where the teaching is staged. */
  court: Vec2;
  /** The way through the street, in walking order, ending at the court; the radar draws what is still ahead. */
  street: readonly Vec2[];
  /** The house the game chose for Mark 1:29, when the town has one; null while it has none. */
  onward: Vec2 | null;
};

/** off: not open yet (the episode or its epilogue is still being played). walk: on the way. ready: at the place,
 * the action is offered. line: the clauses are on screen. done: lived; what comes next is announced. */
export type TeachingPhase = "off" | "walk" | "ready" | "line" | "done";
export type TeachingState = {
  phase: TeachingPhase;
  /** The step's opening words are still to be shown: true the first time, false once it was begun in an earlier visit. */
  intro: boolean;
  /** While phase is "line": which clause is on screen, and the game seconds it still stays. */
  index: number;
  line: Fala | null;
  lineLeft: number;
  /** Game seconds lived with the step open. */
  time: number;
};

export type TeachingEvent =
  | { type: "begin" }                         // the step opened
  | { type: "arrived" }                       // at the place: the action is offered
  | { type: "left" }                          // away from it again: the offer is gone
  | { type: "line"; fala: Fala }              // a clause came on screen
  | { type: "interrupted" }                   // he walked away while the clauses were on screen
  | { type: "done" }                          // lived, once
  | { type: "save"; stage: StableStage };     // a fact to keep (recordTeaching)
export type TeachingStep = { next: TeachingState; events: TeachingEvent[] };

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const same = (s: TeachingState): TeachingStep => ({ next: s, events: [] });

/** The two clauses the game stages, derived from the data and never typed; null when a verse is missing or has not
 * the shape the derivation needs (then there is nothing to stage and the action is never offered). */
export function teachingLines(d: Pick<TeachingData, "ref_pt" | "versiculos">): Fala[] | null {
  const began = d.versiculos[TEACHING_VERSES.begins], response = d.versiculos[TEACHING_VERSES.response];
  const cut = began?.indexOf(";") ?? -1;
  const rest = cut >= 0 ? began.slice(cut + 1).trim() : "";                 // after the clause the epilogue showed
  const comma = response?.indexOf(",") ?? -1;
  const first = comma > 0 ? response.slice(0, comma).trim() : "";           // before the source's first comma
  const refA = verseRef(d, TEACHING_VERSES.begins), refB = verseRef(d, TEACHING_VERSES.response);
  return rest && first && refA && refB ? [{ texto: rest, ref: refA }, { texto: first, ref: refB }] : null;
}

/** The place the text goes to next, in the verse's own words ("casa de Simão e de André"); null when the verse does
 * not read as expected, and then the game names no place. */
export function onwardPlaceName(d: Pick<TeachingData, "depois">): string | null {
  return /vieram à (casa de [^,.;]+)/.exec(d.depois?.texto ?? "")?.[1].trim() ?? null;
}

export const freshTeaching = (): TeachingState => ({ phase: "off", intro: true, index: 0, line: null, lineLeft: 0, time: 0 });

/** The step as a reload finds it: at the last saved fact. Lived stays lived; begun but not lived opens again without
 * its opening words; never mid-clause. It stays "off" until beginTeaching: main.ts opens it when the region does. */
export function restoreTeaching(saved: StableStage | null): TeachingState {
  if (saved === "completed") return { ...freshTeaching(), phase: "done", intro: false };
  return { ...freshTeaching(), intro: saved === null };
}

/** The saved fact the step is at now (null before it opens). */
export function teachingStage(s: TeachingState): StableStage | null {
  return s.phase === "off" ? null : s.phase === "done" ? "completed" : "accepted";
}

/** The region is open (the epilogue ended, or a player who had finished came back to explore): the step opens.
 * Calling it again changes nothing. */
export function beginTeaching(s: TeachingState): TeachingStep {
  if (s.phase !== "off") return same(s);
  return { next: { ...s, phase: "walk" }, events: [{ type: "begin" }, { type: "save", stage: "accepted" }] };
}

/** One frame. `action` is the frame's one press of the action button, already routed to this step by whoever reads
 * the input (interactions.ts receiver "mission"). dt is game seconds: 0 while a panel is open, and then nothing moves. */
export function stepTeaching(s: TeachingState, place: TeachingPlace, lines: readonly Fala[] | null,
  input: { pos: Vec2; action: boolean }, dt: number): TeachingStep {
  if (!(dt > 0) || s.phase === "off") return same(s);
  const time = s.time + dt, d = dist(input.pos, place.court);
  if (s.phase === "done") return { next: { ...s, time }, events: [] };
  if (!lines?.length) return s.phase === "walk" ? { next: { ...s, time }, events: [] }
    : { next: { ...s, time, phase: "walk", line: null, lineLeft: 0, index: 0 }, events: [] };
  if (s.phase === "walk") {
    return d <= TEACHING.radius ? { next: { ...s, time, phase: "ready" }, events: [{ type: "arrived" }] } : { next: { ...s, time }, events: [] };
  }
  if (s.phase === "ready") {
    if (d > TEACHING.radius + TEACHING.slack) return { next: { ...s, time, phase: "walk" }, events: [{ type: "left" }] };
    if (!input.action) return { next: { ...s, time }, events: [] };
    return { next: { ...s, time, phase: "line", index: 0, line: lines[0], lineLeft: readingTime(lines[0].texto) }, events: [{ type: "line", fala: lines[0] }] };
  }
  // the clauses are on screen: pressing again does nothing; walking away from the place ends them
  if (d > TEACHING.radius + TEACHING.leave) return { next: { ...s, time, phase: "walk", line: null, lineLeft: 0, index: 0 }, events: [{ type: "interrupted" }] };
  const left = s.lineLeft - dt;
  if (left > 0) return { next: { ...s, time, lineLeft: left }, events: [] };
  const following = lines[s.index + 1];
  if (following) return { next: { ...s, time, index: s.index + 1, line: following, lineLeft: readingTime(following.texto) }, events: [{ type: "line", fala: following }] };
  return { next: { ...s, time, phase: "done", line: null, lineLeft: 0, index: 0 }, events: [{ type: "done" }, { type: "save", stage: "completed" }] };
}

/** The world record after these events. Stages only go forward there, so a repeated event keeps the record as it is
 * (the same object comes back: nothing to write). */
export function recordTeaching(world: WorldState, events: readonly TeachingEvent[], now: number): WorldState {
  return events.reduce((w, e) => (e.type === "save" ? recordStage(w, TEACHING_ID, e.stage, now) : w), world);
}

/** What is still ahead of him on the street, from the nearest point of it to its end. Like the journey's dotted
 * route, it never draws a straight connector from someone off the street: that could cross a house. */
export function streetAhead(street: readonly Vec2[], pos: Vec2): Vec2[] {
  if (street.length < 2) return [];
  let at = 0, best = Infinity, on: Vec2 = street[0];
  for (let i = 0; i + 1 < street.length; i++) {
    const a = street[i], b = street[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
    const u = l2 ? Math.max(0, Math.min(1, ((pos.x - a.x) * dx + (pos.z - a.z) * dz) / l2)) : 0;
    const p = { x: a.x + u * dx, z: a.z + u * dz }, far = dist(p, pos);
    if (far < best) { best = far; at = i; on = p; }
  }
  const out: Vec2[] = [on];
  for (const p of street.slice(at + 1)) if (dist(out[out.length - 1], p) > 1e-5) out.push({ ...p });
  return out;
}

/** What the HUD shows for this step. Every string that is not `line` or `announce` is the game's own. */
export type TeachingView = {
  phase: Exclude<TeachingPhase, "off">;
  objective: string;
  /** The reference this part is told by ("Marcos 1:21–22"); the Bible opens there. It never gates the action. */
  ref: string;
  /** Where the radar points, and how far it is; null when there is nowhere to go. */
  goal: Vec2 | null;
  dist: number | null;
  /** The button's word, only while a press would begin the teaching. */
  action: string | null;
  /** The clause on screen: literal, shown as "Bíblia Livre · <ref>". */
  line: Fala | null;
  /** Once lived: the verse that names where the text goes next, literal, to be shown as "Bíblia Livre · <ref>". */
  announce: Fala | null;
  narrative: string;      // "Narrativa do jogo": this part's opening words ("" when there are none to show)
  guidance: string;       // "Orientação"
  /** The honest notice while the scene has no one drawn but the text speaks of people (journey.ts). */
  scene: string;
  /** The street still ahead, for the radar's dots. */
  route: Vec2[];
};

/** The view of the step for a player at `pos`; null while it is not open. */
export function teachingView(s: TeachingState, place: TeachingPlace, d: TeachingData, lines: readonly Fala[] | null,
  pos: Vec2, touch: boolean): TeachingView | null {
  if (s.phase === "off") return null;
  const base = { phase: s.phase, ref: d.ref_pt, action: null, line: null, announce: null, narrative: "", scene: "", route: [] as Vec2[] };
  if (s.phase === "done") {
    const name = onwardPlaceName(d), at = name ? place.onward : null;
    const far = at ? dist(pos, at) : null;
    const there = far !== null && far <= TEACHING.onward;
    return { ...base, ref: d.depois.ref_pt, goal: at && !there ? at : null, dist: at && !there ? far : null,
      objective: name && at ? `Siga para a ${name}` : "Explore a cidade",
      announce: { texto: d.depois.texto, ref: d.depois.ref_pt },
      narrative: `O que ainda se passa na sinagoga (${d.a_seguir.ref_pt}) não é encenado nesta versão.`,
      guidance: there ? "Esta é a casa que o jogo escolheu para o versículo. A cena ainda está em preparação."
        : at ? "O radar aponta a casa que o jogo escolheu para o versículo. A cena de lá ainda está em preparação."
        : "A continuação da história ainda está em preparação." };
  }
  if (!lines?.length) {
    return { ...base, goal: null, dist: null, objective: "Explore a cidade", guidance: "A continuação da história ainda está em preparação." };
  }
  const here = { ...base, goal: place.court, dist: dist(pos, place.court) };
  if (s.phase === "walk") {
    return { ...here, objective: "Vá ao lugar onde a cidade se reúne", route: streetAhead(place.street, pos),
      narrative: s.intro ? "Chegou o sábado. O caminho agora leva ao lugar onde a cidade se reúne." : "",
      guidance: here.dist < 35 ? "O lugar fica logo adiante, no pátio aberto." : "Siga pela rua, entre as casas, até o pátio." };
  }
  const scene = SCENE_DEVELOPMENT_NOTICE;
  if (s.phase === "ready") {
    return { ...here, objective: "Comece a ensinar", action: TEACHING_ACTION, scene,
      narrative: "Este pátio representa o lugar de reunião da cidade. A posição é uma escolha do jogo.",
      guidance: touch ? `Toque em ${TEACHING_ACTION} para começar.` : `Aperte E para começar a ensinar.` };
  }
  return { ...here, objective: "Comece a ensinar", line: s.line, scene, guidance: "" };
}
