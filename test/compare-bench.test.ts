import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BenchRun, frameStats, type FrameStats, type ShotResult } from "../src/bench.ts";

// tools/*.mjs carry no types, so the tool is loaded by URL and given the shape this test relies on
type Pair = { a: number | null; b: number | null; ratio: number | null };
type Delta = { a: number | null; b: number | null; diff: number | null };
type Row = { name: string; route: boolean; p50: Pair; p95: Pair; gpuP95: Pair; cpuP95: Pair; calls: Delta; triangles: Delta };
type Opts = { allowUnstamped?: boolean; allowDirty?: boolean; acrossCommits?: boolean; variant?: string; variantB?: string };
type Tool = {
  checkComparable(a: unknown, b: unknown, opts?: Opts): string[];
  parseSha(s: unknown): { sha: string; dirty: boolean } | null;
  pickVariants(a: unknown, b: unknown, opts?: Opts): { variantA: string; variantB: string; reasons: string[] };
  compareRuns(a: unknown, b: unknown): Row[];
  markdownTable(rows: Row[]): string;
  picturePairs(a: unknown, b: unknown, variantA: string, variantB: string): { shot: string; a: string; b: string; out: string }[];
};
const TOOL = new URL("../tools/compare_bench.mjs", import.meta.url);
const tool = (await import(TOOL.href)) as Tool;

// a run's extra fields (gpu as a name or as a timing block, build, ...) are whatever a test writes into them
type Run = { shots: ShotResult[]; all: FrameStats; [k: string]: unknown };
type Report = { viewport: number[]; dpr: number; touch: boolean; channel: string; warmup: number; frames: number; runs: Record<string, Run>;
  build?: { sha: string }; gpu?: string; [k: string]: unknown };

const WARMUP = 2, FRAMES = 6;
const NAMES = ["vila", "viela", "margem", "pescadores"];
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** A run as the page reports it: the real BenchRun fed ms(shot, frame) and the counters, then main.ts's own fields. */
function run(names: string[], ms: (shot: number, frame: number) => number, calls: (shot: number) => number): Run {
  const bench = new BenchRun(names.map((name) => ({ name, eye: [0, 2, 0], target: [0, 1, -10] })), WARMUP, FRAMES);
  for (let n = 0; !bench.done; n++) {
    const i = names.indexOf(bench.shot?.name ?? "");
    bench.record(ms(i, n), calls(i), calls(i) * 997);
  }
  return { ...bench.results(), fx: "off", backend: "WebGPU", quality: "alto", loadMs: 4000, viewport: [1280, 800], pixelRatio: 1,
    textureBytes: 64e6, resources: { count: 40, transferBytes: 30e6, decodedBytes: 90e6 }, errors: [] };
}

/** A bench.json as tools/bench.mjs writes it (through JSON, so NaN turns into null), stamped with commit and GPU. */
function report(runs: Record<string, Run>): Report {
  return clone({ url: "http://localhost:4173/", viewport: [1280, 800], dpr: 1, touch: false, warmup: WARMUP, frames: FRAMES,
    channel: "chrome", when: "2026-11-13T12:00:00.000Z", build: { sha: "2e3211c" }, gpu: "synthetic adapter", runs });
}

const A = report({ "fx=off": run(NAMES, (i, n) => 12 + i + (n % 4), (i) => 50 + i) });
const B = report({ "fx=master": run(NAMES, (i, n) => 2 * (12 + i) + (n % 3), (i) => 61 + 2 * i) });

test("refuses a pair measured in another window, browser, build or GPU, whatever --allow-unstamped says", () => {
  assert.deepEqual(tool.checkComparable(A, B), []);
  const changes: [string, (r: Report) => void][] = [
    ["viewport", (r) => { r.viewport = [390, 844]; }],
    ["dpr", (r) => { r.dpr = 2; }],
    ["channel", (r) => { r.channel = "playwright-chromium"; }],
    ["touch", (r) => { r.touch = true; }],
    ["build.sha", (r) => { r.build = { sha: "4d7cf86" }; }],
    ["gpu", (r) => { r.gpu = "another adapter"; }],
  ];
  for (const [field, change] of changes) {
    const b = clone(B);
    change(b);
    const reasons = tool.checkComparable(A, b);
    assert.equal(reasons.length, 1, `${field}: ${reasons.join("; ")}`);
    assert.ok(reasons[0].startsWith(`${field} differs`), reasons[0]);
    assert.deepEqual(tool.checkComparable(A, b, { allowUnstamped: true }), reasons, `${field}: the flag only waives a missing stamp`);
  }
  const long = clone(B);
  long.build = { sha: "2e3211c0d7a1f6b9e8c5a4b3c2d1e0f9a8b7c6d5" };
  assert.deepEqual(tool.checkComparable(A, long), [], "a short and a long form of the same commit match");
});

