// The twenty steps of the story after the teaching in Capernaum: Mark 1:30 to 4:35, in Mark's order, each one a place
// to reach on the real ground, sometimes an action, and the passage's own words on screen.
//
// What is the text's and what is the game's. Every line shown is a clause cut out of a BLIVRE verse, to the letter
// (src/data/mc-caminho.json, tools/build_story.py): the cuts below name where a clause begins and ends inside its
// verse, never the words themselves. The action's word comes from the verb the passage gives him ("aproximou-se",
// "esteve a orar", "estendeu a mão"); it is not a power the player has anywhere else. The objective is the game's
// guidance ("Orientação"). Nothing here is a line written for a character.
//
// What is not there. None of the people of these passages is drawn (only Simão has a reviewed model), so each step
// with people carries the notice "Cena em desenvolvimento · personagens em preparação". The steps marked `review`
// stage a healing, an exorcism summary or a controversy with the text alone: they wait for Alex's editorial review
// before they are shown to players. Every place is the game's choice on its art-directed ground (story-places.ts).
//
// A step is told by the verses it quotes, and by no other: the game's Bible marks a verse as lived only when a
// clause of it was on screen. So a passage with a part the game does not stage has a gap in its reference
// ("Marcos 2:3–5, 11–12"), and the verses in the gap are not in the data (tools/build_story.py).
import type { Fala } from "./missions.ts";

export type StoryPlaceId =
  | "casa" | "rua-da-casa" | "lugar-deserto" | "encontro" | "caminho-das-aldeias" | "caminho"
  | "praia" | "posto" | "casa-de-levi" | "redes" | "barco" | "monte";

/** Where a clause begins and ends inside its verse. `from`: after the first occurrence of this text. `until`: before
 * the first occurrence of this text after the beginning. `through`: up to and including it. Neither: the verse's end. */
export type Cut = { verse: string; from?: string; until?: string; through?: string };

export type StoryStepDef = {
  /** Stable: the world record refers to it. */
  id: string;
  place: StoryPlaceId;
  /** The button's word, from the passage's own verb; null when reaching the place is the step. */
  action: string | null;
  /** The mission line on the way there, and once there. A step lived by arriving has one line: both are the same. */
  objective: string;
  doing: string;
  cuts: readonly Cut[];
  /** The passage has people who are not drawn: the scene's notice shows. */
  people: boolean;
  /** Needs Alex's editorial review before it reaches players, and why. */
  review: "cura" | "controvérsia" | null;
};

const v = (chapter: number, verse: number) => `Mark.${chapter}.${verse}`;
const whole = (chapter: number, verse: number): Cut => ({ verse: v(chapter, verse) });

