// The story's steps (story-steps.ts) in the game's Bible, after the steps teaching-bible.ts already gives it. Each
// step shows, whole and in the BLIVRE's words, the verses it quotes on screen (story-journey.ts), and no other: a
// verse the game does not stage is not listed, so it is never marked as lived. No reading requirement is
// introduced: the Bible guides and never locks.
import { readingOrder, type BibleData, type BibleStep } from "./bible.ts";
import { stepVerses } from "./story-steps.ts";
import type { StoryData, StoryStep } from "./story-journey.ts";
import type { TeachingReading } from "./teaching-bible.ts";

export type StoryReading = TeachingReading & {
  /** The first story step among `steps`; steps.length when the story is not offered, with no extra step. */
  storyIndex: number;
};

/** What the game asks for in a step, as the Bible's "No jogo" line says it. */
export const storyTask = (s: StoryStep): string =>
  s.def.action && s.def.doing !== s.def.objective ? `${s.def.objective}. ${s.def.doing}.` : `${s.def.objective}.`;

/** `base` with the story's steps after it. With no story (its clauses or its places are unavailable) `base` comes
 * back as it is, so the Bible never shows a step the game cannot offer. */
export function storyReading(base: TeachingReading, steps: readonly StoryStep[] | null, d: StoryData, bibleData: BibleData): StoryReading {
  const without: StoryReading = { ...base, storyIndex: base.steps.length };
  if (!steps?.length) return without;
  const added: BibleStep[] = [];
  for (const s of steps) {
    const verses = stepVerses(s.def);
    if (!verses.length || verses.some((k) => !d.versiculos[k])) return without;
    added.push({ kind: "missao", verses, ref: s.ref, objetivo: storyTask(s) });
  }
  const episode = { ...base.episode, versiculos: { ...base.episode.versiculos, ...d.versiculos }, ref_pt: [base.episode.ref_pt, ...d.passagens].join("; ") };
  const order = readingOrder(bibleData, episode);
  // the passage has gaps (what is not staged is not shown as lived): keep the explicit references, as teaching-bible.ts does
  order.entries = order.entries.map((entry) => (entry.kind === "episodio" ? { ...entry, ref: episode.ref_pt } : entry));
  return { steps: [...base.steps, ...added], episode, order, teachingIndex: base.teachingIndex, storyIndex: base.steps.length };
}