test("refuses a report from before the build stamp unless --allow-unstamped", () => {
  const old = clone(B);
  delete old.build; delete old.gpu;
  const reasons = tool.checkComparable(A, old);
  assert.equal(reasons.length, 1);
  assert.match(reasons[0], /^B has no usable build\.sha \(missing or "desconhecido"\): the report predates the build stamp/);
  assert.match(tool.checkComparable(old, A)[0], /^A has no usable build\.sha/);
  assert.equal(tool.checkComparable(old, old).length, 2, "each side is named");
  assert.deepEqual(tool.checkComparable(A, old, { allowUnstamped: true }), []);
  assert.deepEqual(tool.checkComparable(old, old, { allowUnstamped: true }), []);

  const noGpu = clone(B);
  delete noGpu.gpu;
  assert.match(tool.checkComparable(A, noGpu)[0], /^B has no GPU name: the browser did not expose it/);
  const timingOnly = clone(noGpu);
  timingOnly.runs["fx=master"].gpu = frameStats([3, 4, 5]);
  assert.match(tool.checkComparable(A, timingOnly)[0], /^B has no GPU name/, "a GPU timing block is not the GPU's name");

  const inRun = clone(old);
  Object.assign(inRun.runs["fx=master"], { build: { sha: "2e3211c" }, gpu: "synthetic adapter" });
  assert.deepEqual(tool.checkComparable(A, inRun), [], "the stamp may be written per run");
  inRun.runs["fx=master"].gpu = "another adapter";
  assert.match(tool.checkComparable(A, inRun)[0], /^gpu differs/);
});

test("refuses a missing variant or a pair without a shot in common", () => {
  assert.match(tool.checkComparable(A, B, { variant: "fx=alto" })[0], /^A has no run "fx=alto" \(runs: fx=off\)/);
  assert.match(tool.checkComparable(A, B, { variantB: "fx=alto" })[0], /^B has no run "fx=alto" \(runs: fx=master\)/);
  assert.match(tool.checkComparable({}, B)[0], /^A has no runs/);
  const other = report({ "fx=master": run(["barco", "panorama"], () => 16, () => 40) });
  assert.deepEqual(tool.checkComparable(A, other), ['no shot in common between A "fx=off" and B "fx=master"']);
  const both = report({ ...A.runs, ...B.runs });
  assert.deepEqual(tool.pickVariants(both, both, { variant: "fx=off", variantB: "fx=master" }),
    { variantA: "fx=off", variantB: "fx=master", reasons: [] }, "one file holds both variants");
  assert.deepEqual(tool.pickVariants(A, B), { variantA: "fx=off", variantB: "fx=master", reasons: [] }, "defaults: first run of each");
});

test("a valid pair gives one row per shot and one for the whole route, with B/A ratios and count differences", () => {
  const ra = A.runs["fx=off"], rb = B.runs["fx=master"];
  const rows = tool.compareRuns(ra, rb);
  assert.deepEqual(rows.map((r) => [r.name, r.route]), [...NAMES.map((n) => [n, false]), ["all", true]]);
  ra.shots.forEach((s, k) => {
    const t = rb.shots[k], r = rows[k];
    assert.deepEqual(r.p50, { a: s.stats.p50Ms, b: t.stats.p50Ms, ratio: t.stats.p50Ms / s.stats.p50Ms }, s.name);
    assert.deepEqual(r.p95, { a: s.stats.p95Ms, b: t.stats.p95Ms, ratio: t.stats.p95Ms / s.stats.p95Ms }, s.name);
    assert.deepEqual(r.calls, { a: s.calls, b: t.calls, diff: t.calls - s.calls }, s.name);
    assert.deepEqual(r.triangles, { a: s.triangles, b: t.triangles, diff: t.triangles - s.triangles }, s.name);
    assert.deepEqual(r.gpuP95, { a: null, b: null, ratio: null }, "no GPU timing in these reports");
  });
  const all = rows[rows.length - 1];
  assert.deepEqual(all.p95, { a: ra.all.p95Ms, b: rb.all.p95Ms, ratio: rb.all.p95Ms / ra.all.p95Ms });
  assert.deepEqual(all.calls, { a: Math.max(...ra.shots.map((s) => s.calls)), b: Math.max(...rb.shots.map((s) => s.calls)),
    diff: Math.max(...rb.shots.map((s) => s.calls)) - Math.max(...ra.shots.map((s) => s.calls)) }, "the busiest shot, as bench.mjs prints");
  assert.ok(rows.every((r) => (r.p95.ratio ?? 0) > 1), "B is the slower one by construction");

  const md = tool.markdownTable(rows).split("\n");
  assert.equal(md.length, rows.length + 2, "header, separator and one line per row");
  assert.ok(md[2].startsWith(`| ${NAMES[0]} | ${ra.shots[0].stats.p50Ms.toFixed(2)} → ${rb.shots[0].stats.p50Ms.toFixed(2)} |`), md[2]);
  assert.ok(md[2].includes(`| ${(rows[0].p95.ratio ?? NaN).toFixed(2)} |`) && md[2].includes(`| +${rows[0].calls.diff} |`), md[2]);
  assert.ok(md[md.length - 1].startsWith("| **all** (route) |"));
});

