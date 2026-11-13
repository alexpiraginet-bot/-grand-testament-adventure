// Compares two same-scene bench reports written by tools/bench.mjs, shot by shot, and refuses pairs that cannot compare.
//   node tools/compare_bench.mjs <a.json> <b.json> [--variant <name>] [--variant-b <name>]
//                                [--images <dirA> <dirB> <outDir>] [--allow-unstamped] [--allow-dirty] [--across-commits]
// --variant picks the run of A (and of B, unless --variant-b names another one). By default: A's first run and the run of
// the same name in B, else B's first. One file can be passed twice to compare two of its variants.
// Frame times only mean something on one machine, one build and one window (tools/bench.mjs, docs/PLANO-AAA.md R4), so
// a pair with a different viewport, DPR, browser channel, touch emulation, commit (build.sha) or GPU is refused (exit 1).
// Reports written before the build stamp have neither commit nor GPU: refused too, unless --allow-unstamped. A stamp of
// "desconhecido" (the build could not read git) counts as no stamp. A commit marked "+alterado" (built from a tree with
// uncommitted changes, vite.config.ts) does not identify its code: refused unless --allow-dirty. Two different commits
// (before/after a change) are refused unless --across-commits, which allows them and says so in the notes.
// Prints Markdown. B/A above 1 means B is slower. Shots are matched by name, never by position. GPU and CPU times print
// "n/d" where the backend could not time them. --images writes the A and B pictures of each shot side by side.
// A report may come from someone else's machine (docs/CONSTRUA-CONOSCO.md): its strings are data. They are stripped of
// control characters before printing, and a shot name only becomes part of a file name when it is a plain word.
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const num = (x) => (isNum(x) ? x : null);
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
// a timing block is frameStats-shaped ({p50Ms, p95Ms, ...}), possibly with nulls when the backend could not measure
const timed = (x) => isObj(x) && ("p95Ms" in x || "p95" in x);
const p95Of = (x) => (timed(x) ? num(x.p95Ms ?? x.p95) : null);
const firstTimed = (...xs) => xs.find(timed) ?? null;
const key = (x) => JSON.stringify(x ?? null);
const show = (x) => (Array.isArray(x) ? x.join("x") : x === undefined ? "missing" : String(x));
/** Printable text from report data: no control or bidi-override characters (no terminal escapes, no spoofing). */
export const text = (s) => String(s ?? "").replace(/[\p{Cc}\p{Cf}]/gu, "");

// --- stamp and variants -------------------------------------------------------------------------------------------

// a GPU identity is a string (adapter or WEBGL_debug_renderer_info); an object that is not a timing block also counts
const gpuName = (g) => (typeof g === "string" ? g.trim() || null : isObj(g) && !timed(g) ? JSON.stringify(g) : null);
// A commit as the build stamp writes it: hex, 7 to 40 characters, optionally "+alterado" for an uncommitted tree.
// Anything else ("desconhecido", empty, garbage) is no stamp at all.
const SHA = /^([0-9a-f]{7,40})(\+alterado)?$/;
export const parseSha = (s) => { const m = typeof s === "string" ? SHA.exec(s.trim().toLowerCase()) : null; return m ? { sha: m[1], dirty: !!m[2] } : null; };
// the same commit written short and long still matches; both are plain hex by construction
const sameSha = (x, y) => x === y || x.startsWith(y) || y.startsWith(x);

/** Commit and GPU a report was measured on, read at the top level and else in the chosen run; null when absent. */
export function stampOf(report, variant) {
  const runs = !isObj(report?.runs) ? [] : variant != null && Object.hasOwn(report.runs, variant) ? [report.runs[variant]] : Object.values(report.runs);
  const places = [report, ...runs].filter(isObj);
  const parsed = places.map((p) => parseSha(typeof p.build === "string" ? p.build : p.build?.sha)).find(Boolean) ?? null;
  return { sha: parsed?.sha ?? null, gpu: places.flatMap((p) => [p.gpu, p.build?.gpu]).map(gpuName).find(Boolean) ?? null,
    dirty: !!parsed?.dirty || places.some((p) => p.build?.dirty === true) };
}

