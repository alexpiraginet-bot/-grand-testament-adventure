// What the player changed in the world, saved apart from the progress save: which encounters were accepted, whose
// object was put in its place, which were completed. It is a record of its own on purpose (the plan,
// docs/INTERACOES-E-ENCONTROS.md): the progress save (save.ts, v1) is shared with the cloud copy and is not touched.
// One record per save id, versioned, validated on every read, never overwritten by an older build, the previous good
// copy kept aside. Only facts are stored: stable stages and when; no pose, timer or position. Local only: nothing
// here syncs between devices. Pure parts and the store are tested in test/world-state.test.ts; main.ts does not use
// it yet (docs/ENCONTROS-BASE.md).
import { STABLE_ORDER, type StableStage } from "./encounters.ts";

export const WORLD_STATE_VERSION = 1;
export const worldStateKey = (saveId: string) => `gta:world-state:v${WORLD_STATE_VERSION}:${saveId}`;
/** Bounds a stored record must respect to be read at all. */
export const WORLD_STATE_LIMITS = { bytes: 64 * 1024, encounters: 500, idLength: 80 } as const;

export type WorldState = {
  v: typeof WORLD_STATE_VERSION;
  saveId: string;
  /** The revision of the content the stages refer to, as the game names it when it writes. */
  contentRevision: string;
  encounters: Record<string, { stage: StableStage; at: number }>;
};

export type WorldRead =
  | { kind: "empty" }
  | { kind: "ok"; state: WorldState }
  | { kind: "newer"; version: number }      // written by a newer build: keep it, do not overwrite
  | { kind: "corrupt"; reason: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStage = (v: unknown): v is StableStage => typeof v === "string" && (STABLE_ORDER as readonly string[]).includes(v);

export const newWorldState = (saveId: string, contentRevision: string): WorldState => ({ v: WORLD_STATE_VERSION, saveId, contentRevision, encounters: {} });

/** A record as stored (JSON text) -> a checked WorldState for this save, or why not. */
export function parseWorldState(text: string | null, saveId: string): WorldRead {
  if (text === null || text === "") return { kind: "empty" };
  const bad = (reason: string): WorldRead => ({ kind: "corrupt", reason });
  if (text.length > WORLD_STATE_LIMITS.bytes) return bad("too large");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return bad("not JSON"); }
  if (!isObj(raw) || !Number.isInteger(raw.v) || (raw.v as number) < 1) return bad("no version");
  if ((raw.v as number) > WORLD_STATE_VERSION) return { kind: "newer", version: raw.v as number };
  if (raw.saveId !== saveId) return bad("another save's record");
  if (typeof raw.contentRevision !== "string" || !raw.contentRevision || raw.contentRevision.length > WORLD_STATE_LIMITS.idLength) return bad("contentRevision");
  if (!isObj(raw.encounters)) return bad("encounters");
  const entries = Object.entries(raw.encounters);
  if (entries.length > WORLD_STATE_LIMITS.encounters) return bad("too many encounters");
  const encounters: WorldState["encounters"] = {};
  for (const [id, e] of entries) {
    if (!id || id.length > WORLD_STATE_LIMITS.idLength) return bad("encounter id");
    if (!isObj(e) || !isStage(e.stage) || typeof e.at !== "number" || !Number.isFinite(e.at)) return bad(`encounter ${id}`);
    encounters[id] = { stage: e.stage, at: e.at };
  }
  return { kind: "ok", state: { v: WORLD_STATE_VERSION, saveId, contentRevision: raw.contentRevision, encounters } };
}

/** The encounter's saved stage (null when it was never accepted). */
export const savedStage = (s: WorldState, id: string): StableStage | null => s.encounters[id]?.stage ?? null;

/** Records that an encounter reached a stage. Stages only go forward (accepted, returned, completed): recording the
 * stage it already has, or an earlier one, changes nothing and returns the same object, so a repeated event can never
 * undo a completion or move its date. */
export function recordStage(s: WorldState, id: string, stage: StableStage, now: number): WorldState {
  const had = s.encounters[id];
  if (had && STABLE_ORDER.indexOf(stage) <= STABLE_ORDER.indexOf(had.stage)) return s;
  return { ...s, encounters: { ...s.encounters, [id]: { stage, at: now } } };
}

type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

export class WorldStateStore {
  /** "ok": saving works; "unavailable": the browser refuses storage, so what is done counts for this visit only and the
   * game should say so; "newer": the stored record comes from a newer build, which this build must not overwrite. */
  status: "ok" | "unavailable" | "newer" = "ok";
  private kv: KV | null;

  constructor(kv?: KV | null) {
    try { this.kv = kv ?? globalThis.localStorage ?? null; } catch { this.kv = null; }
    if (!this.kv) this.status = "unavailable";
  }

  /** The stored record for this save. A corrupt one is kept aside under another key (never deleted) and the previous
   * good copy is used if there is one; otherwise an empty record. */
  load(saveId: string, contentRevision: string, now: number): WorldState {
    if (!this.kv) return newWorldState(saveId, contentRevision);
    const key = worldStateKey(saveId);
    let text: string | null = null;
    try { text = this.kv.getItem(key); } catch { this.status = "unavailable"; return newWorldState(saveId, contentRevision); }
    const r = parseWorldState(text, saveId);
    if (r.kind === "ok") return r.state;
    if (r.kind === "newer") { this.status = "newer"; return newWorldState(saveId, contentRevision); }
    if (r.kind === "corrupt") {
      try { this.kv.setItem(`${key}:corrupt:${now}`, text ?? ""); } catch { /* nothing more to do */ }
      try { const prev = parseWorldState(this.kv.getItem(`${key}:prev`), saveId); if (prev.kind === "ok") return prev.state; } catch { /* ignore */ }
    }
    return newWorldState(saveId, contentRevision);
  }

  /** Writes the record under the content revision in use, keeping the last good copy aside. False when it could not be
   * written (and then the status says why). */
  write(s: WorldState, contentRevision: string = s.contentRevision): boolean {
    if (!this.kv || this.status !== "ok") return false;
    const key = worldStateKey(s.saveId);
    try {
      const old = this.kv.getItem(key);
      if (old && parseWorldState(old, s.saveId).kind === "ok") this.kv.setItem(`${key}:prev`, old);
      this.kv.setItem(key, JSON.stringify({ ...s, contentRevision }));
    } catch {
      this.status = "unavailable";
      return false;
    }
    return true;
  }
}