test("shots are matched by name, not by position", () => {
  const ra = A.runs["fx=off"], rb = clone(B.runs["fx=master"]);
  const inOrder = tool.compareRuns(ra, rb).filter((r) => !r.route);
  const extra = run(["extra"], () => 30, () => 99).shots[0];
  rb.shots = [extra, ...rb.shots.filter((s) => s.name !== NAMES[1]).reverse()];
  const rows = tool.compareRuns(ra, rb).filter((r) => !r.route);
  assert.deepEqual(rows.map((r) => r.name), NAMES.filter((n) => n !== NAMES[1]), "A's order, only shared shots");
  assert.deepEqual(rows, inOrder.filter((r) => r.name !== NAMES[1]), "each row still pairs the same shots");

  // pictures keep each run's own place in the route: NN-<shot>-<tag>.png as tools/bench.mjs names them
  const nn = (i: number) => String(i + 1).padStart(2, "0"), tag = (v: string) => v.replace(/[^a-z0-9]+/gi, "-");
  const pics = tool.picturePairs(ra, rb, "fx=off", "fx=master");
  assert.deepEqual(pics, rows.map((r) => {
    const ia = ra.shots.findIndex((s) => s.name === r.name), ib = rb.shots.findIndex((s) => s.name === r.name);
    return { shot: r.name, a: `${nn(ia)}-${r.name}-${tag("fx=off")}.png`, b: `${nn(ib)}-${r.name}-${tag("fx=master")}.png`,
      out: `${nn(ia)}-${r.name}-${tag("fx=off")}-vs-${tag("fx=master")}.png` };
  }));
  const odd = clone(ra), oddB = clone(rb);
  odd.shots[0].name = oddB.shots[1].name = "../escape";
  assert.ok(tool.compareRuns(odd, oddB).some((r) => r.name === "../escape"), "still compared");
  assert.ok(tool.picturePairs(odd, oddB, "a", "b").every((p) => p.shot !== "../escape"), "but never turned into a path");
});

test("GPU and CPU times are compared where measured and print n/d where null or absent", () => {
  const a = clone(A), b = clone(B);
  const [sa, sb] = [a.runs["fx=off"].shots, b.runs["fx=master"].shots];
  const gpuA0 = frameStats([3, 4, 6, 9]), cpuA0 = frameStats([2, 2, 3, 5]), cpuB0 = frameStats([2, 3, 4, 8]), gpuB1 = frameStats([5, 7]);
  const routeA = frameStats([3, 4, 6, 9, 5]);
  Object.assign(sa[0], { gpu: gpuA0, cpu: cpuA0 });
  Object.assign(sb[0], { gpu: null, cpu: cpuB0 });                          // B's backend could not time the GPU
  Object.assign(sb[1], { gpu: gpuB1 });                                     // A's shot 1 has no gpu field at all
  a.runs["fx=off"].gpu = routeA;
  b.runs["fx=master"].gpu = null;
  const rows = tool.compareRuns(a.runs["fx=off"], b.runs["fx=master"]);
  assert.deepEqual(rows[0].gpuP95, { a: gpuA0.p95Ms, b: null, ratio: null });
  assert.deepEqual(rows[0].cpuP95, { a: cpuA0.p95Ms, b: cpuB0.p95Ms, ratio: cpuB0.p95Ms / cpuA0.p95Ms });
  assert.deepEqual(rows[1].gpuP95, { a: null, b: gpuB1.p95Ms, ratio: null });
  assert.deepEqual(rows[1].cpuP95, { a: null, b: null, ratio: null });
  assert.deepEqual(rows[rows.length - 1].gpuP95, { a: routeA.p95Ms, b: null, ratio: null }, "the route's own timing");
  const md = tool.markdownTable(rows).split("\n");
  assert.ok(md[2].includes(`| ${gpuA0.p95Ms.toFixed(2)} → n/d | n/d |`), md[2]);
  assert.ok(md[2].includes(`| ${cpuA0.p95Ms.toFixed(2)} → ${cpuB0.p95Ms.toFixed(2)} | ${(cpuB0.p95Ms / cpuA0.p95Ms).toFixed(2)} |`), md[2]);
  assert.ok(md[3].includes(`| n/d → ${gpuB1.p95Ms.toFixed(2)} | n/d |`), md[3]);
});

