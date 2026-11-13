// The devs' panel (painel.html): fetches what GitHub's public API says about this repository and draws it. The counting
// is in project-stats.ts. No game code loads here, nothing is sent anywhere but those GET requests, and every string
// from a response goes into the page as text, never as markup.
import { ACCESS, commitStats, GITHUB_API, GITHUB_WEB, PANEL_TIMEZONE, parseCommits, parseRepo, parseTickets, plural, REPO, ticketStats,
  type Commit, type CommitStats, type RepoFacts, type Tally, type TicketStats } from "./project-stats.ts";

const $ = (id: string) => document.getElementById(id)!;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

const CACHE_KEY = "gta:painel:v1";
const CACHE_MS = 5 * 60_000;          // GitHub allows 60 unauthenticated requests an hour per address
const TIMEOUT_MS = 15_000;
const MAX_COMMIT_PAGES = 10;          // 1,000 commits; beyond that the panel says the count is partial

type Raw = { at: number; repo: unknown; commits: unknown[]; commitsPartial: boolean; tickets: unknown };

async function get(path: string): Promise<unknown> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${GITHUB_API}${path}`, { headers: { accept: "application/vnd.github+json" }, credentials: "omit", signal: controller.signal });
    if (r.status === 403 || r.status === 429) throw new Error("O GitHub limitou as consultas deste endereço por alguns minutos.");
    if (!r.ok) throw new Error(`O GitHub respondeu ${r.status}.`);
    return await r.json();
  } catch (e) {
    if (controller.signal.aborted) throw new Error("O GitHub demorou a responder.");
    throw e instanceof TypeError ? new Error("Sem conexão com o GitHub.") : e;
  } finally { clearTimeout(timer); }
}

async function load(fresh: boolean): Promise<Raw> {
  if (!fresh) try {
    const c = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? "null") as Raw | null;
    if (c && Date.now() - c.at < CACHE_MS && Array.isArray(c.commits)) return c;
  } catch { /* no cache: ask again */ }
  const commits: unknown[] = [];
  let partial = false;
  const pages = (async () => {
    for (let page = 1; page <= MAX_COMMIT_PAGES; page++) {
      const batch = await get(`/commits?per_page=100&page=${page}`);
      if (!Array.isArray(batch)) throw new Error("O GitHub respondeu algo inesperado.");
      commits.push(...batch);
      if (batch.length < 100) return;
    }
    partial = true;
  })();
  const [repo, tickets] = await Promise.all([get(""), get("/issues?state=all&per_page=100"), pages]);
  const raw: Raw = { at: Date.now(), repo, commits, commitsPartial: partial, tickets };
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(raw)); } catch { /* shown, not kept */ }
  return raw;
}

const dayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: PANEL_TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const moment = new Intl.DateTimeFormat("pt-BR", { timeZone: PANEL_TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => dayMonth.format(new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso));

function tile(value: string, label: string, detail?: string) {
  const t = el("div", "tile");
  t.append(el("b", undefined, value), el("span", undefined, label));
  if (detail) t.append(el("small", undefined, detail));
  return t;
}

/** A counted list as a table: name, a thin bar from zero, the value. `link` makes the name a GitHub profile link. */
function barTable(title: string, head: [string, string], rows: Tally, unit: [string, string], link = false, empty = "Nada registrado ainda.") {
  const box = el("div");
  box.append(el("h3", undefined, title));
  if (!rows.length) { box.append(el("p", "empty", empty)); return box; }
  const table = el("table", "bars"), max = Math.max(...rows.map((r) => r.count));
  const tr = el("tr"); tr.append(el("th", undefined, head[0]), el("th"), el("th", undefined, head[1]));
  const thead = el("thead"); thead.append(tr);
  const body = el("tbody");
  for (const r of rows) {
    const row = el("tr"); row.title = `${r.name}: ${plural(r.count, unit[0], unit[1])}`;
    const name = el("td");
    if (link) { const a = el("a", undefined, r.name); a.href = `https://github.com/${encodeURIComponent(r.name)}`; a.rel = "noopener"; name.append(a); } else name.textContent = r.name;
    const bar = el("td", "bar"), fill = el("i"); fill.style.width = `${(r.count / max) * 100}%`; bar.append(fill);
    row.append(name, bar, el("td", undefined, r.count.toLocaleString("pt-BR")));
    body.append(row);
  }
  table.append(thead, body); box.append(table);
  return box;
}

