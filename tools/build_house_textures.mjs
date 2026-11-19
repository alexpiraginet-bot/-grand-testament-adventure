// Two tileable materials for the house kit (src/house-kit.ts), made by code: a dry-laid basalt fieldstone wall and an
// earthen plaster for flat roofs. No download and no generation service: every pixel comes from the functions below,
// with a fixed seed, so the files can be made again and compared (--check).
//
// They are artistic materials for a recreated village: not a scan of Capernaum's masonry and not a source.
//   node tools/build_house_textures.mjs          writes public/textures/houses-r17/*.webp and src/data/house-materials-r17.json
//   node tools/build_house_textures.mjs --check  fails if the committed catalogue's hashes differ from what the code gives
//   node tools/build_house_textures.mjs --preview <dir>  also writes PNG contact sheets to look at (not committed)
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("public/textures/houses-r17/", ROOT), CATALOG = new URL("src/data/house-materials-r17.json", ROOT);
const SIZES = { mobile: 512, desktop: 1024 };

// ---- deterministic numbers
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash2 = (x, y, s) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const smooth = (t) => t * t * (3 - 2 * t), clamp01 = (v) => Math.min(1, Math.max(0, v)), mix = (a, b, t) => a + (b - a) * t;
/** Value noise that repeats every `period` cells: the tile has no seam. */
function noise(x, y, period, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
  const w = (v) => ((v % period) + period) % period;
  const a = hash2(w(xi), w(yi), seed), b = hash2(w(xi + 1), w(yi), seed), c = hash2(w(xi), w(yi + 1), seed), d = hash2(w(xi + 1), w(yi + 1), seed);
  return mix(mix(a, b, fx), mix(c, d, fx), fy);
}
/** Fractal noise over the unit tile (u, v in 0..1), `cells` cells across at its coarsest. */
function fbm(u, v, cells, octaves, seed) {
  let sum = 0, amp = 0.5, total = 0;
  for (let o = 0; o < octaves; o++) { const n = cells << o; sum += amp * noise(u * n, v * n, n, seed + o * 17); total += amp; amp *= 0.5; }
  return sum / total;
}
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255].map((c) => Math.pow(c / 255, 2.2));        // to linear
const toSrgb = (l) => Math.round(255 * Math.pow(clamp01(l), 1 / 2.2));