export const STORY_STEPS: readonly StoryStepDef[] = [
  { id: "mc-1-30-sogra-de-simao", place: "casa", action: "Aproximar-se",
    objective: "Vá à porta da casa de Simão e de André", doing: "Aproxime-se da sogra de Simão", people: true, review: "cura",
    cuts: [{ verse: v(1, 30), until: "," }, whole(1, 31)] },
  { id: "mc-1-32-ao-entardecer", place: "rua-da-casa", action: null,
    objective: "Ao entardecer, saia à rua diante da casa", doing: "Ao entardecer, saia à rua diante da casa", people: true, review: "cura",
    cuts: [{ verse: v(1, 32), until: ";" }, whole(1, 33), { verse: v(1, 34), through: "demônios." }] },
  { id: "mc-1-35-lugar-deserto", place: "lugar-deserto", action: "Orar",
    objective: "De madrugada, vá a um lugar deserto", doing: "Fique ali em oração", people: false, review: null,
    cuts: [whole(1, 35)] },
  { id: "mc-1-36-todos-te-procuram", place: "encontro", action: null,
    objective: "Vá ao encontro dos que o seguiram", doing: "Vá ao encontro dos que o seguiram", people: true, review: null,
    cuts: [whole(1, 36), whole(1, 37)] },
  { id: "mc-1-38-aldeias-vizinhas", place: "encontro", action: "Responder",
    objective: "Volte para junto dos que o acharam", doing: "Responda aos que o procuravam", people: true, review: null,
    cuts: [{ verse: v(1, 38), from: ": " }] },
  { id: "mc-1-39-por-toda-a-galileia", place: "caminho-das-aldeias", action: null,
    objective: "Siga para as aldeias vizinhas", doing: "Siga para as aldeias vizinhas", people: true, review: "cura",
    cuts: [whole(1, 39)] },
  { id: "mc-1-40-leproso", place: "caminho", action: "Estender a mão",
    objective: "Siga pelo caminho de volta", doing: "Estenda a mão ao leproso que se ajoelha", people: true, review: "cura",
    cuts: [whole(1, 40), { verse: v(1, 41), from: "Jesus , " }, whole(1, 42)] },
  { id: "mc-2-1-outra-vez-em-cafarnaum", place: "casa", action: null,
    objective: "Entre outra vez em Cafarnaum e volte à casa", doing: "Entre outra vez em Cafarnaum e volte à casa", people: false, review: null,
    cuts: [whole(2, 1)] },
  { id: "mc-2-2-falava-a-palavra", place: "casa", action: "Falar a palavra",
    objective: "Volte à casa", doing: "Fale a palavra aos que se juntaram", people: true, review: null,
    cuts: [whole(2, 2)] },
  { id: "mc-2-3-paralitico", place: "casa", action: "Falar ao paralítico",
    objective: "Volte à casa", doing: "Fale ao paralítico que baixaram pelo telhado", people: true, review: "cura",
    cuts: [whole(2, 3), whole(2, 4), whole(2, 5), whole(2, 11), whole(2, 12)] },
  { id: "mc-2-13-junto-ao-mar", place: "praia", action: "Ensinar",
    objective: "Saia outra vez para o mar", doing: "Ensine a multidão junto ao mar", people: true, review: null,
    cuts: [whole(2, 13)] },
  { id: "mc-2-14-levi", place: "posto", action: "Chamar",
    objective: "Passe pelo posto de coleta de impostos", doing: "Chame Levi", people: true, review: null,
    cuts: [{ verse: v(2, 14), through: "Segue-me." }, { verse: v(2, 14), from: "Segue-me." }] },
  { id: "mc-2-15-a-mesa", place: "casa-de-levi", action: null,
    objective: "Vá à casa de Levi", doing: "Vá à casa de Levi", people: true, review: null,
    cuts: [{ verse: v(2, 15), until: ";" }] },
  { id: "mc-2-16-os-que-estao-doentes", place: "casa-de-levi", action: "Responder",
    objective: "Volte à casa de Levi", doing: "Responda aos escribas e fariseus", people: true, review: "controvérsia",
    cuts: [whole(2, 16), { verse: v(2, 17), from: ": " }] },
  { id: "mc-3-7-para-o-mar", place: "redes", action: null,
    objective: "Retire-se com os discípulos para o mar", doing: "Retire-se com os discípulos para o mar", people: true, review: null,
    cuts: [{ verse: v(3, 7), until: ";" }] },
  { id: "mc-3-9-barquinho", place: "barco", action: "Pedir o barquinho",
    objective: "Vá até o barco", doing: "Peça que um barquinho fique por perto", people: true, review: null,
    cuts: [whole(3, 9)] },
  { id: "mc-3-13-subiu-ao-monte", place: "monte", action: null,
    objective: "Suba ao monte", doing: "Suba ao monte", people: false, review: null,
    cuts: [{ verse: v(3, 13), until: "," }] },
  { id: "mc-3-13-os-doze", place: "monte", action: "Chamar",
    objective: "Volte ao alto do monte", doing: "Chame os doze", people: true, review: null,
    cuts: [{ verse: v(3, 13), from: ", " }, { verse: v(3, 14), until: ",\\n" }, { verse: v(3, 16), until: ";" }, { verse: v(3, 17), until: ";\\n" },
      whole(3, 18), whole(3, 19)] },
  { id: "mc-4-1-junto-ao-mar", place: "barco", action: "Ensinar",
    objective: "Volte à margem, junto ao barco", doing: "Ensine outra vez junto ao mar", people: true, review: null,
    cuts: [{ verse: v(4, 1), until: ";" }] },
  { id: "mc-4-35-o-outro-lado", place: "barco", action: "Falar aos discípulos",
    objective: "Ao entardecer, volte ao barco", doing: "Fale aos discípulos", people: true, review: null,
    cuts: [whole(4, 35)] },
];

