// The provisional rig of src/rig.ts guesses 11 bones for a Tripo mesh that came without a skeleton. The hero now ships
// with Tripo's own skeleton and walk clip, played through AnimationMixer in src/animated-actor.ts, and CLAUDE.md forbids
// applying the provisional rig to it (or re-skinning the SkinnedMesh apart from its skeleton). rig.ts stays only as a
// reference, so no game or tool code may import it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const RIG = join(ROOT, "src", "rig.ts");
const SOURCE = /\.(?:[cm]?[jt]sx?|html)$/;

// Every quoted string in the file, whatever statement it sits in: import/export clauses split over lines with comments,
// import() with backticks, createRequire(...)("../src/rig.ts"), <script src="/src/rig.ts">. Recognising import syntax
// alone missed some of those; a quoted path that resolves to src/rig.ts is a reference, whatever surrounds it.
const QUOTED = /(['"`])((?:\\.|(?!\1)[^\\\r\n])*)\1/g;

const specifiers = (text: string) => [...text.matchAll(QUOTED)].map((m) => m[2]);

/** Whether `spec`, written in `file`, names src/rig.ts (with .ts or .js, without extension, or root-absolute as Vite allows). */
function namesRig(file: string, spec: string): boolean {
  const path = spec.replace(/[?#].*$/, "");
  if (!path.startsWith(".") && !path.startsWith("/")) return false; // a package, not a project file
  const target = path.startsWith("/") ? join(ROOT, path) : resolve(dirname(file), path);
  return target.replace(/\.(?:[cm]?[jt]sx?)$/, "") === RIG.replace(/\.ts$/, "");
}

function sources(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith(".") || e.name === "node_modules") return []; // tools/.cache and the like are not project code
    const path = join(dir, e.name);
    return e.isDirectory() ? sources(path) : SOURCE.test(e.name) ? [path] : [];
  });
}

test("the import scanner recognises every way of naming src/rig.ts", () => {
  const main = join(ROOT, "src", "main.ts"), tool = join(ROOT, "tools", "x.mjs");
  for (const [file, text] of [
    [main, `import { rigPerson } from "./rig.ts"`],
    [main, `import {\n  bakedGeometry,\n  type ModelSpec,\n} from './rig'`],
    [main, `export { rigPerson } from "./rig.js";`],
    [main, `import "./rig.ts?raw"`],
    [main, `const r = await import ( './rig.ts' )`],
    [main, `import { rigPerson } from "/src/rig.ts"`],
    [tool, `import { rigPerson } from "../src/rig.ts"`],
    [main, "import {\n  bakedGeometry, // the rig's own; don't\n} from './rig.ts'"],
    [main, "const m = await import(`./rig.ts`)"],
    [tool, `const { rigPerson } = createRequire(import.meta.url)("../src/rig.ts")`],
    [join(ROOT, "index.html"), `<script type="module" src="/src/rig.ts"></script>`],
  ] as const) assert.ok(specifiers(text).some((s) => namesRig(file, s)), `missed: ${text}`);
  for (const [file, text] of [
    [main, `import { animatedActor } from "./animated-actor.ts"`],
    [main, `import rig from "rig"`],
    [main, `import { x } from "./rigging.ts"`],
    [tool, `import { x } from "./rig.ts"`], // tools/rig.ts, not src/rig.ts
  ] as const) assert.ok(!specifiers(text).some((s) => namesRig(file, s)), `false alarm: ${text}`);
});

test("no file under src/ or tools/, nor index.html, refers to the provisional rig", () => {
  assert.ok(existsSync(RIG), "src/rig.ts is gone or renamed: update or drop this guard with it");
  const files = [...sources(join(ROOT, "src")), ...sources(join(ROOT, "tools")), join(ROOT, "index.html")];
  // the scanner must actually see this codebase's imports, or an empty match would pass for the wrong reason. Since R9
  // the hero reaches animated-actor.ts through character-quality.ts (requireHero), which main.ts imports.
  assert.ok(specifiers(readFileSync(join(ROOT, "src", "main.ts"), "utf8")).includes("./character-quality.ts"), "scanner sees no imports in src/main.ts");
  assert.ok(specifiers(readFileSync(join(ROOT, "src", "character-quality.ts"), "utf8")).includes("./animated-actor.ts"),
    "the hero no longer reaches src/animated-actor.ts through src/character-quality.ts");
  const offenders = files.filter((f) => f !== RIG)
    .flatMap((f) => specifiers(readFileSync(f, "utf8")).filter((s) => namesRig(f, s)).map((s) => `${relative(ROOT, f)} -> ${s}`));
  assert.deepEqual(offenders, [], "the real hero rig plays through src/animated-actor.ts; do not apply src/rig.ts (CLAUDE.md)");
});

test("src/animated-actor.ts keeps the real AnimationMixer path", () => {
  const text = readFileSync(join(ROOT, "src", "animated-actor.ts"), "utf8");
  assert.match(text, /\bnew\s+(?:THREE\.)?AnimationMixer\s*\(/, "the hero's clips must play through a THREE.AnimationMixer");
  assert.match(text, /\.clipAction\s*\(/, "the walk clip must be played as a mixer action");
});
