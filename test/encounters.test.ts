// An encounter's stages (src/encounters.ts): the plan's table walked from end to end, the presses that must do
// nothing, cancelling before and after a gesture's contact, and what a reload finds at each saved fact.
import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, fresh, NET_LABELS, offers, restore, stableStage, STABLE_ORDER, tick, validGestures, type Encounter, type Gestures } from "../src/encounters.ts";

// a picking gesture of 1.2 s whose hands close at 0.8 s; a placing gesture of 1 s that lets go at 0.6 s
const G: Gestures = { pick: { length: 1.2, contact: 0.8 }, place: { length: 1, contact: 0.6 } };
const at = (e: Encounter) => `${e.stage}/${e.object}`;

test("the plan's first encounter, from the request to the thanks", () => {
  let e = fresh("rede-fora-do-lugar");
  assert.equal(at(e), "available/origin");
  let r = apply(e, { type: "talk" }); e = r.next;
  assert.equal(at(e), "talking/origin"); assert.deepEqual(r.effects, []);
  r = apply(e, { type: "accept" }); e = r.next;
  assert.equal(at(e), "accepted/origin"); assert.deepEqual(r.effects, [{ type: "save", stage: "accepted" }]);
  r = apply(e, { type: "pick" }); e = r.next;
  assert.equal(at(e), "picking/origin", "starting the gesture moves nothing");
  r = tick(e, 0.5, G); e = r.next;
  assert.equal(at(e), "picking/origin"); assert.deepEqual(r.effects, []);
  r = tick(e, 0.3, G); e = r.next;                                        // 0.8 s: the contact
  assert.equal(at(e), "picking/hands"); assert.deepEqual(r.effects, [{ type: "object", at: "hands" }]);
  r = tick(e, 0.4, G); e = r.next;                                        // 1.2 s: the gesture ends
  assert.equal(at(e), "carrying/hands"); assert.deepEqual(r.effects, []);
  r = apply(e, { type: "place" }, { atSupport: false });
  assert.equal(r.next, e, "nowhere valid to put it: nothing changes"); assert.deepEqual(r.effects, [{ type: "refused", why: "sem-apoio" }]);
  r = apply(e, { type: "place" }, { atSupport: true }); e = r.next;
  assert.equal(at(e), "placing/hands");
  r = tick(e, 0.6, G); e = r.next;                                        // lets go
  assert.equal(at(e), "placing/destination"); assert.deepEqual(r.effects, [{ type: "object", at: "destination" }]);
  r = tick(e, 0.4, G); e = r.next;
  assert.equal(at(e), "resolved/destination"); assert.equal(e.thanked, false);
  assert.deepEqual(r.effects, [{ type: "save", stage: "returned" }]);
  r = apply(e, { type: "thank" }); e = r.next;
  assert.equal(e.thanked, true); assert.deepEqual(r.effects, [{ type: "save", stage: "completed" }]);
});

test("he may decline, and come back to it", () => {
  let e = apply(fresh("x"), { type: "talk" }).next;
  e = apply(e, { type: "decline" }).next;
  assert.equal(at(e), "available/origin");
  assert.equal(apply(e, { type: "talk" }).next.stage, "talking");
});

test("a press that does not apply does nothing: no change, no effect, twice as once", () => {
  const stages: Encounter[] = [fresh("x"), restore("x", "accepted"), { ...restore("x", "accepted"), stage: "carrying", object: "hands" }, restore("x", "returned"), restore("x", "completed")];
  const none: [Encounter, Parameters<typeof apply>[1]["type"]][] = [
    [stages[0], "accept"], [stages[0], "pick"], [stages[0], "place"], [stages[0], "thank"], [stages[0], "cancel"], [stages[0], "decline"],
    [stages[1], "talk"], [stages[1], "accept"], [stages[1], "place"], [stages[1], "thank"],
    [stages[2], "talk"], [stages[2], "accept"], [stages[2], "thank"], [stages[2], "cancel"],
    [stages[3], "talk"], [stages[3], "accept"], [stages[3], "pick"], [stages[3], "place"],
    [stages[4], "thank"], [stages[4], "talk"], [stages[4], "pick"],
  ];
  for (const [e, type] of none) {
    const r = apply(e, { type } as Parameters<typeof apply>[1], { atSupport: true });
    assert.equal(r.next, e, `${type} at ${e.stage}`); assert.deepEqual(r.effects, [], `${type} at ${e.stage}`);
  }
  // accepting twice saves once; thanking twice saves once
  const talking = apply(fresh("x"), { type: "talk" }).next, accepted = apply(talking, { type: "accept" }).next;
  assert.deepEqual(apply(accepted, { type: "accept" }).effects, []);
  const thanked = apply(restore("x", "returned"), { type: "thank" }).next;
  assert.deepEqual(apply(thanked, { type: "thank" }).effects, []);
  // picking again while it is already in his hands is refused with a reason, and changes nothing
  const carrying = stages[2], again = apply(carrying, { type: "pick" });
  assert.equal(again.next, carrying); assert.deepEqual(again.effects, [{ type: "refused", why: "ja-em-maos" }]);
});