/** The verses a step is told by: the ones it quotes, once each, in the order it quotes them. The game's Bible
 * shows them whole; what is on screen is a part of them. */
export function stepVerses(def: Pick<StoryStepDef, "cuts">): string[] {
  return [...new Set(def.cuts.map((c) => c.verse))];
}

const parseKey = (key: string) => { const m = /^[^.]+\.(\d+)\.(\d+)$/.exec(key); return m ? { chapter: Number(m[1]), verse: Number(m[2]) } : null; };

/** "Mark.2.14" with the book's name -> "Marcos 2:14"; null when the key is malformed. */
export function storyRef(book: string, key: string): string | null {
  const k = parseKey(key);
  return k && book ? `${book} ${k.chapter}:${k.verse}` : null;
}

/** The reference of a step's verses: "Marcos 1:35" for one verse, "Marcos 1:30–31" for a run, and
 * "Marcos 2:3–5, 11–12" when the step leaves verses out between the ones it quotes. Null when a key is malformed,
 * when the verses are not in rising order or when they are not all of one chapter. */
export function stepRef(book: string, def: Pick<StoryStepDef, "cuts">): string | null {
  const keys = stepVerses(def).map(parseKey);
  if (!book || !keys.length || keys.some((k) => !k)) return null;
  const all = keys as { chapter: number; verse: number }[], runs: [number, number][] = [];
  for (const k of all) {
    if (k.chapter !== all[0].chapter) return null;
    const last = runs[runs.length - 1];
    if (last && k.verse <= last[1]) return null;
    if (last && k.verse === last[1] + 1) last[1] = k.verse; else runs.push([k.verse, k.verse]);
  }
  return `${book} ${all[0].chapter}:${runs.map(([a, b]) => (a === b ? `${a}` : `${a}–${b}`)).join(", ")}`;
}

/** One clause, cut out of its verse as the cut says; null when the verse is missing or a marker is not in it. A
 * marker ending in "\\n" must be the verse's very end (the clause is the verse without that last mark). */
export function cutClause(verses: Readonly<Record<string, string>>, cut: Cut): string | null {
  const text = verses[cut.verse];
  if (!text) return null;
  let start = 0, end = text.length;
  if (cut.from !== undefined) { const i = text.indexOf(cut.from); if (i < 0) return null; start = i + cut.from.length; }
  const mark = cut.until ?? cut.through;
  if (mark !== undefined) {
    const last = mark.endsWith("\\n"), m = last ? mark.slice(0, -2) : mark;
    const i = last ? (text.endsWith(m) ? text.length - m.length : -1) : text.indexOf(m, start);
    if (i < start) return null;
    end = cut.through !== undefined ? i + m.length : i;
  }
  const clause = text.slice(start, end).trim();
  return clause ? clause : null;
}

/** A step's lines, each with its verse's reference; null when any of them cannot be cut (then the step is not offered:
 * nothing typed stands in for a clause). */
export function stepLines(def: StoryStepDef, verses: Readonly<Record<string, string>>, book: string): Fala[] | null {
  const out: Fala[] = [];
  for (const cut of def.cuts) {
    const texto = cutClause(verses, cut), ref = storyRef(book, cut.verse);
    if (!texto || !ref) return null;
    out.push({ texto, ref });
  }
  return out.length ? out : null;
}