/** Which run of A and of B to compare (see the header), with the reasons when one of them does not exist. */
export function pickVariants(a, b, { variant, variantB } = {}) {
  const names = (r) => (isObj(r?.runs) ? Object.keys(r.runs) : []);
  const [na, nb] = [names(a), names(b)];
  const variantA = variant ?? na[0];
  const vb = variantB ?? variant ?? (nb.includes(variantA) ? variantA : nb[0]);
  const reasons = [];
  for (const [side, list, v] of [["A", na, variantA], ["B", nb, vb]]) {
    if (!list.length) reasons.push(`${side} has no runs: not a report from tools/bench.mjs`);
    else if (!list.includes(v)) reasons.push(`${side} has no run "${v}" (runs: ${list.join(", ")})`);
    else if (!Array.isArray((side === "A" ? a : b).runs[v].shots)) reasons.push(`${side} run "${v}" has no shots`);
  }
  return { variantA, variantB: vb, reasons };
}

/**
 * Reasons why A and B cannot be compared; empty when they can. Viewport, DPR, channel and touch must match. Commit and
 * GPU must match when both reports carry them; a report without them predates the build stamp and is refused unless
 * allowUnstamped (which never waives a stamp that is present and differs). The chosen runs must share a shot.
 */
export function checkComparable(a, b, opts = {}) {
  const { variantA, variantB, reasons } = pickVariants(a, b, opts);
  if (reasons.length) return reasons;
  for (const f of ["viewport", "dpr", "channel", "touch"])
    if (key(a[f]) !== key(b[f])) reasons.push(`${f} differs: A ${show(a[f])}, B ${show(b[f])}`);
  const sa = stampOf(a, variantA), sb = stampOf(b, variantB);
  if (sa.sha && sb.sha && !sameSha(sa.sha, sb.sha) && !opts.acrossCommits)
    reasons.push(`build.sha differs: A ${sa.sha}, B ${sb.sha} (pass --across-commits to compare two commits on purpose)`);
  if (!opts.allowDirty) for (const [side, s] of [["A", sa], ["B", sb]])
    if (s.dirty) reasons.push(`${side} was built from uncommitted changes (+alterado): its commit does not identify the code; commit and rerun, or pass --allow-dirty`);
  if (sa.gpu && sb.gpu && sa.gpu !== sb.gpu) reasons.push(`gpu differs: A ${sa.gpu}, B ${sb.gpu}`);
  if (!opts.allowUnstamped) for (const [side, s] of [["A", sa], ["B", sb]]) {
    if (!s.sha) reasons.push(`${side} has no usable build.sha (missing or "desconhecido"): the report predates the build stamp or ` +
      "the build could not read git; rerun tools/bench.mjs on a stamped build, or pass --allow-unstamped");
    else if (!s.gpu) reasons.push(`${side} has no GPU name: the browser did not expose it (masked WebGL or no adapter info), so ` +
      "the machine cannot be checked; pass --allow-unstamped to compare anyway");
  }
  if (!matchShots(a.runs[variantA], b.runs[variantB]).length) reasons.push(`no shot in common between A "${variantA}" and B "${variantB}"`);
  return reasons;
}

// --- rows ---------------------------------------------------------------------------------------------------------

/** Shots of A that B also has, in A's order, matched by name (first occurrence), with their index in each run. */
export function matchShots(runA, runB) {
  const inB = new Map();
  (runB?.shots ?? []).forEach((s, i) => { if (isObj(s) && !inB.has(s.name)) inB.set(s.name, i); });
  const seen = new Set(), out = [];
  (runA?.shots ?? []).forEach((s, i) => {
    if (!isObj(s) || !inB.has(s.name) || seen.has(s.name)) return;
    seen.add(s.name);
    out.push({ name: s.name, ia: i, ib: inB.get(s.name), a: s, b: runB.shots[inB.get(s.name)] });
  });
  return out;
}

const pair = (x, y) => { const a = num(x), b = num(y); return { a, b, ratio: a !== null && b !== null && a > 0 ? b / a : null }; };
const delta = (x, y) => { const a = num(x), b = num(y); return { a, b, diff: a !== null && b !== null ? b - a : null }; };
const row = (name, x, y, route = false) => ({ name, route, p50: pair(x.stats?.p50Ms, y.stats?.p50Ms), p95: pair(x.stats?.p95Ms, y.stats?.p95Ms),
  gpuP95: pair(p95Of(x.gpu), p95Of(y.gpu)), cpuP95: pair(p95Of(x.cpu), p95Of(y.cpu)),
  calls: delta(x.calls, y.calls), triangles: delta(x.triangles, y.triangles) });
