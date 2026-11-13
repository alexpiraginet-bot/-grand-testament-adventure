import { defineConfig } from "vite";

// The devs' panel (painel.html) is built on its own, after the game, into the same dist/. As a second page of the
// game's build it would move pieces the two pages share (the theme's CSS, Vite's preload helper) into separate files,
// that is, extra requests when the game starts; built apart, the game's files are exactly what they were.
export default defineConfig({
  base: "./",
  publicDir: false,                                   // the game's build already copied public/
  build: { target: "es2022", outDir: "dist", emptyOutDir: false, reportCompressedSize: true, rolldownOptions: { input: "painel.html" } },
});
