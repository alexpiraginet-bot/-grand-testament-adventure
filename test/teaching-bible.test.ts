import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { teachingReading } from '../src/teaching-bible.ts';
import { currentStep, episodeSteps, readingOrder, verseStates, type BibleData } from '../src/bible.ts';
import { goals as makeGoals } from '../src/episode.ts';
import type { EpisodeData } from '../src/missions.ts';
import type { WorldMeta } from '../src/terrain.ts';
import type { TeachingData } from '../src/teaching-journey.ts';

const json = <T>(file: string): T => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
const ep = json<EpisodeData>('src/data/mc-pescadores.json');
const data = json<TeachingData>('src/data/mc-ensino.json');
const bible = json<BibleData>('src/data/biblia-cronologica.json');
const goals = makeGoals(json<WorldMeta>('public/world/cafarnaum.json'));
const base = episodeSteps(ep, goals, 'Volte a Cafarnaum');

test('unavailable layout retains only the original episode and never marks unavailable verses lived', () => {
  const result = teachingReading(ep, goals, 'Cafarnaum', false, bible);
  assert.equal(result.episode, ep);
  assert.deepEqual(result.steps, base);
  assert.deepEqual(result.order, readingOrder(bible, ep));
  assert.equal(result.teachingIndex, result.steps.length);
  const states = verseStates(result.steps, currentStep(result.steps, 'done', 2, 'free'));
  assert.equal(states.get('Mark.1.21'), 'vivido', 'the existing epilogue remains part of the original episode');
  assert.equal(states.has('Mark.1.22'), false);
  assert.equal(states.has('Mark.1.29'), false);
  assert.equal(Object.hasOwn(result.episode.versiculos, 'Mark.1.22'), false);
  assert.equal(Object.hasOwn(result.episode.versiculos, 'Mark.1.29'), false);
});

test('available teaching appends two steps and preserves the BLIVRE source text literally', () => {
  const result = teachingReading(ep, goals, 'Cafarnaum', true, bible);
  assert.equal(result.teachingIndex, base.length);
  assert.equal(result.steps.length, base.length + 2);
  assert.deepEqual(result.steps.slice(0, base.length), base);
  assert.deepEqual(result.steps[base.length].verses, ['Mark.1.21', 'Mark.1.22']);
  assert.deepEqual(result.steps[base.length + 1].verses, ['Mark.1.29']);
  for (const [key, text] of Object.entries(ep.versiculos)) assert.equal(result.episode.versiculos[key], text);
  for (const [key, text] of Object.entries(data.versiculos)) assert.equal(result.episode.versiculos[key], text);
  assert.equal(result.episode.versiculos[data.depois.versiculo], data.depois.texto);
  assert.ok(result.episode.versiculos['Mark.1.22'].includes('temautoridade'), 'preserve the source spelling, without silently rewriting scripture');
  assert.deepEqual(result.episode.missoes, ep.missoes);
});

test('the episode and its reading-order entry name disjoint references, never an invented 1:16–29 range', () => {
  const result = teachingReading(ep, goals, 'Cafarnaum', true, bible);
  const entries = result.order.entries.filter(entry => entry.kind === 'episodio');
  assert.equal(entries.length, 1);
  const expected = 'Marcos 1:16–20; Marcos 1:21–22; Marcos 1:29';
  assert.equal(result.episode.ref_pt, expected);
  assert.equal(entries[0].ref, expected);
  assert.doesNotMatch(entries[0].ref, /1:16[–-]29/);
  for (let n = 23; n <= 28; n++) {
    assert.equal(Object.hasOwn(result.episode.versiculos, `Mark.1.${n}`), false);
    assert.equal(result.steps.some(step => step.verses.includes(`Mark.1.${n}`)), false);
  }
  const original = readingOrder(bible, ep);
  assert.deepEqual(result.order.entries.filter(entry => entry.kind !== 'episodio'), original.entries.filter(entry => entry.kind !== 'episodio'));
  assert.deepEqual(result.order.after, original.after);
});

test('the teaching and onward reading keep distinct current and lived states', () => {
  const result = teachingReading(ep, goals, 'Cafarnaum', true, bible);
  const during = verseStates(result.steps, result.teachingIndex);
  assert.equal(during.get('Mark.1.20'), 'vivido');
  assert.equal(during.get('Mark.1.21'), 'agora');
  assert.equal(during.get('Mark.1.22'), 'agora');
  assert.equal(during.get('Mark.1.29'), 'a-seguir');
  const after = verseStates(result.steps, result.teachingIndex + 1);
  assert.equal(after.get('Mark.1.22'), 'vivido');
  assert.equal(after.get('Mark.1.29'), 'agora', 'an announced next place is not an already completed scene');
  assert.match(result.steps[result.teachingIndex + 1].objetivo, /ainda está em preparação/);
});

test('no home name preserves the original no-epilogue contract and adjusts the teaching index', () => {
  const noHome = episodeSteps(ep, goals, null);
  for (const available of [false, true]) {
    const result = teachingReading(ep, goals, null, available, bible);
    assert.equal(result.teachingIndex, noHome.length);
    assert.deepEqual(result.steps.slice(0, result.teachingIndex), noHome);
    assert.equal(result.steps.some(step => step.kind === 'epilogo'), false);
    assert.equal(result.steps.length, noHome.length + (available ? 2 : 0));
  }
});

test('building optional reading is deterministic and leaves original episode and reading data untouched', () => {
  const before = JSON.stringify({ ep, goals, bible });
  const first = teachingReading(ep, goals, 'Cafarnaum', true, bible);
  const second = teachingReading(ep, goals, 'Cafarnaum', true, bible);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify({ ep, goals, bible }), before);
  const disabledAfter = teachingReading(ep, goals, 'Cafarnaum', false, bible);
  assert.deepEqual(disabledAfter.steps, base, 'a previous enabled call must not contaminate a disabled one');
});