// GPU/CPU timings sit beside `stats` in a shot, and beside `all` (or inside it) for the route; absent or null is "n/d"
const shotSide = (s) => ({ stats: s.stats, gpu: firstTimed(s.gpu, s.gpuMs, s.stats?.gpu), cpu: firstTimed(s.cpu, s.cpuMs, s.stats?.cpu),
  calls: s.calls, triangles: s.triangles });
// the route's calls and triangles are its busiest shot's, as tools/bench.mjs prints them
const busiest = (run, k) => { const v = (run.shots ?? []).map((s) => s?.[k]).filter(isNum); return v.length ? Math.max(...v) : null; };
const routeSide = (run) => ({ stats: run.all, gpu: firstTimed(run.allGpu, run.gpu, run.gpuMs, run.all?.gpu),
  cpu: firstTimed(run.allCpu, run.cpu, run.cpuMs, run.all?.cpu), calls: busiest(run, "calls"), triangles: busiest(run, "triangles") });

/**
 * One row per shot present in both runs (A's order) and a last row, name "all" and route true, for the whole route.
 * Each time is {a, b, ratio: b / a}; calls and triangles are {a, b, diff: b - a}. Anything not measured is null.
 */
export function compareRuns(runA, runB) {
  return [...matchShots(runA, runB).map((m) => row(m.name, shotSide(m.a), shotSide(m.b))), row("all", routeSide(runA), routeSide(runB), true)];
}

/** What a reader must know beside the table: setups that differ without refusing, missing shots, page errors. */
export function notesFor(a, b, variantA, variantB) {
  const ra = a.runs[variantA], rb = b.runs[variantB], notes = [];
  for (const [k, label] of [["backend", "backend"], ["quality", "quality profile"], ["pixelRatio", "renderer pixel ratio"], ["viewport", "page viewport"]])
    if (key(ra[k]) !== key(rb[k])) notes.push(`${label} differs: A ${show(ra[k])}, B ${show(rb[k])}`);
  for (const k of ["warmup", "frames"])
    if (key(a[k]) !== key(b[k])) notes.push(`${k} differs: A ${show(a[k])}, B ${show(b[k])}; the percentiles rest on different samples`);
  const both = new Set(matchShots(ra, rb).map((m) => m.name));
  const only = (r) => (r.shots ?? []).map((s) => s?.name).filter((n) => !both.has(n));
  if (only(ra).length || only(rb).length)
    notes.push(`shots only in A: ${only(ra).join(", ") || "none"}; only in B: ${only(rb).join(", ") || "none"}; the "all" row covers different routes`);
  for (const [side, r] of [["A", ra], ["B", rb]])
    if (Array.isArray(r.errors) && r.errors.length) notes.push(`${side} logged ${r.errors.length} page error(s): the scene may not have loaded fully`);
  const sa = stampOf(a, variantA), sb = stampOf(b, variantB);
  if (!sa.sha || !sb.sha || !sa.gpu || !sb.gpu) notes.push("compared without a full build stamp: commit and GPU were not both checked");
  if (sa.dirty || sb.dirty) notes.push("a build had uncommitted changes (+alterado): its commit does not identify the code");
  if (sa.sha && sb.sha && !sameSha(sa.sha, sb.sha)) notes.push(`two different commits compared on purpose (--across-commits): ${sa.sha} vs ${sb.sha}`);
  return notes;
}

// --- Markdown -----------------------------------------------------------------------------------------------------

const ms = (x) => (x === null ? "n/d" : x.toFixed(2));
const plain = (x) => (x === null ? "n/d" : String(x));
const signed = (x) => (x === null ? "n/d" : x > 0 ? `+${x}` : String(x));
// report strings may come from another machine: no table breaks, no HTML, no @mentions when pasted into GitHub
const cell = (s) => text(s).replace(/\|/g, "\\|").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/@/g, "&#64;");
const line = (cells) => `| ${cells.join(" | ")} |`;

