// The textures a scene holds, as items for bench.ts memorySummary(): what the GPU stores per format and per origin.
// three r186 counts a compressed texture as 1 byte per texel (bench.ts explains), so the bench reports this estimate
// next to renderer.info.memory instead of trusting texturesSize alone.
import * as THREE from "three/webgpu";
import type { MemoryItem, TexelFormat } from "./bench.ts";

const SLOTS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "bumpMap",
  "displacementMap", "lightMap", "specularMap", "envMap", "clearcoatMap", "sheenColorMap", "transmissionMap"] as const;

/** Texel format of an uncompressed texture, or null when this estimate has no row for it (it is then counted apart). */
export function texelFormat(format: number, type: number): TexelFormat | null {
  const bytes8 = type === THREE.UnsignedByteType, half = type === THREE.HalfFloatType, float = type === THREE.FloatType;
  if (format === THREE.RGBAFormat) return bytes8 ? "rgba8" : half ? "rgba16f" : float ? "rgba32f" : null;
  if (format === THREE.RGFormat && bytes8) return "rg8";
  if (format === THREE.RedFormat && bytes8) return "r8";
  return null;
}

type Img = { width?: number; height?: number; depth?: number; data?: { length?: number } };

/** One item per distinct texture reachable from the scene's materials, background and environment. */
export function sceneTextures(scene: THREE.Scene): MemoryItem[] {
  const seen = new Set<THREE.Texture>();
  const add = (t: unknown) => { if (t && (t as THREE.Texture).isTexture) seen.add(t as THREE.Texture); };
  scene.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    for (const m of Array.isArray(mats) ? mats : mats ? [mats] : [])
      for (const slot of SLOTS) add((m as unknown as Record<string, unknown>)[slot]);
  });
  add(scene.background); add(scene.environment);
  const items: MemoryItem[] = [];
  for (const t of seen) {
    const img = (t.image ?? {}) as Img;
    const width = img.width ?? 0, height = img.height ?? 0;
    if (!width || !height) continue;                  // not uploaded yet, or a video/canvas without a size
    const origin = (t as THREE.DataTexture).isDataTexture ? "dados" : (t as THREE.CompressedTexture).isCompressedTexture ? "comprimida" : "imagem";
    const format = texelFormat(t.format as number, t.type as number);
    const mipmaps = t.generateMipmaps || (t.mipmaps?.length ?? 0) > 1;
    if (format) items.push({ origin, width, height, depth: img.depth, format, mipmaps });
    else items.push({ origin, format: `outro(${t.format}/${t.type})`, bytes: 0 });   // listed, not guessed
  }
  return items;
}