test("cancelling before the contact moves nothing; after it, the object leaves his hands only by being placed", () => {
  const picking = apply(restore("x", "accepted"), { type: "pick" }).next;
  const early = tick(picking, 0.7, G).next;                               // before 0.8 s
  assert.equal(at(apply(early, { type: "cancel" }).next), "accepted/origin");
  const late = tick(picking, 0.9, G).next;                                // after it: in his hands
  assert.equal(at(late), "picking/hands");
  assert.equal(apply(late, { type: "cancel" }).next, late);
  // and the same when putting it down: before letting go he keeps it, after it he cannot take it back
  const carrying: Encounter = { ...restore("x", "accepted"), stage: "carrying", object: "hands" };
  const placing = apply(carrying, { type: "place" }, { atSupport: true }).next;
  assert.equal(at(apply(tick(placing, 0.5, G).next, { type: "cancel" }).next), "carrying/hands");
  const let_go = tick(placing, 0.7, G).next;
  assert.equal(at(let_go), "placing/destination");
  assert.equal(apply(let_go, { type: "cancel" }).next, let_go);
});

test("time moves only gestures: a long step does contact then end in order, a paused one nothing", () => {
  const picking = apply(restore("x", "accepted"), { type: "pick" }).next;
  const all = tick(picking, 5, G);
  assert.equal(at(all.next), "carrying/hands"); assert.equal(all.next.gesture, 0);
  assert.deepEqual(all.effects, [{ type: "object", at: "hands" }]);
  const placing = apply(all.next, { type: "place" }, { atSupport: true }).next, done = tick(placing, 5, G);
  assert.equal(at(done.next), "resolved/destination");
  assert.deepEqual(done.effects, [{ type: "object", at: "destination" }, { type: "save", stage: "returned" }]);
  for (const dt of [0, -1, Number.NaN]) { const r = tick(picking, dt, G); assert.equal(r.next, picking); assert.deepEqual(r.effects, []); }
  for (const e of [fresh("x"), restore("x", "accepted"), all.next, restore("x", "returned")]) assert.equal(tick(e, 1, G).next, e, `no gesture at ${e.stage}`);
});

test("a reload finds the last saved fact, never a gesture: carrying comes back as accepted with the object where it was", () => {
  assert.deepEqual(STABLE_ORDER, ["accepted", "returned", "completed"]);
  assert.equal(at(restore("x", null)), "available/origin");
  assert.equal(at(restore("x", "accepted")), "accepted/origin");
  assert.equal(at(restore("x", "returned")), "resolved/destination"); assert.equal(restore("x", "returned").thanked, false);
  assert.equal(restore("x", "completed").thanked, true);
  // every stage maps to the fact that is saved for it, and restoring that fact is stable
  const carrying: Encounter = { ...restore("x", "accepted"), stage: "carrying", object: "hands" };
  const picking = apply(restore("x", "accepted"), { type: "pick" }).next, placing = apply(carrying, { type: "place" }, { atSupport: true }).next;
  const talking = apply(fresh("x"), { type: "talk" }).next;
  const want: [Encounter, ReturnType<typeof stableStage>][] = [[fresh("x"), null], [talking, null], [restore("x", "accepted"), "accepted"], [picking, "accepted"],
    [carrying, "accepted"], [placing, "accepted"], [restore("x", "returned"), "returned"], [restore("x", "completed"), "completed"]];
  for (const [e, stage] of want) {
    assert.equal(stableStage(e), stage, e.stage);
    assert.equal(stableStage(restore("x", stage)), stage, `restore(${stage})`);
  }
  assert.equal(at(restore("x", stableStage(carrying))), "accepted/origin", "nothing duplicated: one object, back at its support");
});

test("gesture timings must be real: a contact inside a gesture that has a length", () => {
  assert.equal(validGestures(G), true);
  assert.equal(validGestures({ ...G, pick: { length: 1, contact: 1 } }), true, "contact at the very end");
  for (const bad of [{ length: 0, contact: 0 }, { length: 1, contact: 0 }, { length: 1, contact: 1.1 }, { length: Number.NaN, contact: 0.5 }, { length: -1, contact: -2 }])
    assert.equal(validGestures({ ...G, pick: bad }), false, JSON.stringify(bad));
});

test("the button's words follow the stage, with the plan's labels for the net", () => {
  assert.deepEqual(NET_LABELS, { talk: "Conversar", pick: "Pegar rede", place: "Deixar a rede" });
  assert.deepEqual(offers(fresh("x"), NET_LABELS), { person: "Conversar", object: null, carrying: null });
  assert.deepEqual(offers(restore("x", "accepted"), NET_LABELS), { person: null, object: "Pegar rede", carrying: null });
  assert.deepEqual(offers({ ...restore("x", "accepted"), stage: "carrying", object: "hands" }, NET_LABELS), { person: null, object: null, carrying: "Deixar a rede" });
  for (const e of [apply(fresh("x"), { type: "talk" }).next, apply(restore("x", "accepted"), { type: "pick" }).next, restore("x", "returned"), restore("x", "completed")])
    assert.deepEqual(offers(e, NET_LABELS), { person: null, object: null, carrying: null }, e.stage);
});