// ---- the basalt wall: unhewn fieldstones of many sizes, bedded roughly flat, with small stones and earth packed
// between them. Each stone is a cell of an irregular (Voronoi) pattern, worn at its corners, with its own tone, tilt
// and weathering. A first version drew rounded blocks in neat courses and read as paving: rejected.
const WALL = { tileMeters: 2.4, seed: 1907, nx: 9, ny: 13, squash: 1.35 };
function wallLayout() {
  const r = rng(WALL.seed), cells = [];
  // weathered basalt in daylight: dark grey, not black (a first palette near black left shaded walls unreadable)
  const palette = [0x3b3a39, 0x474442, 0x514c46, 0x38393d, 0x5a544c, 0x423e3b, 0x4c4946, 0x3f4045];
  for (let j = 0; j < WALL.ny; j++) for (let i = 0; i < WALL.nx; i++) {
    const n = r() < 0.4 ? 2 : 1, points = [];                                // some cells hold two smaller stones
    for (let k = 0; k < n; k++) {
      const base = hex(palette[Math.floor(r() * palette.length)]), tone = 0.78 + r() * 0.5, warm = r() < 0.18 ? 0.1 + r() * 0.12 : 0;
      points.push({ x: (i + 0.12 + r() * 0.76) / WALL.nx, y: (j + 0.14 + r() * 0.72) / WALL.ny,
        // broken faces, not pebbles: a short bevel at the edge and then a nearly flat face, tilted its own way
        gap: 0.005 + r() * 0.009, bevel: 0.008 + r() * 0.014, rise: 0.012 + r() * 0.02, tiltX: (r() - 0.5) * 0.22, tiltY: (r() - 0.5) * 0.22,
        color: base.map((c, ch) => c * tone * (1 + warm * (ch === 0 ? 1 : ch === 1 ? 0.35 : -0.6))), dust: r() < 0.45 ? 0.15 + r() * 0.35 : r() * 0.1,
        rough: 0.82 + r() * 0.12, seed: Math.floor(r() * 1e6) });
    }
    cells.push(points);
  }
  return cells;
}
function wallSample(cells, u, v) {
  const T = WALL.tileMeters, ci = Math.floor(u * WALL.nx), cj = Math.floor(v * WALL.ny);
  let f1 = 9, f2 = 9, f3 = 9, stone = null, sx = 0, sy = 0;
  for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
    const i = (ci + di + WALL.nx) % WALL.nx, j = (cj + dj + WALL.ny) % WALL.ny;
    for (const p of cells[j * WALL.nx + i]) {
      let dx = u - p.x, dy = v - p.y; dx -= Math.round(dx); dy -= Math.round(dy);
      const mx = dx * T, my = dy * T * WALL.squash, d = Math.hypot(mx, my);     // flatter than wide: stones lie on their beds
      if (d < f1) { f3 = f2; f2 = f1; f1 = d; stone = p; sx = mx; sy = my / WALL.squash; } else if (d < f2) { f3 = f2; f2 = d; } else if (d < f3) f3 = d;
    }
  }
  const coarse = fbm(u, v, 20, 3, 71), grain = fbm(u, v, 72, 4, 311), fine = noise(u * 512, v * 512, 512, 97);
  // metres inside the stone's outline: half the gap between the two nearest centres, worn where three stones meet,
  // with an edge no mason squared
  const corner = clamp01(1 - (f3 - f2) / 0.05);
  const inside = (f2 - f1) / 2 - stone.gap - corner * corner * 0.006 + (coarse - 0.5) * 0.014 + (grain - 0.5) * 0.005;
  if (inside <= 0) {                                                         // the bed: packed earth and grit, in shadow
    const deep = clamp01(-inside / 0.012), pebble = noise(u * 190, v * 190, 190, 733);
    const c = hex(0x6a5f52).map((ch) => ch * (0.5 + 0.45 * grain) * (1 - 0.45 * deep) * (pebble > 0.7 ? 1.25 : 1));
    return { h: -0.012 - 0.012 * deep + (pebble > 0.7 ? (pebble - 0.7) * 0.02 : 0) + (grain - 0.5) * 0.004, color: c, rough: 0.98 };
  }
  const t = smooth(clamp01(inside / stone.bevel));
  const pit = fine > 0.86 && grain > 0.5 ? (fine - 0.86) * 0.04 : 0;         // basalt's small holes, few
  const chip = clamp01((fbm(u, v, 40, 2, stone.seed % 991) - 0.62) * 6) * 0.006;
  const h = stone.rise * t + stone.tiltX * sx + stone.tiltY * sy + (coarse - 0.5) * 0.012 + (grain - 0.5) * 0.008 - pit - chip;
  const weather = clamp01((fbm(u, v, 10, 3, stone.seed % 997) - 0.4) * 2.4) * stone.dust;
  const dustC = hex(0x8b8272), speck = 0.8 + 0.4 * grain + (fine - 0.5) * 0.14, shade = (0.72 + 0.28 * t) * speck * (pit ? 0.75 : 1);
  return { h, color: stone.color.map((c, i) => mix(c, dustC[i], weather) * shade), rough: clamp01(stone.rough + (grain - 0.5) * 0.1 + weather * 0.06) };
}

