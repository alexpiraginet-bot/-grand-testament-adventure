// The standard same-scene set, in one command that behaves the same in PowerShell, cmd and bash: the environment is
// set here in Node, not with shell syntax.   npm run bench:all [-- <url>]
// Runs tools/bench.mjs for a desktop window and for an emulated phone viewport (labelled as such: it is NOT a phone),
// each with fx=off and fx=alto. fx=master is left out on purpose: it is blocked (docs/GRAFICO-MASTER.md).
// Pass-through: PLAYWRIGHT_CHANNEL (use "chrome" on the RTX PC), BENCH_REFRESH_HZ, BENCH_UNCAPPED, BENCH_WARM, BENCH_NET.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const url = process.argv[2] ?? "http://localhost:4173/";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const bench = fileURLToPath(new URL("./bench.mjs", import.meta.url));
const SETS = [
  { name: "pc", env: { BENCH_VIEWPORT: "1280x800", BENCH_DPR: "1", BENCH_TOUCH: "0" } },
  { name: "movel-emulado", env: { BENCH_VIEWPORT: "390x844", BENCH_DPR: "3", BENCH_TOUCH: "1" } },
];
let failed = 0;
for (const set of SETS) {
  const out = `shots/bench-all/${stamp}/${set.name}`;
  console.log(`\n== ${set.name} -> ${out}`);
  const r = spawnSync(process.execPath, [bench, url, out, "fx=off", "fx=alto"], { stdio: "inherit", env: { ...process.env, ...set.env } });
  if (r.status !== 0) { failed++; console.error(`${set.name}: tools/bench.mjs exited with ${r.status}`); }
}
console.log(`\nRelatórios em shots/bench-all/${stamp}/ . Compare dois com: node tools/compare_bench.mjs <a/bench.json> <b/bench.json>`);
process.exit(failed ? 1 : 0);
