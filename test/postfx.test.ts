import test from "node:test";
import assert from "node:assert/strict";
import { parseAo, parseFx } from "../src/postfx.ts";

test("post-processing flags: anything unknown keeps the direct render and the shipped occlusion", () => {
  assert.equal(parseFx(null), "off"); assert.equal(parseFx("alto"), "alto"); assert.equal(parseFx("master"), "master");
  assert.equal(parseFx("ALTO"), "off"); assert.equal(parseFx("ultra"), "off");
  assert.equal(parseAo(null), "final"); assert.equal(parseAo("indireta"), "indireta");
  assert.equal(parseAo("indirect"), "final"); assert.equal(parseAo(""), "final");
});
