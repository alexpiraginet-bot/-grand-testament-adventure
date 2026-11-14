// Connect the optional, safely placed teaching step to the Bible without turning
// verses that are absent or unplayable into a continuous, supposedly lived passage.
import teachingData from './data/mc-ensino.json' with { type: 'json' };
import { episodeSteps, readingOrder, type BibleData, type BibleStep } from './bible.ts';
import { epilogueLine } from './freeroam.ts';
import type { EpisodeData, Goal } from './missions.ts';

export interface TeachingReading {
  steps: BibleStep[];
  episode: EpisodeData;
  order: ReturnType<typeof readingOrder>;
  /** First teaching step when available; otherwise steps.length, with no extra step. */
  teachingIndex: number;
}

/** No reading requirement is introduced. The original mission/epilogue steps are
 * unchanged. An unavailable town layout offers only the original passage, so free
 * exploration cannot mark the unavailable teaching or onward destination as lived. */
export function teachingReading(ep: EpisodeData, goals: Goal[], homeName: string | null,
  available: boolean, bibleData: BibleData): TeachingReading {
  const steps = episodeSteps(ep, goals, epilogueLine(ep) && homeName ? `Volte a ${homeName}` : null);
  const teachingIndex = steps.length;
  if (!available) return { steps, episode: ep, order: readingOrder(bibleData, ep), teachingIndex };

  steps.push(
    { kind: 'missao', verses: Object.keys(teachingData.versiculos), ref: teachingData.ref_pt,
      objetivo: 'Vá ao pátio para começar a ensinar.' },
    { kind: 'missao', verses: [teachingData.depois.versiculo], ref: teachingData.depois.ref_pt,
      objetivo: 'Conheça o destino seguinte. Esta cena ainda está em preparação.' },
  );
  const episode: EpisodeData = {
    ...ep,
    versiculos: { ...ep.versiculos, ...teachingData.versiculos, [teachingData.depois.versiculo]: teachingData.depois.texto },
    ref_pt: [ep.ref_pt, teachingData.ref_pt, teachingData.depois.ref_pt].join('; '),
  };
  const order = readingOrder(bibleData, episode);
  // readingOrder normally labels the first-to-last range. This expanded passage
  // deliberately omits Mark 1:23–28: retain the explicit disjoint references.
  order.entries = order.entries.map(entry => entry.kind === 'episodio' ? { ...entry, ref: episode.ref_pt } : entry);
  return { steps, episode, order, teachingIndex };
}
