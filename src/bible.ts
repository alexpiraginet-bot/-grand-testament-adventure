// The game's Bible. Opening it is how the player learns the next step (Alex, 13/11/2026): the passage being played is
// read verse by verse, in its place in biblia-conectada's chronological reading order (src/data/biblia-cronologica.json,
// made by tools/build_bible.py from the itinerary and the BLIVRE text). Nothing here is typed: which verses belong to
// which step, where the passage sits in the order and every reference are derived from the data. Pure:
// test/bible.test.ts. The panel is src/bibleui.ts.
import { EPILOGUE_VERSE, verseRef, type RoamPhase } from "./freeroam.ts";
import type { EpisodeData, Goal, Phase } from "./missions.ts";

export type BiblePassage = { evangelho: string; capitulo: number; de: number; ate: number; relacao: string; ref: string };
export type BibleMoment = {
  id: string; titulo: string; fase: string; lugar: string;
  evangelho: string;                                   // the gospel whose text is shown (the itinerary's default)
  ref: string; versiculos: { n: number; texto: string }[];
  passagens: BiblePassage[];                           // every gospel's passage for this moment, by reference
};
export type BibleData = {
  origem: { roteiro: string; roteiro_sha256: string; texto: string; texto_sha256: string; commit: string | null };
  fonte_texto: string;
  evangelhos: { id: string; nome: string }[];
  momentos: BibleMoment[];
};
type Episode = EpisodeData & { personagens?: { id: string; ref: string; nome: string }[] };

/** The book names of the episode data's verse keys ("Mark.1.16") as the itinerary names its gospels. */
export const GOSPEL_OF: Record<string, string> = { Matt: "mateus", Mark: "marcos", Luke: "lucas", John: "joao" };

type Key = { book: string; chapter: number; verse: number };
function parseKey(key: string): Key | null {
  const m = /^([^.]+)\.(\d+)\.(\d+)$/.exec(key);
  return m ? { book: m[1], chapter: Number(m[2]), verse: Number(m[3]) } : null;
}
const before = (a: Key, b: Key) => a.chapter < b.chapter || (a.chapter === b.chapter && a.verse < b.verse);

/** The episode's verse keys in the text's own order. */
export function verseKeys(ep: Pick<EpisodeData, "versiculos">): string[] {
  return Object.keys(ep.versiculos).filter((k) => parseKey(k)).sort((a, b) => {
    const x = parseKey(a)!, y = parseKey(b)!;
    return x.chapter - y.chapter || x.verse - y.verse;
  });
}

/** "Marcos 1:16" for one verse, "Marcos 1:16–18" for a run inside a chapter; null when the keys are not a run. */
export function rangeRef(ep: Pick<EpisodeData, "ref_pt">, first: string, last: string): string | null {
  const a = parseKey(first), b = parseKey(last), ref = verseRef(ep, first);
  if (!a || !b || !ref || a.book !== b.book || a.chapter !== b.chapter || b.verse < a.verse) return null;
  return a.verse === b.verse ? ref : `${ref}–${b.verse}`;
}

/** Where the played passage goes in the reading order: right after the last moment that the same gospel tells
 * before it. The itinerary does not fix how the four gospels' accounts interleave and neither does this: a moment the
 * passage's gospel does not tell stays where the itinerary put it. Returns the index to insert at, and the moment it
 * follows (null at the very beginning or when the gospel is unknown). */
export function episodePosition(moments: readonly BibleMoment[], firstVerse: string): { at: number; after: BibleMoment | null; gospel: string | null } {
  const k = parseKey(firstVerse), gospel = k ? GOSPEL_OF[k.book] ?? null : null;
  let at = 0;
  if (k && gospel) moments.forEach((m, i) => {
    if (m.passagens.some((p) => p.evangelho === gospel && before({ book: k.book, chapter: p.capitulo, verse: p.de }, k))) at = i + 1;
  });
  return { at, after: at > 0 ? moments[at - 1] : null, gospel };
}

/** One step of the game inside the passage: the verses that tell it, and what the game asks for. */
export type BibleStep = { kind: "missao" | "epilogo"; verses: string[]; ref: string; objetivo: string };

