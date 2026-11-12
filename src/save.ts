// Saved progress. One save per browser, versioned, validated on every read, never overwritten by an older build.
// Autosaved by main.ts at every ticked mission, every 15 s of play while the player moves, and when the page is hidden.
// The pure parts (validate, migrate, merge, restore) are tested in test/save.test.ts; merge() is what a cloud copy will
// use to meet the local one without ever losing a finished mission.

export const SAVE_VERSION = 1;
export const SAVE_KEY = "gta:save";
const PREV_KEY = "gta:save:prev";

export type EpisodeProgress = {
  missionsDone: number;           // missions ticked in the current run (episodes are linear)
  completions: number;            // whole episode finished, how many times
  firstCompletedAt: number | null;
  lastCompletedAt: number | null;
};

export type Save = {
  v: typeof SAVE_VERSION;
  id: string;                     // this save's id (for a cloud copy later)
  createdAt: number;              // ms since epoch
  updatedAt: number;
  playSeconds: number;
  episodes: Record<string, EpisodeProgress>;
  current: { episode: string; mission: number; pos: { x: number; z: number }; heading: number } | null;
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isInt = (v: unknown, min = 0): v is number => Number.isInteger(v) && (v as number) >= min;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function randomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newSave(now: number): Save {
  return { v: SAVE_VERSION, id: randomId(), createdAt: now, updatedAt: now, playSeconds: 0, episodes: {}, current: null };
}

export type ReadResult =
  | { kind: "empty" }
  | { kind: "ok"; save: Save }
  | { kind: "newer"; version: number }      // written by a newer build: keep it, do not overwrite
  | { kind: "corrupt"; reason: string };

/** Older versions brought up to the current one. There is only v1 so far; a v2 adds its step here. */
export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  return raw;
}

/** A save as stored (JSON text) -> a checked Save, or why not. */
export function parseSave(text: string | null): ReadResult {
  if (text === null || text === "") return { kind: "empty" };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { kind: "corrupt", reason: "not JSON" }; }
  if (!isObj(raw) || !isInt(raw.v, 1)) return { kind: "corrupt", reason: "no version" };
  if ((raw.v as number) > SAVE_VERSION) return { kind: "newer", version: raw.v as number };
  const s = migrate(raw);
  const bad = (reason: string): ReadResult => ({ kind: "corrupt", reason });
  if (typeof s.id !== "string" || !s.id) return bad("id");
  if (!isNum(s.createdAt) || !isNum(s.updatedAt) || !isNum(s.playSeconds) || (s.playSeconds as number) < 0) return bad("times");
  if (!isObj(s.episodes)) return bad("episodes");
  for (const [k, e] of Object.entries(s.episodes)) {
    if (!isObj(e) || !isInt(e.missionsDone) || !isInt(e.completions)) return bad(`episode ${k}`);
    for (const f of ["firstCompletedAt", "lastCompletedAt"] as const) if (e[f] !== null && !isNum(e[f])) return bad(`episode ${k} ${f}`);
  }
  const c = s.current;
  if (c !== null) {
    if (!isObj(c) || typeof c.episode !== "string" || !isInt(c.mission) || !isNum(c.heading) || !isObj(c.pos) || !isNum(c.pos.x) || !isNum(c.pos.z)) return bad("current");
  }
  return { kind: "ok", save: s as unknown as Save };
}

/** Two copies of the same player's progress (this device and a cloud copy): nothing finished is ever lost. The place
 * to continue from is the most recently updated copy's. */
export function mergeSaves(a: Save, b: Save): Save {
  const newer = b.updatedAt > a.updatedAt ? b : a;
  const episodes: Record<string, EpisodeProgress> = {};
  for (const k of new Set([...Object.keys(a.episodes), ...Object.keys(b.episodes)])) {
    const x = a.episodes[k], y = b.episodes[k];
    if (!x || !y) { episodes[k] = { ...(x ?? y)! }; continue; }
    const min = (p: number | null, q: number | null) => (p === null ? q : q === null ? p : Math.min(p, q));
    const max = (p: number | null, q: number | null) => (p === null ? q : q === null ? p : Math.max(p, q));
    episodes[k] = {
      missionsDone: Math.max(x.missionsDone, y.missionsDone),
      completions: Math.max(x.completions, y.completions),
      firstCompletedAt: min(x.firstCompletedAt, y.firstCompletedAt),
      lastCompletedAt: max(x.lastCompletedAt, y.lastCompletedAt),
    };
  }
  return { ...newer, id: a.id, createdAt: Math.min(a.createdAt, b.createdAt), updatedAt: Math.max(a.updatedAt, b.updatedAt),
    playSeconds: Math.max(a.playSeconds, b.playSeconds), episodes };
}

