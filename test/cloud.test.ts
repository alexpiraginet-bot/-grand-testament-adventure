// The cloud copy, against a fake server that behaves like the two RPC functions of the migration.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Cloud, formatCode, newCode, normalizeCode, syncOnce } from "../src/cloud.ts";
import { newSave, recordMission } from "../src/save.ts";

function fakeServer() {
  const rows = new Map<string, unknown>();
  const calls: { name: string; body: Record<string, unknown>; apikey: string | null }[] = [];
  let down = false;
  const fetchImpl = async (url: string, init?: RequestInit) => {
    if (down) throw new TypeError("Failed to fetch");
    const name = url.split("/rpc/")[1];
    const body = JSON.parse(String(init?.body));
    calls.push({ name, body, apikey: (init?.headers as Record<string, string>).apikey ?? null });
    const code = body.p_code as string;
    if (code.length < 32 || code.length > 64) return new Response(JSON.stringify({ message: "invalid code" }), { status: 400 });
    const h = createHash("sha256").update(code).digest("hex");
    if (name === "gta_save_get") return new Response(JSON.stringify(rows.get(h) ?? null), { status: 200 });
    rows.set(h, body.p_data);
    return new Response(JSON.stringify(new Date().toISOString()), { status: 200 });
  };
  return { rows, calls, fetchImpl, setDown: (v: boolean) => { down = v; } };
}

const cfg = { enabled: true, url: "https://example.supabase.co", key: "sb_publishable_test" };

test("codes: 32 characters, 160 bits, typed back however the player writes them", () => {
  const c = newCode();
  assert.match(c, /^[0-9A-HJKMNP-TV-Z]{32}$/);
  assert.notEqual(newCode(), c);
  const shown = formatCode(c);
  assert.equal(shown.split("-").length, 8);
  assert.equal(normalizeCode(shown.toLowerCase()), c);
  assert.equal(normalizeCode(` ${shown} `), c);
  assert.equal(normalizeCode("O".repeat(32)), "0".repeat(32));     // O typed for zero
  assert.equal(normalizeCode("L".repeat(32)), "1".repeat(32));
  assert.equal(normalizeCode("ABC"), null);
  assert.equal(normalizeCode("U".repeat(32)), null);
  // all 256 values of every byte reach the alphabet evenly enough: no character is missing over many codes
  const seen = new Set(Array.from({ length: 200 }, () => newCode()).join(""));
  assert.equal(seen.size, 32);
});

test("the server only ever sees the code, never stores it, and the key goes in the apikey header", async () => {
  const s = fakeServer(), cloud = new Cloud(cfg, s.fetchImpl), code = newCode();
  await cloud.put(code, recordMission(newSave(1), "mc-pescadores", 0, 3, 2));
  assert.equal(s.calls[0].apikey, cfg.key);
  assert.ok(![...s.rows.keys()].includes(code));
  const back = await cloud.get(code);
  assert.equal(back?.episodes["mc-pescadores"].missionsDone, 1);
  assert.equal(await cloud.get(newCode()), null);
});

test("sync merges both copies and leaves them equal", async () => {
  const s = fakeServer(), cloud = new Cloud(cfg, s.fetchImpl), code = newCode();
  const phone = recordMission(recordMission(newSave(10), "mc-pescadores", 0, 3, 20), "mc-pescadores", 1, 3, 30);
  await cloud.put(code, phone);
  const pc = recordMission(newSave(5), "mc-pescadores", 0, 3, 40);          // behind, but newer
  const r = await syncOnce(pc, code, cloud);
  assert.equal(r.status, "synced");
  assert.equal(r.save.episodes["mc-pescadores"].missionsDone, 2);          // the phone's mission is not lost
  assert.deepEqual(await cloud.get(code), r.save);
});

test("without a connection the game keeps the local copy and says offline", async () => {
  const s = fakeServer(), cloud = new Cloud(cfg, s.fetchImpl);
  s.setDown(true);
  const local = recordMission(newSave(1), "mc-pescadores", 0, 3, 2);
  const r = await syncOnce(local, newCode(), cloud);
  assert.equal(r.status, "offline");
  assert.equal(r.save, local);
});

test("a broken cloud copy is refused, not merged", async () => {
  const s = fakeServer(), cloud = new Cloud(cfg, s.fetchImpl), code = newCode();
  s.rows.set(createHash("sha256").update(code).digest("hex"), { v: 1, nonsense: true });
  const local = newSave(1);
  const r = await syncOnce(local, code, cloud);
  assert.equal(r.status, "offline");
  assert.equal(r.save, local);
});

test("the cloud stays off until it is configured and switched on", () => {
  const nuvem = JSON.parse(readFileSync(new URL("../src/data/nuvem.json", import.meta.url)).toString());
  assert.equal(new Cloud({ ...nuvem, enabled: false }).enabled, false);
  assert.equal(new Cloud({ enabled: true, url: "", key: "" }).enabled, false);
});
