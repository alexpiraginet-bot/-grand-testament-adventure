// The Tripo meshes and their textures are Alex's, licensed apart from the MIT code (ASSETS.md, TRIPO.md): this public
// repository must never track them, nor the sources in assets-src/ or the engine exports in export/. `git ls-files`
// reads the index, so even a forced `git add -f` fails here before it can be committed. Without git (a tarball, or a
// build that copies the tree without .git) there is no index to check and the tests skip.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// .ktx2 is forbidden except for the CC0 textures under public/textures/ (ground, sky), which R10 may convert to KTX2
const FORBIDDEN = [/\.glb$/i, /\.gltf$/i, /^(?!public\/textures\/).*\.ktx2$/i, /(?:^|\/)assets-src\//, /(?:^|\/)export\//];
// one path per rule, in directories that are otherwise tracked, so each probe is caught by its own .gitignore rule
const PROBES = ["src/probe.glb", "src/probe.gltf", "src/probe.ktx2", "assets-src/probe.bin", "export/probe.bin"];

/** Runs git in the repository root; exit status 1 is an answer for check-ignore, not a failure. */
function git(args: string[], input?: string): { status: number; stdout: string } | undefined {
  try { return { status: 0, stdout: execFileSync("git", args, { cwd: ROOT, encoding: "utf8", input, stdio: [input === undefined ? "ignore" : "pipe", "pipe", "ignore"] }) }; }
  catch (e) {
    const err = e as { status?: number | null; stdout?: string };
    return typeof err.status === "number" && err.status !== 128 ? { status: err.status, stdout: err.stdout ?? "" } : undefined;
  }
}
const inRepo = git(["rev-parse", "--is-inside-work-tree"])?.stdout.trim() === "true";
const NO_GIT = "git is unavailable or this checkout has no .git: nothing to check";

test("git tracks no mesh, KTX2 texture, assets-src/ or export/ path", (t) => {
  if (!inRepo) { t.skip(NO_GIT); return; }
  const listed = git(["ls-files", "-z"]);
  assert.ok(listed && listed.status === 0, "git ls-files failed");
  const paths = listed.stdout.split("\0").filter(Boolean);
  assert.ok(paths.includes("package.json"), "git ls-files did not list the repository files");
  assert.deepEqual(paths.filter((p) => FORBIDDEN.some((r) => r.test(p))), [],
    "untrack these with git rm --cached; asset binaries are fetched by npm run assets, never committed (ASSETS.md)");
});

test(".gitignore itself keeps those paths out", (t) => {
  if (!inRepo) { t.skip(NO_GIT); return; }
  // -v names the rule's source, so a match from a personal global excludes file cannot stand in for the repository's
  const out = git(["check-ignore", "--no-index", "-v", "-z", "--stdin"], PROBES.join("\0") + "\0");
  assert.ok(out, "git check-ignore failed");
  const fields = out.stdout.split("\0");
  const source = new Map<string, string>();
  for (let i = 0; i + 3 < fields.length; i += 4) source.set(fields[i + 3], fields[i]);
  assert.deepEqual(PROBES.filter((p) => source.get(p) !== ".gitignore"), [], "add the missing rule to .gitignore");
});