export function episodeProgress(s: Save, episode: string): EpisodeProgress {
  return s.episodes[episode] ?? { missionsDone: 0, completions: 0, firstCompletedAt: null, lastCompletedAt: null };
}

/** Records a ticked mission (index, 0-based) of an episode with `total` missions. */
export function recordMission(s: Save, episode: string, mission: number, total: number, now: number): Save {
  const e = { ...episodeProgress(s, episode) };
  e.missionsDone = Math.max(e.missionsDone, mission + 1);
  if (mission === total - 1) {
    e.completions += 1;
    e.firstCompletedAt ??= now;
    e.lastCompletedAt = now;
  }
  return { ...s, episodes: { ...s.episodes, [episode]: e }, updatedAt: now };
}

/** A new run of an episode: its missions start over, its record (completions, dates) stays. */
export function restartEpisode(s: Save, episode: string, now: number): Save {
  const e = { ...episodeProgress(s, episode), missionsDone: 0 };
  return { ...s, episodes: { ...s.episodes, [episode]: e }, current: null, updatedAt: now };
}

// ---------------------------------------------------------------- the browser's copy

type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

export class LocalSaveStore {
  /** "ok": saving works; "unavailable": the browser refuses storage (private mode, blocked site data); "newer": the
   * stored save comes from a newer build, which this build must not overwrite. */
  status: "ok" | "unavailable" | "newer" = "ok";
  private kv: KV | null;
  private persisted = false;

  constructor(kv?: KV | null) {
    try { this.kv = kv ?? globalThis.localStorage ?? null; } catch { this.kv = null; }
    if (!this.kv) this.status = "unavailable";
  }

  /** The stored save; a corrupt one is kept aside under another key (never deleted) and a fresh save starts. */
  load(now: number): Save {
    if (!this.kv) return newSave(now);
    let text: string | null = null;
    try { text = this.kv.getItem(SAVE_KEY); } catch { this.status = "unavailable"; return newSave(now); }
    const r = parseSave(text);
    if (r.kind === "ok") return r.save;
    if (r.kind === "newer") { this.status = "newer"; return newSave(now); }
    if (r.kind === "corrupt") {
      try { this.kv.setItem(`${SAVE_KEY}:corrupt:${now}`, text ?? ""); } catch { /* nothing more to do */ }
      // the previous good copy, if there is one
      try { const prev = parseSave(this.kv.getItem(PREV_KEY)); if (prev.kind === "ok") return prev.save; } catch { /* ignore */ }
    }
    return newSave(now);
  }

  /** Writes the save, keeping the last good copy aside. False when it could not be written. */
  write(s: Save): boolean {
    if (!this.kv || this.status !== "ok") return false;
    try {
      const old = this.kv.getItem(SAVE_KEY);
      if (old && parseSave(old).kind === "ok") this.kv.setItem(PREV_KEY, old);
      this.kv.setItem(SAVE_KEY, JSON.stringify(s));
    } catch {
      this.status = "unavailable";
      return false;
    }
    if (!this.persisted) {
      this.persisted = true;
      // ask the browser not to evict this site's storage under pressure (it may say no)
      const st = (globalThis.navigator as { storage?: { persist?: () => Promise<boolean> } } | undefined)?.storage;
      st?.persist?.().catch(() => false);
    }
    return true;
  }

  clear() {
    if (!this.kv) return;
    try { const old = this.kv.getItem(SAVE_KEY); if (old) this.kv.setItem(PREV_KEY, old); this.kv.removeItem(SAVE_KEY); } catch { /* ignore */ }
  }
}
