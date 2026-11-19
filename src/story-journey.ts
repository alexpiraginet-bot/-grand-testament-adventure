// The story after the teaching: twenty steps from Mark 1:30 to 4:35 (story-steps.ts), each at its place on the real
// ground (story-places.ts). A step is a walk to its place and, where the passage gives him something to do, one
// press of the action button; then the passage's own clauses come on screen, literal and with their references.
//
// It opens once the teaching step was lived and the house of Mark 1:29 was reached (teaching-journey.ts), and it
// takes nothing from that module: main.ts shows this view when it has one and the teaching's otherwise. When the last
// step was lived it says so for a while and then gives the screen back to the exploration of the region.
//
// The Bible guides and never locks: nothing here asks whether a passage was read. Whoever reaches the place acts.
// Each lived step is one fact in the world record (world-state.ts), under the step's id; a reload opens the first
// step that was not lived, never mid-clause. Pure and deterministic (test/story-journey.test.ts plays all twenty on
// the real terrain). Nothing here reads the keyboard, the clock or the storage.
import { readingTime, type Fala, type Vec2 } from "./missions.ts";
import { SCENE_DEVELOPMENT_NOTICE } from "./journey.ts";
import { recordStage, savedStage, type WorldState } from "./world-state.ts";
import { STORY_STEPS, stepLines, stepRef, type StoryPlaceId, type StoryStepDef } from "./story-steps.ts";
import type { TeachingView } from "./teaching-journey.ts";

/** The verses of these steps, as tools/build_story.py writes them (src/data/mc-caminho.json). */
export type StoryData = { id: string; livro: string; passagens: string[]; versiculos: Record<string, string> };

/** A step ready to be played: its definition, its passage's reference and its clauses, cut out of the verses. */
export type StoryStep = { def: StoryStepDef; ref: string; lines: Fala[] };

/** Every step with its clauses, or null when one clause of one step cannot be cut out of the data: then the story is
 * not offered at all, rather than with a hole in it or with typed words in a clause's place. This is the one place
 * where the story's text is decided to be there: the game's Bible (story-bible.ts) shows the verses these steps
 * quote, so what plays and what the Bible lists cannot differ. */
export function storySteps(d: Pick<StoryData, "livro" | "versiculos">, defs: readonly StoryStepDef[] = STORY_STEPS): StoryStep[] | null {
  const out: StoryStep[] = [], ids = new Set<string>();
  for (const def of defs) {
    const lines = stepLines(def, d.versiculos, d.livro), ref = stepRef(d.livro, def);
    if (!lines || !ref || ids.has(def.id)) return null;
    ids.add(def.id);
    out.push({ def, ref, lines });
  }
  return out.length ? out : null;
}

/** Level design, not text. radius: how close to its place a step is offered or lived; slack: how far past it the
 * offer holds, so it does not flicker at the edge; leave: in a step with an action, walking this far past the radius
 * while the clauses are on screen ends them (nothing is kept, and the step can be lived again); afterEnd: game
 * seconds the closing words stay once the last step was lived. */
export const STORY = { radius: 7, slack: 1.5, leave: 6, afterEnd: 25 } as const;

/** off: not open yet. walk: on the way to the step's place. ready: at the place, the action is offered. line: the
 * clauses are on screen. end: every step was lived. */
export type StoryPhase = "off" | "walk" | "ready" | "line" | "end";
export type StoryState = {
  phase: StoryPhase;
  /** The step being played; the number of steps once all were lived. */
  step: number;
  /** While phase is "line": which clause is on screen, and the game seconds it still stays. */
  index: number;
  line: Fala | null;
  lineLeft: number;
  /** Game seconds lived with the story open. */
  time: number;
  /** Once ended: the game time until which the closing words are shown. */
  until: number;
};

