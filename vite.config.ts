import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";

// Build stamp: the commit that produced this bundle, so every bench report and the credits name their code.
// Vercel builds expose VERCEL_GIT_COMMIT_SHA; a local build asks git and marks uncommitted changes, so a number
// measured on a dirty tree is never mistaken for the commit's.
function buildSha(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], { encoding: "utf8" }).trim() !== "";
    return dirty ? `${sha}+alterado` : sha;
  } catch {
    return "desconhecido";
  }
}

export default defineConfig({
  base: "./",
  define: { __BUILD_SHA__: JSON.stringify(buildSha()) },
  build: { target: "es2022", chunkSizeWarningLimit: 1500, reportCompressedSize: true },
});
