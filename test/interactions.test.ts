// Who receives the action button (src/interactions.ts). Positions are on a small grid worked by hand: the hero at the
// origin looking to -z (heading 0) unless said otherwise.
import { test } from "node:test";
import assert from "node:assert/strict";
import { candidates, headingTo, reach, REACH, REASON_HINT, receiver, switchFocus, type Hero, type Surroundings, type Target } from "../src/interactions.ts";

const open: Surroundings = { clearLine: () => true, deepWater: () => false };
const hero = (x = 0, z = 0, heading = 0, height = 0): Hero => ({ pos: { x, z }, heading, height });
const target = (id: string, x: number, z: number, o: Partial<Target> = {}): Target =>
  ({ id, kind: "act", label: id, anchor: { x, z }, height: 0, available: true, ...o });
const why = (t: Target, h: Hero, around = open) => { const r = reach(t, h, around); return r.ok ? "ok" : r.why; };
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-12, `${a} is not ${b}`);

test("headings are the game's: 0 looks to -z and grows clockwise seen from above", () => {
  near(headingTo({ x: 0, z: 0 }, { x: 0, z: -1 }), 0);
  near(headingTo({ x: 0, z: 0 }, { x: 1, z: 0 }), Math.PI / 2);
  near(headingTo({ x: 0, z: 0 }, { x: -1, z: 0 }), -Math.PI / 2);
  near(Math.abs(headingTo({ x: 0, z: 0 }, { x: 0, z: 1 })), Math.PI);
});

test("a target is used from close, at his level, on dry ground, from its front, in sight and in front of him", () => {
  assert.deepEqual({ act: REACH.act, talk: REACH.talk }, { act: 1.5, talk: 2.5 }, "the plan's starting distances");
  assert.equal(why(target("rede", 0, -1), hero()), "ok");
  assert.equal(why(target("rede", 0, -1.5), hero()), "ok", "at the limit");
  assert.equal(why(target("rede", 0, -1.6), hero()), "longe");
  assert.equal(why(target("p", 0, -2.4, { kind: "talk" }), hero()), "ok", "a conversation reaches farther");
  assert.equal(why(target("p", 0, -2.6, { kind: "talk" }), hero()), "longe");
  assert.equal(why(target("rede", 0, -1, { height: 0.5 }), hero()), "ok");
  assert.equal(why(target("rede", 0, -1, { height: 0.6 }), hero()), "altura");
  assert.equal(why(target("rede", 0, -1), hero(), { ...open, deepWater: () => true }), "agua");
  assert.equal(why(target("rede", 0, -1), hero(), { ...open, clearLine: () => false }), "parede");
  assert.equal(why(target("rede", 0, -1, { available: false }), hero()), "indisponivel");
  // behind him: the target is to the south, he looks north
  assert.equal(why(target("rede", 0, 1), hero()), "de-costas");
  assert.equal(why(target("rede", 1, 0), hero()), "ok", "90° to his right is still in front (the cone is 100°)");
  assert.equal(why(target("rede", 0, 0), hero()), "ok", "standing on the anchor");
});

test("a target with a front is not used from behind it", () => {
  // the anchor at the origin, used from its -z side (from = 0)
  const t = target("rede", 0, 0, { from: 0 });
  assert.equal(why(t, hero(0, -1, Math.PI)), "ok", "north of it, looking south at it");
  assert.equal(why(t, hero(1, 0, -Math.PI / 2)), "ok", "exactly at its side counts as the front");
  assert.equal(why(t, hero(0, 1, 0)), "atras", "south of it, looking north at it");
});

test("the first reason is the nearest one to fix, and each has a short instruction", () => {
  // far, too high, in the water and behind a wall at once: unavailable wins, then distance
  const all: Surroundings = { clearLine: () => false, deepWater: () => true };
  assert.equal(why(target("rede", 0, -3, { height: 2, available: false }), hero(), all), "indisponivel");
  assert.equal(why(target("rede", 0, -3, { height: 2 }), hero(), all), "longe");
  assert.equal(why(target("rede", 0, -1, { height: 2 }), hero(), all), "altura");
  assert.equal(why(target("rede", 0, -1), hero(), all), "agua");
  for (const [k, text] of Object.entries(REASON_HINT)) assert.equal(text === "", k === "indisponivel", `hint for ${k}`);
});

test("candidates: things to do before people to talk to, then the one most in front, then the nearest, then by id", () => {
  const person = target("pescador", 0, -1, { kind: "talk" }), net = target("rede", 1, -1), jar = target("jarro", 0, -1.2);
  const far = target("longe", 0, -9), twin = target("a-gemeo", 0, -1.2);
  assert.deepEqual(candidates([person, net, jar, far], hero(), open).map((t) => t.id), ["jarro", "rede", "pescador"]);
  // the same bearing and distance: the id decides, whatever the order they came in
  assert.deepEqual(candidates([jar, twin], hero(), open).map((t) => t.id), ["a-gemeo", "jarro"]);
  assert.deepEqual(candidates([twin, jar], hero(), open).map((t) => t.id), ["a-gemeo", "jarro"]);
  // straight ahead but farther beats nearer and off to the side
  assert.deepEqual(candidates([target("lado", 0.5, -0.5), target("frente", 0, -1.4)], hero(), open).map((t) => t.id), ["frente", "lado"]);
  assert.deepEqual(candidates([far], hero(), open), []);
});

test("switching focus goes round the candidates and starts over when the choice is gone", () => {
  const list = [target("a", 0, -1), target("b", 0.2, -1), target("c", 0.4, -1)];
  assert.equal(switchFocus(list, null), "a");
  assert.equal(switchFocus(list, "a"), "b");
  assert.equal(switchFocus(list, "c"), "a");
  assert.equal(switchFocus(list, "a", -1), "c");
  assert.equal(switchFocus(list, "sumiu"), "a");
  assert.equal(switchFocus([], "a"), null);
});

test("one receiver per frame: what is under way, then the player's choice, then the mission, then the likeliest", () => {
  const net = target("rede", 0, -1, { label: "Pegar rede" }), person = target("pescador", 0, -1.2, { kind: "talk", label: "Conversar" });
  const list = [net, person], mission = { label: "Chamar" };
  assert.deepEqual(receiver({ ongoing: { label: "Deixar a rede" }, candidates: list, chosen: "pescador", mission }), { to: "ongoing", label: "Deixar a rede" });
  // carrying with nowhere valid to put it down: the button does nothing, it is not handed to something else
  assert.deepEqual(receiver({ ongoing: { label: null }, candidates: list, chosen: "pescador", mission }), { to: "none" });
  assert.deepEqual(receiver({ ongoing: null, candidates: list, chosen: "pescador", mission }), { to: "target", id: "pescador", label: "Conversar" });
  assert.deepEqual(receiver({ ongoing: null, candidates: list, chosen: null, mission }), { to: "mission", label: "Chamar" });
  assert.deepEqual(receiver({ ongoing: null, candidates: list, chosen: "sumiu", mission }), { to: "mission", label: "Chamar" }, "a stale choice does not count");
  assert.deepEqual(receiver({ ongoing: null, candidates: list, chosen: null, mission: null }), { to: "target", id: "rede", label: "Pegar rede" });
  assert.deepEqual(receiver({ ongoing: null, candidates: [], chosen: null, mission: null }), { to: "none" });
});