/** The comparison table of compareRuns' rows. */
export function markdownTable(rows) {
  const head = ["shot", "p50 ms A → B", "B/A", "p95 ms A → B", "B/A", "GPU p95 ms A → B", "B/A", "CPU p95 ms A → B", "B/A",
    "calls A → B", "Δ", "triangles A → B", "Δ"];
  const time = (p) => [`${ms(p.a)} → ${ms(p.b)}`, ms(p.ratio)];
  const count = (d) => [`${plain(d.a)} → ${plain(d.b)}`, signed(d.diff)];
  return [line(head), line(head.map((_, i) => (i ? "---:" : "---"))), ...rows.map((r) => line([r.route ? "**all** (route)" : cell(r.name),
    ...time(r.p50), ...time(r.p95), ...time(r.gpuP95), ...time(r.cpuP95), ...count(r.calls), ...count(r.triangles)]))].join("\n");
}

/** Side-by-side facts of the two runs (file, variant, stamp, backend, load, memory, errors). */
export function summaryTable(sides) {
  const mb = (x) => (isNum(x) ? (x / 1e6).toFixed(1) : "n/d");
  const facts = sides.map(({ file, report, variant }) => {
    const r = report.runs[variant], s = stampOf(report, variant);
    return [file, variant, s.sha ?? "n/d", s.gpu ?? "n/d", r.backend ?? "n/d", r.quality ?? "n/d", isNum(r.loadMs) ? r.loadMs.toFixed(0) : "n/d",
      mb(r.textureBytes), mb(r.resources?.transferBytes), Array.isArray(r.errors) ? r.errors.length : "n/d", report.when ?? "n/d"];
  });
  const labels = ["file", "variant", "commit", "GPU", "backend", "quality", "load ms", "texture MB", "transfer MB", "page errors", "measured"];
  return [line(["", "A", "B"]), line(["---", "---", "---"]), ...labels.map((l, i) => line([l, ...facts.map((f) => cell(f[i]))]))].join("\n");
}

// --- pictures -----------------------------------------------------------------------------------------------------

const SAFE_NAME = /^[\p{L}\p{N}_-]+$/u;
const tag = (v) => String(v).replace(/[^a-z0-9]+/gi, "-");          // as tools/bench.mjs names its pictures
const nn = (i) => String(i + 1).padStart(2, "0");

/**
 * Picture file names per shared shot: NN-<shot>-<tag>.png as tools/bench.mjs writes them (NN is the shot's place in
 * its own run, so A and B may differ), and the side-by-side output NN-<shot>-<tagA>-vs-<tagB>.png. Shots whose name is
 * not a plain word are left out, so report data never turns into a path.
 */
export function picturePairs(runA, runB, variantA, variantB) {
  return matchShots(runA, runB).filter((m) => typeof m.name === "string" && SAFE_NAME.test(m.name)).map((m) => ({ shot: m.name,
    a: `${nn(m.ia)}-${m.name}-${tag(variantA)}.png`, b: `${nn(m.ib)}-${m.name}-${tag(variantB)}.png`,
    out: `${nn(m.ia)}-${m.name}-${tag(variantA)}-vs-${tag(variantB)}.png` }));
}

const xml = (s) => text(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]);

/** A | B with a label bar over each picture; sharp is loaded here only, so importing this module needs no images. */
async function sideBySide(fileA, fileB, out, labelA, labelB) {
  const { default: sharp } = await import("sharp");
  const [ma, mb] = await Promise.all([sharp(fileA).metadata(), sharp(fileB).metadata()]);
  const gap = 8, bar = 32, left = ma.width + gap;
  const label = (s, w) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${bar}">` +
    `<text x="10" y="22" font-family="sans-serif" font-size="18" fill="#f2f2f2">${xml(s)}</text></svg>`);
  await sharp({ create: { width: left + mb.width, height: bar + Math.max(ma.height, mb.height), channels: 3, background: "#16161a" } })
    .composite([{ input: label(labelA, ma.width), left: 0, top: 0 }, { input: fileA, left: 0, top: bar },
      { input: label(labelB, mb.width), left, top: 0 }, { input: fileB, left, top: bar }])
    .png().toFile(out);
}

