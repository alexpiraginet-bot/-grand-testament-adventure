// The missions' table for editorial review is generated: it can never say something the game does not run.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-expect-error a plain .mjs tool with no declaration file
import { render } from "../tools/build_story_table.mjs";

test("docs/JORNADA-R16-MISSOES.md is what the code and the data give", () => {
  const text: string = render();
  assert.equal(readFileSync(new URL("../docs/JORNADA-R16-MISSOES.md", import.meta.url), "utf8"), text, "run node tools/build_story_table.mjs");
  assert.equal(text.split("\n").filter((l) => /^\| \d+ \| `mc-/.test(l)).length, 20, "twenty rows");
  assert.equal(text.split("\n").filter((l) => /^\| `[a-z-]+` \| /.test(l)).length, 12, "twelve places");
});
