// Visit counting (src/analytics.ts): off unless the build says so, and only the page's path leaves the browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COUNTS_VISITS, countVisits, visitUrl } from "../src/analytics.ts";

test("only the path of the address is sent: the query string and the hash are cut", () => {
  assert.equal(visitUrl("https://jogo.example/"), "https://jogo.example/");
  assert.equal(visitUrl("https://jogo.example/?debug=1&nuvem=abc"), "https://jogo.example/");
  assert.equal(visitUrl("https://jogo.example/painel.html?x=1#topo"), "https://jogo.example/painel.html");
  assert.equal(visitUrl("https://jogo.example/#fps"), "https://jogo.example/");
  assert.equal(visitUrl("https://jogo.example/#a?b"), "https://jogo.example/");
  assert.equal(visitUrl("/caminho?q=low"), "/caminho");
  assert.equal(visitUrl(""), "");
});

test("outside Vercel's production build nothing is started", () => {
  assert.equal(COUNTS_VISITS, false, "under node --test there is no Vite and no production build");
  let calls = 0;
  assert.equal(countVisits(false, () => { calls++; }), false);
  assert.equal(countVisits(undefined, () => { calls++; }), false, "the default follows the build");
  assert.equal(calls, 0);
});

test("in the production build the counter starts once, in production mode, with the address cut before it is sent", () => {
  const given: Parameters<Parameters<typeof countVisits>[1] & {}>[0][] = [];
  assert.equal(countVisits(true, (props) => { given.push(props); }), true);
  assert.equal(given.length, 1);
  const props = given[0]!;
  assert.equal(props.mode, "production");
  assert.deepEqual(Object.keys(props).sort(), ["beforeSend", "mode"], "no endpoint, script or debug override");
  assert.deepEqual(props.beforeSend!({ type: "pageview", url: "https://jogo.example/?nuvem=segredo#x" }), { type: "pageview", url: "https://jogo.example/" });
  assert.deepEqual(props.beforeSend!({ type: "event", url: "https://jogo.example/?a=1" }), { type: "event", url: "https://jogo.example/" });
});

test("the build turns counting on only for Vercel's production environment", () => {
  const config = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
  assert.match(config, /__COUNT_VISITS__: JSON\.stringify\(process\.env\.VERCEL_ENV === "production"\)/);
  const panel = readFileSync(new URL("../vite.painel.config.ts", import.meta.url), "utf8");
  assert.equal(/__COUNT_VISITS__/.test(panel), false, "the panel's build defines no counting");
});
