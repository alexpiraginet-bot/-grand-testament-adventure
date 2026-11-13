// After the episode: the player may keep walking the region with those who were called. One way back is staged from
// the text itself: Mark 1:21 opens with their entering Capernaum, so returning to the village shows that clause,
// literal and with its reference, and then the region stays open. No mission is added to the episode's data and the
// mission logic (missions.ts) is untouched. Pure and deterministic: test/freeroam.test.ts plays it through.
import { initialState, readingTime, type EpisodeData, type Fala, type Goal, type State, type Vec2 } from "./missions.ts";

/** off: the episode is still being played, or its end card is up. return: exploring, the way back still ahead.
 *  line: the clause of Mark 1:21 is on screen. free: exploring with nothing left to do in this episode. */
export type RoamPhase = "off" | "return" | "line" | "free";
export type RoamState = { phase: RoamPhase; line: Fala | null; lineLeft: number; time: number };
export type RoamEvent = { type: "line"; fala: Fala } | { type: "epilogue-done" };
/** Where the way back ends: within `radius` metres of `at`. */
export type RoamGoal = { at: Vec2; radius: number };

/** The verse that follows the episode's passage (Mark 1:16-20), as keyed in the episode data. */
export const EPILOGUE_VERSE = "Mark.1.21";
/** Level design, not text: how close to the point where the walk began counts as back in the village. */
export const EPILOGUE_RADIUS_M = 25;

/** "Mark.1.21" with the episode's own book name ("Marcos 1:16–20") -> "Marcos 1:21"; null when either is malformed. */
export function verseRef(ep: Pick<EpisodeData, "ref_pt">, key: string): string | null {
  const m = /^[^.]+\.(\d+)\.(\d+)$/.exec(key);
  const book = /^(.*?\S)\s+\d/.exec(ep.ref_pt)?.[1];
  return m && book ? `${book} ${m[1]}:${m[2]}` : null;
}

/** The clause the game stages when the player is back in the village: the verse's text up to its first ";" (in the
 * BLIVRE: "Eles entraram em Cafarnaum"). Derived from the episode data, never typed; null when the verse is not there. */
export function epilogueLine(ep: Pick<EpisodeData, "ref_pt" | "versiculos">): Fala | null {
  const verse = ep.versiculos[EPILOGUE_VERSE];
  const ref = verseRef(ep, EPILOGUE_VERSE);
  const clause = verse?.split(";")[0].trim();
  return clause && ref ? { texto: clause, ref } : null;
}

export const initialRoam = (): RoamState => ({ phase: "off", line: null, lineLeft: 0, time: 0 });

/** The player chose to keep exploring after the last mission. Without a line to stage there is no way back to walk. */
export function startRoam(s: RoamState, fala: Fala | null): void {
  if (s.phase === "off") s.phase = fala ? "return" : "free";
}

export function stepRoam(s: RoamState, goal: RoamGoal, fala: Fala | null, pos: Vec2, dt: number): RoamEvent[] {
  const ev: RoamEvent[] = [];
  if (s.phase === "off") return ev;
  s.time += dt;
  if (s.phase === "return" && fala && Math.hypot(pos.x - goal.at.x, pos.z - goal.at.z) <= goal.radius) {
    s.phase = "line"; s.line = fala; s.lineLeft = readingTime(fala.texto);
    ev.push({ type: "line", fala });
  } else if (s.phase === "line") {
    s.lineLeft -= dt;
    if (s.lineLeft <= 0) { s.line = null; s.lineLeft = 0; s.phase = "free"; ev.push({ type: "epilogue-done" }); }
  }
  return ev;
}

/** A player who already finished the episode comes back only to walk the region: free at once, no way back to stage. */
export function startFree(s: RoamState): void {
  if (s.phase === "off") s.phase = "free";
}

/** The mission state of an episode already finished: every mission ticked, the counter full, everyone called
 * following. The same state a played-through episode ends in (the test plays one and compares). */
export function finishedState(ep: EpisodeData, goals: Goal[]): State {
  const s = initialState();
  s.phase = "done";
  s.mission = Math.max(0, ep.missoes.length - 1);
  s.filled = ep.missoes.at(-1)?.conta ?? 0;
  ep.missoes.forEach((_, i) => { s.completedAt.push(0); const g = goals[i]; if (g?.kind === "call") s.followers.push(...g.npcs); });
  return s;
}

/** Metres from the player to the end of the way back, for the HUD; null once there is nowhere left to go. */
export function roamDistance(s: RoamState, goal: RoamGoal, pos: Vec2): number | null {
  return s.phase === "return" ? Math.hypot(pos.x - goal.at.x, pos.z - goal.at.z) : null;
}
