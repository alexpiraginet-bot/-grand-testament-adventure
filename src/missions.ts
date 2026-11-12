// Mission logic of an episode, with no rendering: what the player has to do, what counts, what the HUD shows.
// Pure and deterministic so the tests can play an episode through (test/missions.test.ts).

export type Vec2 = { x: number; z: number };

export type Fala = { texto: string; ref: string };

export type EpisodeData = {
  id: string;
  titulo: string;
  ref_pt: string;
  lugar: string;
  contador: { rotulo: string; prova: { ref: string; nome: string }[] };
  missoes: { objetivo: string; acao: string | null; fala: Fala | null; conta: number }[];
  versiculos: Record<string, string>;
};

// Where each mission happens. kind "reach": done within `radius` of `at`, or anywhere the ground is at most `below`
// metres above the lake (the beach). kind "call": the action
// prompt appears within `radius` of `at`; the action plays the line, and the mission ends when the line has been read.
export type Goal =
  | { kind: "reach"; at: Vec2; radius: number; below?: number }
  | { kind: "call"; at: Vec2; radius: number; npcs: string[] };

export type Phase = "intro" | "play" | "line" | "done";

export type State = {
  phase: Phase;
  mission: number;            // index into missoes
  filled: number;             // counter marks filled
  followers: string[];        // npc ids following the player
  line: Fala | null;          // the subtitle on screen
  lineLeft: number;           // seconds the subtitle stays
  promptVisible: boolean;
  completedAt: number[];      // game time when each mission was ticked
  time: number;
};

export type Event =
  | { type: "mission-start"; mission: number }
  | { type: "line"; fala: Fala }
  | { type: "follow"; npcs: string[] }
  | { type: "mission-done"; mission: number }
  | { type: "episode-done" };

export type Input = { pos: Vec2; groundHeight: number; action: boolean };

/** Seconds a line stays on screen: long enough to read it (2.4 s plus 55 ms per character, as a reader of the reels'
 * subtitles at 1.1x needs), then the mission is ticked. */
export function readingTime(text: string): number {
  return 2.4 + 0.055 * text.length;
}

/** The counter's total is how many names the passage gives (the proof list), never a typed number. */
export function counterTotal(ep: EpisodeData): number {
  return ep.contador.prova.length;
}

export function initialState(): State {
  return { phase: "intro", mission: 0, filled: 0, followers: [], line: null, lineLeft: 0, promptVisible: false, completedAt: [], time: 0 };
}

export function start(s: State): Event[] {
  if (s.phase !== "intro") return [];
  s.phase = "play";
  return [{ type: "mission-start", mission: 0 }];
}

function dist(a: Vec2, b: Vec2) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Distance in metres from the player to the current goal, for the HUD (null when there is no goal on the map). */
export function distanceToGoal(s: State, goals: Goal[], pos: Vec2): number | null {
  if (s.phase === "intro" || s.phase === "done") return null;
  return dist(pos, goals[s.mission].at);
}

export function step(s: State, ep: EpisodeData, goals: Goal[], input: Input, dt: number): Event[] {
  const ev: Event[] = [];
  s.time += dt;
  if (s.phase === "intro" || s.phase === "done") return ev;
  const m = ep.missoes[s.mission];
  const g = goals[s.mission];
  const finish = () => {
    s.filled = m.conta;
    s.completedAt[s.mission] = s.time;
    ev.push({ type: "mission-done", mission: s.mission });
    if (s.mission === ep.missoes.length - 1) {
      s.phase = "done";
      ev.push({ type: "episode-done" });
    } else {
      s.mission += 1;
      s.phase = "play";
      ev.push({ type: "mission-start", mission: s.mission });
    }
  };

  if (s.phase === "line") {
    s.lineLeft -= dt;
    if (s.lineLeft <= 0) {
      s.line = null;
      finish();
    }
    return ev;
  }

  if (g.kind === "reach") {
    s.promptVisible = false;
    if (dist(input.pos, g.at) <= g.radius || (g.below !== undefined && input.groundHeight <= g.below)) finish();
    return ev;
  }

  s.promptVisible = dist(input.pos, g.at) <= g.radius;
  if (s.promptVisible && input.action) {
    s.promptVisible = false;
    if (m.fala) {
      s.line = m.fala;
      s.lineLeft = readingTime(m.fala.texto);
      s.phase = "line";
      ev.push({ type: "line", fala: m.fala });
    }
    s.followers.push(...g.npcs);
    ev.push({ type: "follow", npcs: g.npcs });
    if (!m.fala) finish();
  }
  return ev;
}
