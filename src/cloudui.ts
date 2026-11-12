// The "Continuar em outro aparelho" panel: shows this device's recovery code and takes a code from another device.
import { formatCode, nickFormatOk, normalizeCode } from "./cloud.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export type CloudPanel = {
  /** This device's code, creating it (and the first cloud copy) when there is none yet. */
  ensureCode: () => Promise<string | null>;
  /** Fetches the save of another device's code and makes it this device's: "ok", "notfound" or "offline". */
  useCode: (code: string) => Promise<"ok" | "notfound" | "offline">;
  onRestored: () => void;
  nick: () => string | null;
  /** The server's answer for a nickname being typed, as a message for the player. */
  checkNick: (nick: string) => Promise<string>;
  /** Saves the nickname; the message for the player and whether it was saved. */
  setNick: (nick: string) => Promise<{ ok: boolean; message: string }>;
};

export function setupCloudPanel(p: CloudPanel) {
  const panel = $("nuvem"), msg = $("nmsg"), code = $("ncode"), input = $<HTMLInputElement>("nin");
  $("outro").hidden = false;
  $("outro").addEventListener("click", async () => {
    panel.hidden = false; msg.textContent = ""; code.textContent = "…";
    try {
      const c = await p.ensureCode();
      code.textContent = c ? formatCode(c) : "Seu código aparece quando você terminar a primeira missão.";
    }
    catch { code.textContent = "Sem conexão agora: o código aparece quando a internet voltar."; }
  });
  $("nclose").addEventListener("click", () => { panel.hidden = true; });
  // nickname: format checked at once, availability asked to the server after a short pause
  const nick = $<HTMLInputElement>("nick"), nmsg = $("nickmsg");
  let timer: ReturnType<typeof setTimeout> | undefined;
  $("outro").addEventListener("click", () => { nick.value = p.nick() ?? ""; nmsg.textContent = p.nick() ? `Você joga como ${p.nick()}.` : ""; });
  nick.addEventListener("input", () => {
    clearTimeout(timer);
    const v = nick.value.trim();
    if (!v) { nmsg.textContent = ""; return; }
    if (!nickFormatOk(v)) { nmsg.textContent = "Use de 3 a 16 letras, números, _ ou ponto, sem espaço."; return; }
    if (v === p.nick()) { nmsg.textContent = `Você joga como ${v}.`; return; }
    nmsg.textContent = "Conferindo…";
    timer = setTimeout(async () => { const m = await p.checkNick(v); if (nick.value.trim() === v) nmsg.textContent = m; }, 450);
  });
  $("nicksave").addEventListener("click", async () => {
    const v = nick.value.trim();
    if (!nickFormatOk(v)) { nmsg.textContent = "Use de 3 a 16 letras, números, _ ou ponto, sem espaço."; return; }
    nmsg.textContent = "Salvando…";
    const r = await p.setNick(v);
    nmsg.textContent = r.message;
    if (r.ok) p.onRestored();
  });
  $("ncopy").addEventListener("click", async () => {
    const text = code.textContent ?? "";
    try { await navigator.clipboard.writeText(text); msg.textContent = "Código copiado."; }
    catch {
      const r = document.createRange(); r.selectNodeContents(code);
      const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r);
      msg.textContent = "Selecionei o código: copie com o menu do aparelho.";
    }
  });
  $("nuse").addEventListener("click", async () => {
    const c = normalizeCode(input.value);
    if (!c) { msg.textContent = "Esse código não tem o formato certo: são 32 letras e números."; return; }
    msg.textContent = "Procurando…";
    const r = await p.useCode(c);
    if (r === "ok") { msg.textContent = "Progresso recuperado."; input.value = ""; p.onRestored(); setTimeout(() => { panel.hidden = true; }, 900); }
    else if (r === "notfound") msg.textContent = "Não achei progresso com esse código. Confira as letras.";
    else msg.textContent = "Sem conexão agora. Tente de novo em instantes.";
  });
}