// ---- the earthen plaster of a flat roof: packed mud with chopped straw, fine cracks where it dried
const MUD = { tileMeters: 2, seed: 4421 };
function mudLayout() {
  const r = rng(MUD.seed), straws = [], cells = 6, points = [];
  for (let i = 0; i < 520; i++) { const a = r() * Math.PI, l = 0.012 + r() * 0.03; straws.push({ u: r(), v: r(), dx: Math.cos(a) * l, dy: Math.sin(a) * l, w: 0.0009 + r() * 0.0012, tone: 0.75 + r() * 0.5 }); }
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) points.push({ x: (i + 0.15 + r() * 0.7) / cells, y: (j + 0.15 + r() * 0.7) / cells });
  return { straws, cells, points };
}
function mudSample(layout, u, v) {
  const big = fbm(u, v, 5, 4, 911), grit = fbm(u, v, 96, 3, 131), fine = noise(u * 400, v * 400, 400, 53);
  // cracks: where the two nearest cell points are almost equally far (a drying pattern), on the wrapped tile
  let d1 = 9, d2 = 9;
  for (const p of layout.points) { let dx = Math.abs(u - p.x), dy = Math.abs(v - p.y); dx = Math.min(dx, 1 - dx); dy = Math.min(dy, 1 - dy); const d = Math.hypot(dx, dy); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  // only here and there: a roof that is rolled after every rain has few open cracks
  const open = clamp01((fbm(u, v, 4, 2, 677) - 0.52) * 5);
  const edge = d2 - d1 + (grit - 0.5) * 0.012, crack = (1 - clamp01(edge / 0.004)) * open;
  let straw = 0, tone = 1;
  for (const s of layout.straws) {
    let px = u - s.u, py = v - s.v; px -= Math.round(px); py -= Math.round(py);
    const l2 = s.dx * s.dx + s.dy * s.dy, k = clamp01((px * s.dx + py * s.dy) / l2), d = Math.hypot(px - k * s.dx, py - k * s.dy);
    if (d < s.w) { const a = 1 - d / s.w; if (a > straw) { straw = a; tone = s.tone; } }
  }
  const base = hex(0x8c785e), light = hex(0xa8946f), dark = hex(0x5d4f3f), strawC = hex(0xc4b182);
  let c = base.map((b, i) => mix(mix(dark[i], b, clamp01(big * 1.5)), light[i], clamp01((big - 0.55) * 2)) * (0.88 + 0.24 * grit));
  c = c.map((ch, i) => mix(ch, strawC[i] * tone, straw * 0.7) * (1 - 0.4 * crack));
  const h = (big - 0.5) * 0.012 + (grit - 0.5) * 0.004 + (fine - 0.5) * 0.0015 + straw * 0.0012 - crack * 0.005;
  return { h, color: c, rough: clamp01(0.95 + (grit - 0.5) * 0.06 - straw * 0.1) };
}

// ---- pixels
async function render(name, sample, tileMeters, size, bump) {
  const height = new Float32Array(size * size), rgb = Buffer.alloc(size * size * 3), rough = Buffer.alloc(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const s = sample((i + 0.5) / size, (j + 0.5) / size), k = j * size + i;
    height[k] = s.h; rgb[k * 3] = toSrgb(s.color[0]); rgb[k * 3 + 1] = toSrgb(s.color[1]); rgb[k * 3 + 2] = toSrgb(s.color[2]); rough[k] = Math.round(255 * s.rough);
  }
  // the normal from the height, in metres per metre; rows run down the image and v runs up, so green follows +row
  const normal = Buffer.alloc(size * size * 3), px = tileMeters / size, w = (v) => (v + size) % size;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const dx = (height[j * size + w(i + 1)] - height[j * size + w(i - 1)]) / (2 * px), dy = (height[w(j + 1) * size + i] - height[w(j - 1) * size + i]) / (2 * px);
    const nx = -dx * bump, ny = dy * bump, l = Math.hypot(nx, ny, 1), k = (j * size + i) * 3;
    normal[k] = Math.round(127.5 + 127.5 * nx / l); normal[k + 1] = Math.round(127.5 + 127.5 * ny / l); normal[k + 2] = Math.round(127.5 + 127.5 / l);
  }
  const webp = (buffer, channels, quality) => sharp(buffer, { raw: { width: size, height: size, channels } }).webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
  return { name, size, raw: { rgb, normal, rough }, files: { map: await webp(rgb, 3, 84), normalMap: await webp(normal, 3, 92), roughnessMap: await webp(rough, 1, 82) } };
}

