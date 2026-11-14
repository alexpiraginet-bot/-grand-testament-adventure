// A short optional conversation: offered only when a press would open it, one speaker at a time, never over a
// verse, never repeated in a visit, ended by reading, dismissing, walking away or the speaker being gone.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readingTime } from "../src/missions.ts";
import { REACH, candidates, receiver, type Surroundings } from "../src/interactions.ts";
import {
  SPEECH_LABEL, TALK, TALK_LABEL, TOWN_LINES, freshTalk, nextLine, talkPress, talkStep, talkTargets, talkView,
  type Present, type TalkContext, type TalkEffect, type TalkState,
} from "../src/conversations.ts";

const simao: Present = { id: "simao", nome: "Simão", pos: { x: 0, z: -2 }, height: 0 };
const hero = { pos: { x: 0, z: 0 }, heading: 0, height: 0 };                 // looking north, at Simão 2 m away
const open: Surroundings = { clearLine: () => true, deepWater: () => false };
const before: TalkContext = { scripture: false, taught: false }, after: TalkContext = { scripture: false, taught: true };
const places = { "patio-ensino": { x: -39, z: 85 }, "casa-marcos-1-29": { x: -10, z: 242 } };
const DT = 0.05;
const run = (s: TalkState, seconds: number, ctx = before, people: readonly Present[] = [simao], at = hero.pos) => {
  const effects: TalkEffect[] = [];
  for (let t = 0; t < seconds; t += DT) { const r = talkStep(s, TOWN_LINES, people, at, DT, ctx); s = r.next; effects.push(...r.effects); }
  return { s, effects };
};

test("the lines are the game's own, labelled as such, and none is put in Jesus's mouth or passed off as a verse", () => {
  assert.equal(SPEECH_LABEL, "Narrativa do jogo");
  assert.ok(TOWN_LINES.length >= 2);
  const ids = new Set(TOWN_LINES.map((l) => l.id));
  assert.equal(ids.size, TOWN_LINES.length);
  for (const l of TOWN_LINES) {
    assert.notEqual(l.speaker, "heroi"); assert.notEqual(l.speaker, "jesus");
    assert.ok(l.texto.length > 0 && l.texto.length <= 90, "short enough to read while walking");
    assert.ok(!/\d+:\d+/.test(l.texto), "no reference that would make it look like Scripture");
  }
});

test("a person is a target only while a press would open a conversation, and the button's label is theirs", () => {
  let s = freshTalk();
  const targets = talkTargets(TOWN_LINES, [simao], s, before);
  assert.deepEqual(targets.map((t) => [t.id, t.kind, t.label, t.available]), [["conversa:simao", "talk", TALK_LABEL, true]]);
  // interactions.ts decides reach: 2 m is within talking distance, 3 m is not; behind the hero is not
  assert.deepEqual(candidates(targets, hero, open).map((t) => t.id), ["conversa:simao"]);
  assert.deepEqual(candidates(targets, { ...hero, pos: { x: 0, z: REACH.talk + 0.6 - 2 } }, open), []);
  assert.deepEqual(candidates(targets, { ...hero, heading: Math.PI }, open), []);
  // the button says "Conversar" only when nothing with precedence wants it: the mission's prompt comes first
  assert.deepEqual(receiver({ ongoing: null, candidates: candidates(targets, hero, open), chosen: null, mission: null }), { to: "target", id: "conversa:simao", label: "Conversar" });
  assert.deepEqual(receiver({ ongoing: null, candidates: candidates(targets, hero, open), chosen: null, mission: { label: "Ensinar" } }), { to: "mission", label: "Ensinar" });
  // nobody drawn: no target at all. A verse on screen, someone already speaking, the interval, nothing left to say: not offered.
  assert.deepEqual(talkTargets(TOWN_LINES, [], s, before), []);
  assert.equal(talkTargets(TOWN_LINES, [simao], s, { ...before, scripture: true })[0].available, false);
  assert.equal(talkTargets(TOWN_LINES, [{ ...simao, id: "andre", nome: "André" }], s, before)[0].available, false, "someone with no line offers nothing");
  s = talkPress(s, TOWN_LINES, [simao], "conversa:simao", before).next;
  assert.equal(nextLine(TOWN_LINES, "simao", s, after)?.id, "simao-nossa-casa", "he would have another line to say");
  assert.equal(talkTargets(TOWN_LINES, [simao], s, after)[0].available, false, "but one speaker at a time: not offered while he speaks");
});

