// A composed camera for the moments the story speaks (the call by the nets, the call by the boat): a two-shot from the
// side of the people involved, chosen once when the line starts and held while it is read. Plain math so it can be
// tested; main.ts blends the game camera into it and back, and the player can leave it by moving.

export type V3 = { x: number; y: number; z: number };
export type Subject = { x: number; z: number; ground: number };
export type CineShot = { eye: V3; look: V3 };
export type ShotWorld = {
  heightAt(x: number, z: number): number;
  /** true when a camera at (x, y, z) would be inside something solid (a house, a wall) */
  solid(x: number, y: number, z: number): boolean;
};

const FACE = 1.45;          // metres above the ground: between chest and eyes of a standing adult
const EYE = 1.6;            // camera height above the ground, or above the lake surface (y = 0)

/**
 * Two-shot of `subjects` (the first is the hero) for a horizontal field of view `hfov` (radians). Tries the side the
 * camera is already on first (`from`), so the screen direction does not flip, then the other side, with small turns and
 * distances, and keeps the first eye that is outside solids and sees the group without a solid in between.
 */
export function twoShot(subjects: readonly Subject[], hfov: number, world: ShotWorld, from?: { x: number; z: number }): CineShot | null {
  if (!subjects.length) return null;
  const n = subjects.length;
  const c = { x: subjects.reduce((s, p) => s + p.x, 0) / n, z: subjects.reduce((s, p) => s + p.z, 0) / n };
  const lookY = subjects.reduce((s, p) => s + Math.max(p.ground, 0), 0) / n + FACE;
  // the axis runs from the hero to the others; the camera looks across it
  const others = subjects.length > 1 ? subjects.slice(1) : subjects;
  const o = { x: others.reduce((s, p) => s + p.x, 0) / others.length, z: others.reduce((s, p) => s + p.z, 0) / others.length };
  let ax = o.x - subjects[0].x, az = o.z - subjects[0].z;
  const al = Math.hypot(ax, az);
  if (al < 1e-6) { ax = 1; az = 0; } else { ax /= al; az /= al; }
  const span = Math.max(...subjects.map((p) => Math.abs((p.x - c.x) * ax + (p.z - c.z) * az))) + 0.9;
  const base = Math.min(12, Math.max(3.2, (span / Math.tan(hfov / 2)) * 1.1));
  let side = 1;
  if (from) side = (from.x - c.x) * -az + (from.z - c.z) * ax >= 0 ? 1 : -1;     // which side of the axis the camera is on
  const look = { x: c.x, y: lookY, z: c.z };
  for (const sd of [side, -side]) for (const turn of [0, 0.35, -0.35, 0.7, -0.7]) for (const k of [1, 0.8, 1.3]) {
    const px = -az * sd, pz = ax * sd;                                   // perpendicular, on side sd
    const cs = Math.cos(turn), sn = Math.sin(turn);
    const dx = px * cs - pz * sn, dz = px * sn + pz * cs;
    const d = base * k;
    const ex = c.x + dx * d, ez = c.z + dz * d;
    const eye = { x: ex, y: Math.max(world.heightAt(ex, ez), 0) + EYE, z: ez };
    if (!clear(eye, look, world)) continue;
    return { eye, look };
  }
  return null;
}

/** The eye is outside solids and nothing solid stands between it and the point it looks at. */
function clear(eye: V3, look: V3, world: ShotWorld): boolean {
  const d = Math.hypot(look.x - eye.x, look.y - eye.y, look.z - eye.z);
  for (let t = 0; t <= d - 0.6; t += 0.2) {                              // stop short of the subjects themselves
    const f = t / d, x = eye.x + (look.x - eye.x) * f, y = eye.y + (look.y - eye.y) * f, z = eye.z + (look.z - eye.z) * f;
    if (world.solid(x, y, z) || y < world.heightAt(x, z) + 0.2) return false;
  }
  return true;
}

/** Smooth 0→1 easing for the blend between the game camera and the shot. */
export const ease = (k: number) => { const t = Math.min(1, Math.max(0, k)); return t * t * (3 - 2 * t); };