test("the command prints the table for a valid pair and exits non-zero on refusal or bad usage", () => {
  const dir = mkdtempSync(join(tmpdir(), "compare-bench-"));
  try {
    const write = (name: string, r: unknown) => { const f = join(dir, name); writeFileSync(f, JSON.stringify(r)); return f; };
    const fa = write("a.json", A), fb = write("b.json", B), bad = clone(B);
    bad.dpr = 2;
    const fbad = write("bad.json", bad);
    const cli = (...args: string[]) => spawnSync(process.execPath, [fileURLToPath(TOOL), ...args], { encoding: "utf8" });

    const ok = cli(fa, fb);
    assert.equal(ok.status, 0, ok.stderr);
    assert.ok(ok.stdout.includes("## Bench: A fx=off vs B fx=master"), ok.stdout);
    for (const n of NAMES) assert.ok(ok.stdout.includes(`| ${n} |`), n);
    assert.ok(ok.stdout.includes("| **all** (route) |"));

    const refused = cli(fa, fbad);
    assert.equal(refused.status, 1);
    assert.equal(refused.stdout, "", "no table for a refused pair");
    assert.match(refused.stderr, /- dpr differs: A 1, B 2/);

    assert.equal(cli(fa).status, 2, "two files are required");
    assert.equal(cli(fa, fb, "--nope").status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the stamp is read strictly: a dirty tree, an unknown commit and two different commits are each refused by default", () => {
  // literal stamps as vite.config.ts writes them
  assert.deepEqual(tool.parseSha("2e3211cc25fd92599d715bef7c5bb8d16684821a"), { sha: "2e3211cc25fd92599d715bef7c5bb8d16684821a", dirty: false });
  assert.deepEqual(tool.parseSha("2E3211C+alterado"), { sha: "2e3211c", dirty: true });
  assert.equal(tool.parseSha("desconhecido"), null);
  assert.equal(tool.parseSha("2e3211"), null, "fewer than 7 hex digits is not a commit");
  assert.equal(tool.parseSha("not-a-sha"), null);

  const withSha = (sha: string) => { const r = clone(B); r.build = { ...(r.build ?? {}), sha }; return r; };
  const base = withSha("2e3211cc25fd92599d715bef7c5bb8d16684821a"), A2 = clone(A);
  A2.build = { ...(A2.build ?? {}), sha: "2e3211c" };
  assert.deepEqual(tool.checkComparable(A2, base), [], "short and long form of one commit");

  const dirty = withSha("2e3211cc25fd92599d715bef7c5bb8d16684821a+alterado");
  assert.match(tool.checkComparable(A2, dirty).join("\n"), /B was built from uncommitted changes \(\+alterado\)/);
  assert.deepEqual(tool.checkComparable(A2, dirty, { allowDirty: true }), []);

  const unknown = withSha("desconhecido");
  assert.match(tool.checkComparable(A2, unknown).join("\n"), /B has no usable build\.sha/, "desconhecido is no stamp, not a match");
  assert.match(tool.checkComparable(unknown, unknown).join("\n"), /A has no usable build\.sha/);

  const other = withSha("0c83cad2fde6ca83ed0faf6cf967d1cd84d8fe3b");
  assert.match(tool.checkComparable(A2, other).join("\n"), /build\.sha differs: A 2e3211c, B 0c83cad/);
  assert.deepEqual(tool.checkComparable(A2, other, { acrossCommits: true }), []);
  assert.equal(tool.parseSha("2e3211c")!.sha.startsWith("0c83cad"), false);
});