// --- command line -------------------------------------------------------------------------------------------------

const USAGE = "usage: node tools/compare_bench.mjs <a.json> <b.json> [--variant <name>] [--variant-b <name>] " +
  "[--images <dirA> <dirB> <outDir>] [--allow-unstamped] [--allow-dirty] [--across-commits]";

/** Command-line options; throws on an unknown option, a missing value or a count of files other than two. */
export function parseArgs(argv) {
  const out = { files: [], variant: undefined, variantB: undefined, images: undefined, allowUnstamped: false, allowDirty: false,
    acrossCommits: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    const take = (n) => {
      const v = argv.slice(i + 1, i + 1 + n);
      if (v.length < n || v.some((s) => s.startsWith("--"))) throw new Error(`${x} needs ${n === 1 ? "a value" : `${n} values`}`);
      i += n;
      return v;
    };
    if (x === "--variant") [out.variant] = take(1);
    else if (x === "--variant-b") [out.variantB] = take(1);
    else if (x === "--images") out.images = take(3);
    else if (x === "--allow-unstamped") out.allowUnstamped = true;
    else if (x === "--allow-dirty") out.allowDirty = true;
    else if (x === "--across-commits") out.acrossCommits = true;
    else if (x === "-h" || x === "--help") out.help = true;
    else if (x.startsWith("-")) throw new Error(`unknown option ${x}`);
    else out.files.push(x);
  }
  if (!out.help && out.files.length !== 2) throw new Error("expected two report files");
  return out;
}

async function main(argv) {
  let args, a, b;
  try {
    args = parseArgs(argv);
    if (args.help) return void console.log(USAGE);
    [a, b] = args.files.map((f) => JSON.parse(readFileSync(f, "utf8")));
  } catch (e) {
    console.error(`${text(e instanceof Error ? e.message : e)}\n${USAGE}`);
    return void (process.exitCode = 2);
  }
  const opts = { allowUnstamped: args.allowUnstamped, allowDirty: args.allowDirty, acrossCommits: args.acrossCommits,
    variant: args.variant, variantB: args.variantB };
  const reasons = checkComparable(a, b, opts);
  if (reasons.length) {
    console.error(["Refused: these two reports cannot be compared.", ...reasons.map((r) => `- ${text(r)}`)].join("\n"));
    return void (process.exitCode = 1);
  }
  const { variantA, variantB } = pickVariants(a, b, opts);
  const [ra, rb] = [a.runs[variantA], b.runs[variantB]];
  const notes = notesFor(a, b, variantA, variantB);
  const written = [];
  if (args.images) {
    const [dirA, dirB, outDir] = args.images, pairs = picturePairs(ra, rb, variantA, variantB);
    const skipped = matchShots(ra, rb).length - pairs.length;
    if (skipped) notes.push(`${skipped} shot(s) without a plain-word name got no picture`);
    mkdirSync(outDir, { recursive: true });
    for (const p of pairs) {
      const fa = join(dirA, p.a), fb = join(dirB, p.b), lost = [fa, fb].filter((f) => !existsSync(f));
      if (lost.length) { notes.push(`no picture for ${p.shot}: missing ${lost.join(", ")}`); process.exitCode = 1; continue; }
      await sideBySide(fa, fb, join(outDir, p.out), `A  ${variantA}  ${p.shot}`, `B  ${variantB}  ${p.shot}`);
      written.push(join(outDir, p.out));
    }
  }
  console.log([`## Bench: A ${cell(variantA)} vs B ${cell(variantB)}`, "",
    summaryTable([{ file: args.files[0], report: a, variant: variantA }, { file: args.files[1], report: b, variant: variantB }]), "",
    markdownTable(compareRuns(ra, rb)), "",
    "B/A above 1 means B is slower. Frame time is the interval between frames, capped by the display's refresh rate when " +
    "the browser syncs to it (tools/bench.mjs); n/d = not measured.",
    ...notes.map((n) => `- ${text(n)}`), ...written.map((f) => `- picture: ${text(f)}`)].join("\n"));
}

// run as a program only (not when a test imports it); import.meta.main is absent on Node 24.0 and 24.1
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