test("one press opens it, the line stays its reading time, and then he turns to the place he spoke of", () => {
  const pressed = talkPress(freshTalk(), TOWN_LINES, [simao], "conversa:simao", before);
  const line = TOWN_LINES.find((l) => l.id === "simao-caminho-do-patio")!;
  assert.deepEqual(pressed.effects, [{ type: "speech", speaker: "simao", texto: line.texto, label: "Narrativa do jogo" }]);
  let v = talkView(pressed.next, TOWN_LINES, [simao], hero.pos, places);
  assert.deepEqual(v.speech, { nome: "Simão", texto: line.texto, label: "Narrativa do jogo" });
  assert.deepEqual(v.busy, ["simao"]); assert.deepEqual(v.pinned, ["simao"]);
  assert.deepEqual(v.facing, [{ id: "simao", toward: hero.pos }], "he turns to the hero while he speaks");
  assert.deepEqual(v.ongoing, { label: "Dispensar" });
  const total = readingTime(line.texto);
  const during = run(pressed.next, total - 0.2);
  assert.deepEqual(during.effects, []); assert.ok(during.s.open);
  const ended = run(during.s, 0.4);
  assert.deepEqual(ended.effects, [{ type: "closed", why: "lida" }]);
  v = talkView(ended.s, TOWN_LINES, [simao], hero.pos, places);
  assert.equal(v.speech, null); assert.equal(v.ongoing, null);
  assert.deepEqual(v.facing, [{ id: "simao", toward: places["patio-ensino"] }], "the reaction one can see: he looks towards the yard");
  assert.deepEqual(v.busy, ["simao"]);
  const later = run(ended.s, TALK.look + 0.2);
  assert.deepEqual(talkView(later.s, TOWN_LINES, [simao], hero.pos, places).facing, []);
  assert.deepEqual(talkView(later.s, TOWN_LINES, [simao], hero.pos, places).busy, [], "and then he is free again");
  // a place the town does not have is simply not looked at
  assert.deepEqual(talkView(ended.s, TOWN_LINES, [simao], hero.pos, {}).facing, []);
});

test("it can be dismissed, walked away from, cut by a verse or by the speaker being gone, and a pause holds it", () => {
  const opened = () => talkPress(freshTalk(), TOWN_LINES, [simao], "conversa:simao", before).next;
  // pressing again dismisses; a third press does not reopen during the interval
  let r = talkPress(opened(), TOWN_LINES, [simao], null, before);
  assert.deepEqual(r.effects, [{ type: "closed", why: "dispensada" }]);
  assert.equal(talkView(r.next, TOWN_LINES, [simao], hero.pos, places).facing.length, 0, "dismissed: no looking at the place");
  assert.deepEqual(talkPress(r.next, TOWN_LINES, [simao], "conversa:simao", before), { next: r.next, effects: [] });
  // walking away
  assert.deepEqual(run(opened(), 0.2, before, [simao], { x: 0, z: -2 + TALK.leave + 0.1 }).effects, [{ type: "closed", why: "afastou-se" }]);
  assert.deepEqual(run(opened(), 0.2, before, [simao], { x: 0, z: -2 + TALK.leave - 0.1 }).effects, []);
  // a verse comes on screen: the conversation gives way at once, and cannot be opened over it
  assert.deepEqual(run(opened(), 0.1, { ...before, scripture: true }).effects, [{ type: "closed", why: "escritura" }]);
  assert.deepEqual(talkPress(freshTalk(), TOWN_LINES, [simao], "conversa:simao", { ...before, scripture: true }).effects, []);
  // the speaker is no longer drawn (unloaded, failed asset): no voice without a visible person
  assert.deepEqual(run(opened(), 0.1, before, []).effects, [{ type: "closed", why: "ausente" }]);
  assert.deepEqual(talkPress(freshTalk(), TOWN_LINES, [], "conversa:simao", before).effects, [], "and none can be opened with him absent");
  // a press for something that is not a conversation, or for nobody, opens nothing
  assert.deepEqual(talkPress(freshTalk(), TOWN_LINES, [simao], "rede-1", before).effects, []);
  assert.deepEqual(talkPress(freshTalk(), TOWN_LINES, [simao], null, before).effects, []);
  // a pause: the reading time does not run
  const s = opened();
  for (const dt of [0, -1, NaN]) assert.equal(talkStep(s, TOWN_LINES, [simao], hero.pos, dt, before).next, s);
});

test("a line is not repeated in a visit, the interval is kept, and what he says follows where the story is", () => {
  let s = talkPress(freshTalk(), TOWN_LINES, [simao], "conversa:simao", before).next;
  s = run(s, 30).s;
  assert.equal(s.open, null);
  assert.ok(s.quiet > 0 && s.quiet <= TALK.quiet);
  assert.equal(nextLine(TOWN_LINES, "simao", s, before), null, "he has nothing more to say before the teaching");
  s = run(s, TALK.quiet).s;
  assert.equal(s.quiet, 0);
  assert.equal(talkTargets(TOWN_LINES, [simao], s, before)[0].available, false, "said already: not offered again in this visit");
  // after the teaching he has another thing to say, once
  assert.equal(nextLine(TOWN_LINES, "simao", s, after)?.id, "simao-nossa-casa");
  assert.equal(talkTargets(TOWN_LINES, [simao], s, after)[0].available, true);
  const r = talkPress(s, TOWN_LINES, [simao], "conversa:simao", after);
  assert.equal((r.effects[0] as { texto: string }).texto, "Nossa casa fica mais abaixo, no caminho do lago.");
  // the interval holds even though another line exists
  const fresh = talkPress(freshTalk(), TOWN_LINES, [simao], "conversa:simao", before).next;
  const dismissed = talkPress(fresh, TOWN_LINES, [simao], null, before).next;
  assert.equal(talkTargets(TOWN_LINES, [simao], dismissed, after)[0].available, false);
  assert.equal(talkTargets(TOWN_LINES, [simao], run(dismissed, TALK.quiet + 0.1, after).s, after)[0].available, true);
  // a new visit starts with nothing said
  assert.equal(nextLine(TOWN_LINES, "simao", freshTalk(), before)?.id, "simao-caminho-do-patio");
  assert.equal(nextLine(TOWN_LINES, "simao", freshTalk(), after)?.id, "simao-nossa-casa");
});