export type StoryEvent =
  | { type: "begin" }                                 // the story opened
  | { type: "arrived"; step: number }                 // at the step's place
  | { type: "left"; step: number }                    // away from it again: the offer is gone
  | { type: "line"; step: number; fala: Fala }        // a clause came on screen
  | { type: "interrupted"; step: number }             // he walked away while the clauses were on screen
  | { type: "done"; step: number; id: string }        // a step was lived
  | { type: "end" }                                   // the last one was
  | { type: "save"; id: string };                     // a fact to keep (recordStory)
export type StoryResult = { next: StoryState; events: StoryEvent[] };

export type StoryPlaceMap = Readonly<Record<StoryPlaceId, Vec2>>;

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);
const same = (s: StoryState): StoryResult => ({ next: s, events: [] });

export const freshStory = (): StoryState => ({ phase: "off", step: 0, index: 0, line: null, lineLeft: 0, time: 0, until: 0 });

/** The story as a reload finds it: at the first step the record does not have as lived. It stays "off" until
 * beginStory. A record with a later step lived and an earlier one not (it cannot be written by playing) opens at the
 * earlier one: no step is skipped on the word of a damaged record. */
export function restoreStory(steps: readonly StoryStep[] | null, world: WorldState): StoryState {
  if (!steps) return freshStory();
  const first = steps.findIndex((s) => savedStage(world, s.def.id) !== "completed");
  return { ...freshStory(), step: first < 0 ? steps.length : first };
}

/** The house was reached: the story opens at its step. Calling it again changes nothing. A story already lived to
 * the end opens ended and silent. */
export function beginStory(s: StoryState, steps: readonly StoryStep[]): StoryResult {
  if (s.phase !== "off") return same(s);
  if (s.step >= steps.length) return { next: { ...s, phase: "end", step: steps.length, until: s.time }, events: [] };
  return { next: { ...s, phase: "walk" }, events: [{ type: "begin" }] };
}

/** One frame. `action` is the frame's one press of the action button, already routed to this step by whoever reads
 * the input (interactions.ts receiver "mission"). `clear` says nothing stands between him and the step's place: a
 * step is neither offered nor lived through a wall. dt is game seconds: 0 while a panel is open, and then nothing
 * moves. */
export function stepStory(s: StoryState, steps: readonly StoryStep[], places: StoryPlaceMap,
  input: { pos: Vec2; action: boolean; clear: boolean }, dt: number): StoryResult {
  if (!(dt > 0) || s.phase === "off") return same(s);
  const time = s.time + dt;
  if (s.phase === "end") return { next: { ...s, time }, events: [] };
  const cur = steps[s.step];
  if (!cur) return { next: { ...s, time, phase: "end", step: steps.length, line: null, lineLeft: 0, index: 0, until: time }, events: [{ type: "end" }] };
  // a distance that is not a number (a place or a position that is not there) is never "near": every test below
  // asks whether he is within reach, so nothing is offered or lived on a broken measure
  const step = s.step, at = places[cur.def.place], d = at ? dist(input.pos, at) : Number.NaN;
  const speak = (): StoryResult => ({
    next: { ...s, time, phase: "line", index: 0, line: cur.lines[0], lineLeft: readingTime(cur.lines[0].texto) },
    events: [{ type: "line", step, fala: cur.lines[0] }],
  });
  if (s.phase === "walk") {
    if (!(d <= STORY.radius) || !input.clear) return { next: { ...s, time }, events: [] };
    if (cur.def.action) return { next: { ...s, time, phase: "ready" }, events: [{ type: "arrived", step }] };
    const said = speak();                                              // a step lived by arriving
    return { next: said.next, events: [{ type: "arrived", step }, ...said.events] };
  }
  if (s.phase === "ready") {
    if (!(d <= STORY.radius + STORY.slack) || !input.clear) return { next: { ...s, time, phase: "walk" }, events: [{ type: "left", step }] };
    return input.action ? speak() : { next: { ...s, time }, events: [] };
  }
  // The clauses are on screen: pressing again does nothing. In a step with an action, walking away from the place
  // ends them (he left what he was doing; nothing is kept). A step lived by arriving was lived when he arrived: its
  // clauses stay to their end wherever he goes next, so a player who keeps walking, as the mission line of such a
  // step tells him to, does not cancel them.
  if (cur.def.action && !(d <= STORY.radius + STORY.leave)) return { next: { ...s, time, phase: "walk", line: null, lineLeft: 0, index: 0 }, events: [{ type: "interrupted", step }] };
  const left = s.lineLeft - dt;
  if (left > 0) return { next: { ...s, time, lineLeft: left }, events: [] };
  const following = cur.lines[s.index + 1];
  if (following) return { next: { ...s, time, index: s.index + 1, line: following, lineLeft: readingTime(following.texto) }, events: [{ type: "line", step, fala: following }] };
  const ended = step + 1 >= steps.length;
  return {
    next: { ...s, time, phase: ended ? "end" : "walk", step: step + 1, line: null, lineLeft: 0, index: 0, until: ended ? time + STORY.afterEnd : 0 },
    events: [{ type: "done", step, id: cur.def.id }, { type: "save", id: cur.def.id }, ...(ended ? [{ type: "end" } as const] : [])],
  };
}