function draw(repo: RepoFacts, commits: readonly Commit[], c: CommitStats, t: TicketStats, partial: boolean, at: number) {
  const more = partial ? "+" : "";
  $("kpis").replaceChildren(
    tile(`${c.total.toLocaleString("pt-BR")}${more}`, "commits na branch principal", c.first && c.last ? `${day(c.first)} a ${day(c.last)}` : undefined),
    tile(String(t.prs.total), "pull requests", `${plural(t.prs.merged, "integrado", "integrados")} · ${plural(t.prs.open, "aberto", "abertos")}`),
    tile(String(t.issues.total), "issues", `${plural(t.issues.open, "aberta", "abertas")}`),
    tile(String(t.community.length), t.community.length === 1 ? "pessoa da comunidade" : "pessoas da comunidade", "issues e pull requests de fora"),
    tile(String(repo.stars), repo.stars === 1 ? "estrela" : "estrelas", `${plural(repo.watchers, "acompanhando", "acompanhando")}`),
    tile(String(repo.forks), repo.forks === 1 ? "fork" : "forks"),
  );
  $("quem").replaceChildren(
    barTable("Autoria dos commits", ["Nome no Git", "Commits"], c.byAuthor, ["commit", "commits"]),
    barTable("Coautoria registrada", ["Nome na linha Co-Authored-By", "Commits"], c.byCoauthor, ["commit", "commits"], false, "Nenhum commit com coautoria registrada."),
    barTable("Contas do GitHub", ["Conta", "Commits"], c.accounts, ["commit", "commits"], true),
  );
  $("dias").replaceChildren(barTable("", ["Dia", "Commits"], c.byDay.map((d) => ({ name: day(d.date), count: d.count })), ["commit", "commits"]));
  $("dias").querySelector("h3")?.remove();
  const kinds = el("ul", "chips");
  for (const [n, one, many] of [[t.issues.voluntariado, "candidatura de voluntariado", "candidaturas de voluntariado"], [t.issues.comunidade, "ideia ou relato pelo jogo", "ideias e relatos pelo jogo"],
    [t.issues.outro, "outra issue", "outras issues"]] as const) {
    const li = el("li"); li.append(el("b", undefined, String(n)), document.createTextNode(n === 1 ? one : many)); kinds.append(li);
  }
  $("comunidade").replaceChildren(kinds, barTable("Quem participou", ["Conta", "Issues e PRs"], t.community, ["participação", "participações"], true,
    "Ninguém de fora abriu issue ou pull request ainda."));
  const stamp = $("stamp"); stamp.classList.remove("is-error");
  stamp.textContent = `Dados do GitHub lidos em ${moment.format(new Date(at))} (horário de São Paulo). Último envio ao repositório: ${moment.format(new Date(repo.pushed))}.`
    + (partial ? ` Contagem de commits parcial: só os ${commits.length.toLocaleString("pt-BR")} mais recentes.` : "");
}

async function refresh(fresh = false) {
  const stamp = $("stamp");
  try {
    const raw = await load(fresh);
    const commits = parseCommits(raw.commits);
    draw(parseRepo(raw.repo), commits, commitStats(commits), ticketStats(parseTickets(raw.tickets)), raw.commitsPartial, raw.at);
  } catch (e) {
    stamp.classList.add("is-error");
    stamp.textContent = `Não deu para ler os dados agora. ${e instanceof Error ? e.message : ""}`.trim();
    const again = el("button", undefined, "Tentar de novo"); again.type = "button";
    again.addEventListener("click", () => { stamp.textContent = "Lendo os dados do GitHub…"; stamp.classList.remove("is-error"); void refresh(true); });
    stamp.append(again);
  }
}

/** What is known about visits (project-stats.ts ACCESS): said from the repository's own record, with the day it was
 * checked. Nothing is asked of the server here: there is no number to fetch until a source is connected. */
function accessStatus() {
  const on = ACCESS.source !== null, checked = day(ACCESS.checked);
  const box = el("div", `status ${on ? "is-on" : "is-off"}`); box.id = "access-status"; box.dataset.state = on ? "on" : "off";
  const text = el("div");
  if (on) text.append(el("strong", undefined, "Medição ligada"),
    el("p", undefined, `Fonte: ${ACCESS.source}. Os números ficam nessa fonte; trazê-los para esta página depende de publicar um resumo deles.`));
  else text.append(el("strong", undefined, "Sem medição de acessos"),
    el("p", undefined, `Hoje nenhuma visita ao jogo é contada: o Web Analytics da Vercel não está ativo neste projeto (conferido em ${checked}) e o jogo não tem contador próprio. Por isso não há número de acessos para mostrar. Quando uma fonte de medição for ligada, os números aparecem aqui.`));
  box.append(el("span", "mark", on ? "✓" : "×"), text);
  $("acessos").replaceChildren(box);
}

(document.getElementById("link-repo") as HTMLAnchorElement).href = GITHUB_WEB;
(document.getElementById("link-contribute") as HTMLAnchorElement).href = `${GITHUB_WEB}/blob/main/CONTRIBUTING.md`;
document.title = `Painel do projeto · ${REPO.name.replace(/^-/, "").replace(/-/g, " ")}`;
void refresh();
accessStatus();