/** The passage's verses, step by step. A mission begins at the earliest verse among those that name the people it
 * calls and the verse of its line; a mission with neither (the walk to the shore) begins where the passage does. Its
 * verses run up to the verse before the next mission begins; missions that begin at the same verse share only that
 * verse. The last mission runs to the end of the passage. The verse after the passage (freeroam.ts) is the epilogue. */
export function episodeSteps(ep: Episode, goals: readonly Goal[], epilogueObjective: string | null): BibleStep[] {
  const all = verseKeys(ep);
  const epi = all.includes(EPILOGUE_VERSE) ? EPILOGUE_VERSE : null;
  const keys = epi ? all.slice(0, all.indexOf(epi)) : all;
  if (!keys.length) return [];
  const byRef = new Map(keys.map((k) => [verseRef(ep, k), k] as const));
  const begins: number[] = [];
  ep.missoes.forEach((m, i) => {
    const g = goals[i];
    const named = g?.kind === "call" ? g.npcs.map((id) => ep.personagens?.find((p) => p.id === id)?.ref) : [];
    const cited = [...named, m.fala ? byRef.get(m.fala.ref) : undefined].map((k) => (k ? keys.indexOf(k) : -1)).filter((x) => x >= 0);
    const begin = cited.length ? Math.min(...cited) : 0;
    begins.push(Math.max(begin, begins[i - 1] ?? 0));          // never before the mission that precedes it
  });
  const steps: BibleStep[] = ep.missoes.map((m, i) => {
    const next = begins[i + 1];
    const end = next === undefined ? keys.length - 1 : next > begins[i] ? next - 1 : begins[i];
    const verses = keys.slice(begins[i], end + 1);
    return { kind: "missao", verses, ref: rangeRef(ep, verses[0], verses[verses.length - 1]) ?? "", objetivo: m.objetivo };
  });
  if (epi && epilogueObjective) steps.push({ kind: "epilogo", verses: [epi], ref: verseRef(ep, epi) ?? "", objetivo: epilogueObjective });
  return steps;
}

/** The step being played: the mission's, then the epilogue's while the way back is open; steps.length when the whole
 * passage has been lived (exploring freely). */
export function currentStep(steps: readonly BibleStep[], phase: Phase, mission: number, roam: RoamPhase): number {
  if (phase !== "done") return Math.min(Math.max(0, mission), Math.max(0, steps.length - 1));
  const epi = steps.findIndex((s) => s.kind === "epilogo");
  return roam === "free" || epi < 0 ? steps.length : epi;
}

export type VerseState = "vivido" | "agora" | "a-seguir";

/** Each verse of the passage against the step being played: the current step's verses are "agora"; a verse whose
 * steps are all behind is "vivido"; the rest are still ahead. */
export function verseStates(steps: readonly BibleStep[], current: number): Map<string, VerseState> {
  const out = new Map<string, VerseState>();
  steps.forEach((s, i) => { for (const k of s.verses) {
    const was = out.get(k);
    const now: VerseState = i === current ? "agora" : i < current ? "vivido" : "a-seguir";
    // a verse shared by two steps: being played wins, then still ahead, then lived
    out.set(k, was === "agora" || now === "agora" ? "agora" : was === "a-seguir" || now === "a-seguir" ? "a-seguir" : "vivido");
  } });
  return out;
}

/** The reading order with the played passage in its place. */
export type BibleEntry =
  | { kind: "momento"; moment: BibleMoment; when: "antes" | "depois" }
  | { kind: "episodio"; titulo: string; lugar: string; ref: string };

export function readingOrder(data: BibleData, ep: Episode): { entries: BibleEntry[]; after: BibleMoment | null; gospelName: string | null } {
  const keys = verseKeys(ep);
  const pos = episodePosition(data.momentos, keys[0] ?? "");
  const entries: BibleEntry[] = data.momentos.map((moment, i) => ({ kind: "momento", moment, when: i < pos.at ? "antes" : "depois" }));
  entries.splice(pos.at, 0, { kind: "episodio", titulo: ep.titulo, lugar: ep.lugar, ref: keys.length ? rangeRef(ep, keys[0], keys[keys.length - 1]) ?? ep.ref_pt : ep.ref_pt });
  return { entries, after: pos.after, gospelName: data.evangelhos.find((g) => g.id === pos.gospel)?.nome ?? null };
}
