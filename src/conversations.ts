// A short, optional conversation with someone who is really there, and a reaction one can see. This is the first
// everyday encounter the game can offer with the people it has: no object changes hands (there is no reviewed clip
// for picking up or putting down), so it does not go through encounters.ts's carrying stages; it uses the same
// front door, interactions.ts: each person who can be spoken to is a Target of kind "talk", the button's label is
// that target's, and one press goes to the one receiver the HUD shows.
//
// Every line here is the game's own writing and is shown as "Narrativa do jogo", never as Scripture: no verse says
// these words. They are way-finding, said by someone of the town, and none is attributed to Jesus. While a verse is
// on screen nobody speaks (an open conversation closes), one person speaks at a time, a line is not repeated in the
// same visit, and ambient lines keep a minimum interval. A person who is not drawn offers nothing.
//
// The reaction uses only what exists: the speaker turns to the hero while speaking and then to the place they spoke
// of. No gesture is invented for a mesh that has no clip for it.
// Pure (test/conversations.test.ts). It reads no input: main.ts routes the frame's one press (interactions.ts).
import { readingTime, type Vec2 } from "./missions.ts";
import type { Target } from "./interactions.ts";

export const SPEECH_LABEL = "Narrativa do jogo";
export const TALK_LABEL = "Conversar";
/** Level design. quiet: seconds between two conversations (the plan's interval for ambient lines); leave: walking
 * this far from the speaker ends the conversation; look: seconds the speaker keeps turned to the place they named. */
export const TALK = { quiet: 45, leave: 4.5, look: 3 } as const;

export type Line = {
  id: string;
  /** Who says it: an identity id (npc-population.ts). */
  speaker: string;
  texto: string;
  /** When it makes sense: before the teaching step was lived, after it, or at any time. */
  when: "antes-do-ensino" | "depois-do-ensino" | "sempre";
  /** The place the line speaks of, by its id in the town's layout: the speaker turns to it afterwards. */
  aponta: "patio-ensino" | "casa-marcos-1-29" | null;
};

/** The lines the game has. Simão is of the town (Mark 1:29 names his and André's house there), so he can tell the
 * way. Written for the game; subject to Alex's editorial review before they are shown to players. */
export const TOWN_LINES: readonly Line[] = [
  { id: "simao-caminho-do-patio", speaker: "simao", when: "antes-do-ensino", aponta: "patio-ensino",
    texto: "O lugar onde a cidade se reúne fica logo depois da passagem estreita." },
  { id: "simao-nossa-casa", speaker: "simao", when: "depois-do-ensino", aponta: "casa-marcos-1-29",
    texto: "Nossa casa fica mais abaixo, no caminho do lago." },
];

/** Someone drawn in the scene this frame. */
export type Present = { id: string; nome: string | null; pos: Vec2; height: number };

export type TalkState = {
  /** The conversation on screen: who speaks, which line, the game seconds it still stays. */
  open: { speaker: string; line: string; left: number } | null;
  /** After a line: who keeps turned to the place they named, and for how long. */
  looking: { speaker: string; toward: string; left: number } | null;
  /** Lines already said in this visit. */
  said: string[];
  /** Seconds until someone may be spoken to again. */
  quiet: number;
};
export const freshTalk = (): TalkState => ({ open: null, looking: null, said: [], quiet: 0 });

export type TalkContext = {
  /** A verse is on screen (a mission's line, the epilogue's, the teaching's): nobody speaks over it. */
  scripture: boolean;
  /** The teaching step was lived (teaching-journey.ts phase "done"). */
  taught: boolean;
};

/** The line this person would say now: the first of theirs that fits the moment and was not said in this visit. */
export function nextLine(lines: readonly Line[], speaker: string, s: TalkState, ctx: TalkContext): Line | null {
  const fits = (l: Line) => l.when === "sempre" || (l.when === "depois-do-ensino") === ctx.taught;
  return lines.find((l) => l.speaker === speaker && fits(l) && !s.said.includes(l.id)) ?? null;
}

/** The people who can be spoken to, as targets for interactions.ts. A person is a target only while a press would
 * really open a conversation: they are drawn, have something to say, nobody else is speaking, no verse is on screen
 * and the interval has passed. Reach, facing and walls are interactions.ts's own checks. */
export function talkTargets(lines: readonly Line[], people: readonly Present[], s: TalkState, ctx: TalkContext): Target[] {
  return people.map((p) => ({
    id: `conversa:${p.id}`, kind: "talk" as const, label: TALK_LABEL, anchor: p.pos, height: p.height,
    available: !s.open && !ctx.scripture && s.quiet <= 0 && nextLine(lines, p.id, s, ctx) !== null,
  }));
}

