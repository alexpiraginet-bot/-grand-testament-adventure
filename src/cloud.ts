// The cloud copy of the save, with no account: each player holds a recovery code (160 random bits, shown as
// XXXX-XXXX-…); the server keeps only its SHA-256 and is reached through two RPC functions
// (supabase/migrations/*_gta_saves_v1.sql). Plain fetch, no SDK. Off until src/data/nuvem.json says enabled.
import { mergeSaves, parseSave, type Save } from "./save.ts";

export type CloudConfig = { enabled: boolean; url: string; key: string };
export type NickAnswer = "livre" | "ocupado" | "formato" | "reservado" | "ofensivo";

/** The same format rule as the server (gta_nick_problem), to answer at once while the player types. */
export const nickFormatOk = (nick: string) => /^[A-Za-z0-9_.À-ÖØ-öø-ÿ]{3,16}$/.test(nick);

export const NICK_MESSAGE: Record<NickAnswer | "ok" | "sem-save", string> = {
  livre: "Disponível.", ok: "Apelido salvo.", ocupado: "Esse apelido já tem dono.",
  formato: "Use de 3 a 16 letras, números, _ ou ponto, sem espaço.", reservado: "Esse nome é reservado. Escolha outro.",
  ofensivo: "Escolha outro apelido.", "sem-save": "Jogue um pouco antes: o apelido fica junto do seu progresso.",
};
type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";      // Crockford base32: no I, L, O, U

/** A new recovery code: 32 characters of Crockford base32 (160 bits). */
export function newCode(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = random(20);
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  return out;
}

/** What the player typed -> the code, forgiving spaces, dashes, case and the letters people confuse; null if invalid. */
export function normalizeCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  return s.length === 32 && [...s].every((c) => ALPHABET.includes(c)) ? s : null;
}

export const formatCode = (code: string) => code.match(/.{1,4}/g)!.join("-");

export class Cloud {
  private cfg: CloudConfig;
  private fetchImpl: Fetch;
  constructor(cfg: CloudConfig, fetchImpl: Fetch = (i, o) => fetch(i, o)) { this.cfg = cfg; this.fetchImpl = fetchImpl; }

  get enabled() { return this.cfg.enabled && !!this.cfg.url && !!this.cfg.key; }

  private async rpc(name: string, body: unknown, keepalive = false): Promise<unknown> {
    const r = await this.fetchImpl(`${this.cfg.url}/rest/v1/rpc/${name}`, {
      method: "POST", keepalive,
      headers: { apikey: this.cfg.key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    return r.json();
  }

  /** The cloud copy for a code: a checked Save and its nickname, null when there is none, or an error when
   * unreachable or invalid. */
  async get(code: string): Promise<{ save: Save; nick: string | null } | null> {
    const data = (await this.rpc("gta_save_get", { p_code: code })) as { save?: unknown; nick?: unknown } | null;
    if (data === null) return null;
    const r = parseSave(JSON.stringify(data.save ?? null));
    if (r.kind !== "ok") throw new Error(`cloud save ${r.kind}`);
    return { save: r.save, nick: typeof data.nick === "string" ? data.nick : null };
  }

  /** Whether a nickname can be taken: "livre", "ocupado", "formato", "reservado" or "ofensivo" (decided by the server). */
  async nickCheck(nick: string): Promise<NickAnswer> {
    return (await this.rpc("gta_nick_check", { p_nick: nick })) as NickAnswer;
  }

  /** Gives this code's save a nickname. The save must be in the cloud already (put first). */
  async nickSet(code: string, nick: string): Promise<NickAnswer | "ok" | "sem-save"> {
    return (await this.rpc("gta_nick_set", { p_code: code, p_nick: nick })) as NickAnswer | "ok" | "sem-save";
  }

  async put(code: string, save: Save, keepalive = false): Promise<void> {
    await this.rpc("gta_save_put", { p_code: code, p_data: save }, keepalive);
  }
}

export type SyncResult = { save: Save; status: "synced" | "offline"; nick?: string | null; error?: string };

/** Pull, merge, push: the local and the cloud copies meet (nothing finished is lost) and both end the same. */
export async function syncOnce(local: Save, code: string, cloud: Cloud): Promise<SyncResult> {
  try {
    const remote = await cloud.get(code);
    const merged = remote ? mergeSaves(local, remote.save) : local;
    await cloud.put(code, merged);
    return { save: merged, status: "synced", nick: remote?.nick ?? null };
  } catch (e) {
    return { save: local, status: "offline", error: String(e) };
  }
}
