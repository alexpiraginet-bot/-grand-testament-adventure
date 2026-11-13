// The Bible's panel (the logic is in bible.ts). A modal dialog in the non-game palette (ui-theme.css). Opening it
// pauses the game and is how the player learns the next step: main.ts is told which step was read. Everything shown
// comes from the data: the passage's verses from the episode file, the reading order from biblia-cronologica.json.
import "./bible.css";
import { verseStates, type BibleEntry, type BibleMoment, type BibleStep, type VerseState } from "./bible.ts";
import type { EpisodeData } from "./missions.ts";

export type BibleOptions = {
  episode: EpisodeData;
  steps: readonly BibleStep[];
  entries: readonly BibleEntry[];
  /** The moment the passage follows in the order and the gospel whose order put it there (bible.ts readingOrder). */
  after: BibleMoment | null; gospelName: string | null;
  /** The step being played (steps.length when the whole passage was lived). */
  current: () => number;
  canOpen: () => boolean;
  onOpenChange: (open: boolean) => void;
  /** The Bible was opened while this step was the next one. */
  onRead: (step: number) => void;
  /** The BLIVRE notice (attribution.json) and the source line of the reading order. */
  notice: string; orderSource: string;
};

const STATE_LABEL: Record<VerseState, string> = { vivido: "Vivido", agora: "Agora", "a-seguir": "A seguir" };

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export function setupBible(o: BibleOptions) {
  const dialog = el("dialog", "bible-dialog"); dialog.id = "biblia";
  dialog.setAttribute("aria-labelledby", "bible-heading");
  const header = el("header", "bible-header"), block = el("div");
  const heading = el("h2", undefined, "Bíblia"); heading.id = "bible-heading"; heading.tabIndex = -1;
  block.append(el("p", "bible-eyebrow", "Leitura em ordem · Bíblia Conectada"), heading);
  const closeButton = el("button", undefined, "Voltar ao jogo"); closeButton.type = "button"; closeButton.id = "bible-close";
  header.append(block, closeButton);
  const body = el("div", "bible-body");
  const footer = el("footer", "bible-footer");
  footer.append(el("p", undefined, o.notice), el("p", undefined, o.orderSource));
  dialog.append(header, body, footer);
  document.body.append(dialog);

  const verseLine = (n: number, text: string, state?: VerseState) => {
    const p = el("p", `bible-verse${state ? ` is-${state}` : ""}`);
    p.append(el("sup", undefined, String(n)), document.createTextNode(text));
    if (state) { p.dataset.state = state; p.append(el("span", "bible-state", STATE_LABEL[state])); }
    return p;
  };
  const number = (key: string) => Number(key.split(".")[2]);

  function render() {
    const current = o.current(), step = o.steps[current];
    body.replaceChildren();

    // 1. the next step: the verses that tell it, then what the game asks for
    const next = el("section", "bible-next"); next.id = "bible-next";
    const nextH = el("h3", undefined, step ? "Próximo passo" : "Passagem vivida"); nextH.id = "bible-next-h";
    next.setAttribute("aria-labelledby", nextH.id);
    next.append(nextH);
    if (step) {
      const ref = el("p", "bible-ref", step.ref); ref.id = "bible-next-ref";
      const quote = el("blockquote"); quote.id = "bible-next-text";
      for (const k of step.verses) quote.append(verseLine(number(k), o.episode.versiculos[k]));
      const task = el("p", "bible-do"); task.id = "bible-next-do";
      task.append(el("span", undefined, "No jogo"), document.createTextNode(step.objetivo));
      next.append(ref, quote, task);
    } else {
      next.append(el("p", "bible-lived", "Esta passagem foi vivida até o fim. As passagens seguintes da leitura ainda não são jogáveis nesta versão."));
    }
    body.append(next);

    // 2. the story in order, the played passage in its place
    const order = el("section", "bible-order");
    const orderH = el("h3", undefined, "A história em ordem"); orderH.id = "bible-order-h";
    order.setAttribute("aria-labelledby", orderH.id);
    const why = o.after && o.gospelName
      ? ` Esta passagem aparece depois de “${o.after.titulo}” pela ordem de ${o.gospelName}; a relação exata com os relatos dos outros evangelhos não é fixada.`
      : "";
    order.append(orderH, el("p", "bible-note", `Roteiro de leitura do Bíblia Conectada: uma ordem editorial ampla, não uma cronologia histórica harmonizada.${why}`));
    const list = el("ol", "bible-list");
    const states = verseStates(o.steps, current);
    for (const e of o.entries) {
      const li = el("li", e.kind === "episodio" ? "bible-entry is-here" : `bible-entry is-${e.when}`);
      if (e.kind === "episodio") {
        li.id = "bible-here";
        const head = el("div", "bible-entry-head");
        head.append(el("span", "bible-tag", step ? "Você está aqui" : "Vivida"), el("strong", undefined, e.titulo), el("span", "bible-where", `${e.lugar} · ${e.ref}`));
        li.append(head);
        for (const k of Object.keys(o.episode.versiculos)) {
          const state = states.get(k);
          if (state) li.append(verseLine(number(k), o.episode.versiculos[k], state));
        }
      } else {
        const m = e.moment, details = el("details"), summary = el("summary");
        summary.append(el("span", "bible-tag", e.when === "antes" ? "Antes desta passagem" : "Ainda não jogável"),
          el("strong", undefined, m.titulo), el("span", "bible-where", `${m.fase} · ${m.lugar} · ${m.ref}`));
        details.append(summary);
        for (const v of m.versiculos) details.append(verseLine(v.n, v.texto));
        const others = m.passagens.filter((p) => p.ref !== m.ref).map((p) => p.ref);
        if (others.length) details.append(el("p", "bible-others", `Também em: ${others.join(" · ")}.`));
        li.append(details);
      }
      list.append(li);
    }
    order.append(list);
    body.append(order);
  }

  const anotherOverlay = () => Array.from(document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"]:not([hidden]), [role="menu"]:not([hidden])'))
    .some((e) => e !== dialog && e.getClientRects().length > 0);
  let suspended = false, opener: HTMLElement | null = null;
  function open() {
    if (dialog.open || !o.canOpen() || anotherOverlay()) return;
    // focus goes back to what opened it only for a keyboard user; a mouse or touch opener is left unfocused, because a
    // focused button swallows the action key (input.ts)
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    opener = active?.matches(":focus-visible") ? active : null;
    render();
    document.exitPointerLock?.(); dialog.showModal(); suspended = true; o.onOpenChange(true);
    const current = o.current();
    if (current < o.steps.length) o.onRead(current);
    body.scrollTop = 0; heading.focus();
  }
  function resume() {
    if (!suspended) return;
    suspended = false; o.onOpenChange(false);
    if (opener?.isConnected) opener.focus({ preventScroll: true });
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
  const close = () => { dialog.close(); resume(); };
  closeButton.addEventListener("click", close);
  dialog.addEventListener("cancel", (event) => { event.preventDefault(); close(); });
  dialog.addEventListener("close", resume);
  addEventListener("keydown", (event) => {
    if (event.code !== "KeyB" || event.repeat || event.ctrlKey || event.metaKey || event.altKey
      || (event.target instanceof Element && event.target.closest("input,textarea,select,[contenteditable]"))) return;
    if (dialog.open) { event.preventDefault(); close(); } else if (o.canOpen() && !anotherOverlay()) { event.preventDefault(); open(); }
  });
  return { open, isOpen: () => dialog.open };
}