export type TalkEffect =
  | { type: "speech"; speaker: string; texto: string; label: typeof SPEECH_LABEL }
  | { type: "closed"; why: "lida" | "dispensada" | "afastou-se" | "escritura" | "ausente" };
export type TalkStep = { next: TalkState; effects: TalkEffect[] };
const same = (s: TalkState): TalkStep => ({ next: s, effects: [] });

/** The frame's press, already routed here because the HUD showed this target (`conversa:<id>`), or, while someone
 * is speaking, because the conversation is what is under way ("Dispensar"). Opening checks again that it may open:
 * a press is never trusted over the state. */
export function talkPress(s: TalkState, lines: readonly Line[], people: readonly Present[], targetId: string | null, ctx: TalkContext): TalkStep {
  if (s.open) return close(s, "dispensada");
  const speaker = targetId?.startsWith("conversa:") ? targetId.slice("conversa:".length) : null;
  if (!speaker || ctx.scripture || s.quiet > 0 || !people.some((p) => p.id === speaker)) return same(s);
  const line = nextLine(lines, speaker, s, ctx);
  if (!line) return same(s);
  return { next: { ...s, open: { speaker, line: line.id, left: readingTime(line.texto) }, looking: null, said: [...s.said, line.id] },
    effects: [{ type: "speech", speaker, texto: line.texto, label: SPEECH_LABEL }] };
}

function close(s: TalkState, why: Extract<TalkEffect, { type: "closed" }>["why"], lines: readonly Line[] = []): TalkStep {
  if (!s.open) return same(s);
  const line = lines.find((l) => l.id === s.open!.line);
  const looking = why === "lida" && line?.aponta ? { speaker: s.open.speaker, toward: line.aponta, left: TALK.look } : null;
  return { next: { ...s, open: null, looking, quiet: TALK.quiet }, effects: [{ type: "closed", why }] };
}

/** One frame: the line's reading time, the interval, and the things that end a conversation early. dt is game
 * seconds; 0 (a panel open) moves nothing. */
export function talkStep(s: TalkState, lines: readonly Line[], people: readonly Present[], hero: Vec2, dt: number, ctx: TalkContext): TalkStep {
  if (!(dt > 0)) return same(s);
  let next: TalkState = { ...s, quiet: Math.max(0, s.quiet - dt) };
  if (next.looking) { const left = next.looking.left - dt; next = { ...next, looking: left > 0 && people.some((p) => p.id === next.looking!.speaker) ? { ...next.looking, left } : null }; }
  if (!next.open) return { next, effects: [] };
  const speaker = people.find((p) => p.id === next.open!.speaker);
  if (!speaker) return close(next, "ausente");
  if (ctx.scripture) return close(next, "escritura");
  if (Math.hypot(speaker.pos.x - hero.x, speaker.pos.z - hero.z) > TALK.leave) return close(next, "afastou-se");
  const left = next.open.left - dt;
  return left > 0 ? { next: { ...next, open: { ...next.open, left } }, effects: [] } : close(next, "lida", lines);
}

/** What the scene and the HUD need this frame. `busy`: people who hold still (the mission's follower stops, a
 * routine does not move them). `pinned`: people the population must not unload. `facing`: where each of them turns:
 * to the hero while speaking, to the named place afterwards. `ongoing`: what the button means while someone speaks. */
export function talkView(s: TalkState, lines: readonly Line[], people: readonly Present[], hero: Vec2, places: Readonly<Record<string, Vec2 | undefined>>) {
  const line = s.open ? lines.find((l) => l.id === s.open!.line) ?? null : null;
  const speaker = s.open ? people.find((p) => p.id === s.open!.speaker) ?? null : null;
  const facing: { id: string; toward: Vec2 }[] = [];
  if (s.open && speaker) facing.push({ id: speaker.id, toward: hero });
  const spot = s.looking ? places[s.looking.toward] : undefined;
  if (s.looking && spot) facing.push({ id: s.looking.speaker, toward: spot });
  const held = [...new Set([...(s.open ? [s.open.speaker] : []), ...(s.looking && spot ? [s.looking.speaker] : [])])];
  return {
    speech: line && speaker ? { nome: speaker.nome, texto: line.texto, label: SPEECH_LABEL } : null,
    ongoing: s.open ? { label: "Dispensar" } : null,
    busy: held, pinned: held, facing,
  };
}