/** The world record after these events. A step's fact is written once: a repeated event keeps the record as it is
 * (the same object comes back: nothing to write). */
export function recordStory(world: WorldState, events: readonly StoryEvent[], now: number): WorldState {
  return events.reduce((w, e) => (e.type === "save" ? recordStage(w, e.id, "completed", now) : w), world);
}

/** What the HUD shows for the story: the teaching's view (hud.teaching draws it), with the step's number. Every
 * string that is not `line` is the game's own guidance. */
export type StoryView = TeachingView & { mark: string; step: number; total: number };

export const STORY_GUIDANCE = {
  walk: "O radar aponta o lugar que o jogo escolheu para este trecho.",
  end: "A travessia para o outro lado ainda está em preparação. A região continua aberta para caminhar.",
} as const;

/** The view of the story for a player at `pos`. Null while it is not open, and null again once it was lived to the
 * end and the closing words had their time: the screen then belongs to the exploration of the region. */
export function storyView(s: StoryState, steps: readonly StoryStep[], places: StoryPlaceMap, pos: Vec2, touch: boolean): StoryView | null {
  if (s.phase === "off") return null;
  const total = steps.length;
  const none = { action: null, line: null, announce: null, narrative: "", route: [] as Vec2[] };
  if (s.phase === "end") {
    const last = steps[total - 1];
    if (!last || !(s.time < s.until)) return null;
    return { ...none, phase: "done", mark: `JORNADA · ${total} DE ${total}`, step: total, total, objective: "Explore a região",
      ref: last.ref, goal: null, dist: null, scene: "", guidance: STORY_GUIDANCE.end };
  }
  const cur = steps[s.step];
  if (!cur) return null;
  const at = places[cur.def.place], far = at ? dist(pos, at) : Number.NaN;
  const base = { ...none, mark: `JORNADA · ${s.step + 1} DE ${total}`, step: s.step, total, ref: cur.ref, goal: at ?? null, dist: Number.isFinite(far) ? far : null };
  const scene = cur.def.people ? SCENE_DEVELOPMENT_NOTICE : "";
  if (s.phase === "walk") return { ...base, phase: "walk", objective: cur.def.objective, scene: "", guidance: STORY_GUIDANCE.walk };
  if (s.phase === "ready") {
    return { ...base, phase: "ready", objective: cur.def.doing, action: cur.def.action, scene,
      guidance: touch ? `Toque em ${cur.def.action}.` : `Aperte E: ${cur.def.action}.` };
  }
  return { ...base, phase: "line", objective: cur.def.action ? cur.def.doing : cur.def.objective, line: s.line, scene, guidance: "" };
}