const sha = (b) => createHash("sha256").update(b).digest("hex");
async function build() {
  const rows = wallLayout(), mud = mudLayout(), out = [];                     // (`rows` holds the wall's stones)
  for (const [profile, size] of Object.entries(SIZES)) {
    out.push({ profile, ...(await render("basalt-wall", (u, v) => wallSample(rows, u, v), WALL.tileMeters, size, 1.2)), tileMeters: WALL.tileMeters });
    out.push({ profile, ...(await render("mud-plaster", (u, v) => mudSample(mud, u, v), MUD.tileMeters, size, 1.6)), tileMeters: MUD.tileMeters });
  }
  const catalog = { schemaVersion: 1, revision: "house-materials-r17", generator: "tools/build_house_textures.mjs",
    license: "MIT", author: "Grand Testament Adventure (gerado por código deste repositório)",
    note: "Materiais artísticos para uma vila recriada: não são levantamento da alvenaria de Cafarnaum nem fonte.", materials: {} };
  const files = [];
  for (const m of out) {
    const entry = (catalog.materials[m.name] ??= { tileMeters: m.tileMeters, profiles: {} });
    entry.profiles[m.profile] = {};
    for (const [role, bytes] of Object.entries(m.files)) {
      const digest = sha(bytes), file = `${m.name}-${role}-${m.size}-${digest.slice(0, 12)}.webp`;
      entry.profiles[m.profile][role] = { url: `textures/houses-r17/${file}`, bytes: bytes.length, sha256: digest, size: m.size, colorSpace: role === "map" ? "srgb" : "linear" };
      files.push({ file, bytes });
    }
  }
  return { catalog, files, out };
}

const { catalog, files, out } = await build();
const text = `${JSON.stringify(catalog, null, 1)}\n`;
if (process.argv.includes("--check")) {
  const had = (() => { try { return readFileSync(CATALOG, "utf8"); } catch { return null; } })();
  let ok = had === text;
  for (const f of files) { try { ok &&= sha(readFileSync(new URL(f.file, OUT))) === sha(f.bytes); } catch { ok = false; } }
  if (!ok) { console.error("house materials differ from what the code gives: run node tools/build_house_textures.mjs"); process.exit(1); }
  console.log(`house materials match the code: ${files.length} files`);
} else {
  mkdirSync(OUT, { recursive: true });
  for (const old of readdirSync(OUT)) if (old.endsWith(".webp")) rmSync(new URL(old, OUT));
  for (const f of files) writeFileSync(new URL(f.file, OUT), f.bytes);
  writeFileSync(CATALOG, text);
  console.log(`wrote ${files.length} files, ${files.reduce((n, f) => n + f.bytes.length, 0)} bytes, and ${fileURLToPath(CATALOG)}`);
}
const at = process.argv.indexOf("--preview");
if (at > 0) {
  const dir = process.argv[at + 1]; mkdirSync(dir, { recursive: true });
  for (const m of out.filter((m) => m.profile === "desktop")) {
    const png = (buffer, channels) => sharp(buffer, { raw: { width: m.size, height: m.size, channels } }).png().toBuffer();
    const tile = await png(m.raw.rgb, 3);
    // the albedo twice across and down (to see the seam), and its normal map
    const sheet = await sharp({ create: { width: m.size * 2, height: m.size * 2, channels: 3, background: "#000" } })
      .composite([{ input: tile, left: 0, top: 0 }, { input: tile, left: m.size, top: 0 }, { input: tile, left: 0, top: m.size }, { input: tile, left: m.size, top: m.size }]).png().toBuffer();
    await sharp(sheet).resize(1024, 1024).png().toFile(`${dir}/${m.name}-2x2.png`);
    await sharp(tile).extract({ left: 0, top: 0, width: 512, height: 512 }).png().toFile(`${dir}/${m.name}-detail.png`);
    await sharp(await png(m.raw.normal, 3)).resize(512, 512).toFile(`${dir}/${m.name}-normal.png`);
  }
  console.log(`previews in ${dir}`);
}
