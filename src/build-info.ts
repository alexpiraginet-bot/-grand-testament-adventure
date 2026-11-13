// The commit this bundle was built from (vite.config.ts defines __BUILD_SHA__). Under node --test there is no Vite,
// so the name is absent and the stamp reads "desconhecido" instead of throwing.
declare const __BUILD_SHA__: string | undefined;

export const BUILD_SHA: string = typeof __BUILD_SHA__ === "string" ? __BUILD_SHA__ : "desconhecido";
/** Short form for people: the first 7 characters of the commit, keeping the "+alterado" mark of a dirty local tree. */
export const BUILD_SHORT: string = BUILD_SHA.replace(/^([0-9a-f]{7})[0-9a-f]*/, "$1");

/** One line naming the graphics adapter, from what the backend exposes; null when the browser does not tell. */
export function describeGpu(info: { webgpu?: { vendor?: string; architecture?: string; device?: string; description?: string } | null;
  webglRenderer?: string | null }): string | null {
  const w = info.webgpu;
  if (w) {
    const parts = [w.vendor, w.architecture, w.device, w.description].filter((s) => s && s.trim()).map((s) => s!.trim());
    if (parts.length) return [...new Set(parts)].join(" · ");
  }
  return info.webglRenderer?.trim() || null;
}
