// The project's numbers for the devs' panel (painel.html): who contributed and how much, from what GitHub's public
// API answers for this repository when the page opens. Parsing and counting only (test/project-stats.test.ts runs it
// on recorded responses of this repository); src/painel.ts fetches and draws. An e-mail address is never read out of
// a response: names are the commit's author name and the name before "<" in a Co-Authored-By trailer.

export const REPO = { owner: "alexpiraginet-bot", name: "-grand-testament-adventure" } as const;
export const GITHUB_API = `https://api.github.com/repos/${REPO.owner}/${REPO.name}`;
export const GITHUB_WEB = `https://github.com/${REPO.owner}/${REPO.name}`;
/** The day a commit or an issue belongs to is the day in São Paulo, where the project is run. */
export const PANEL_TIMEZONE = "America/Sao_Paulo";
/** The titles the two issue forms start with (.github/ISSUE_TEMPLATE). */
export const ISSUE_PREFIX = { voluntariado: "[Voluntariado]", comunidade: "[Comunidade]" } as const;

export type Tally = { name: string; count: number }[];
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, what: string): string => { if (typeof v !== "string" || !v) throw new Error(`GitHub: ${what}`); return v; };
const count = (v: unknown, what: string): number => { if (!Number.isInteger(v) || (v as number) < 0) throw new Error(`GitHub: ${what}`); return v as number; };
const when = (v: unknown, what: string): string => { const s = str(v, what); if (!Number.isFinite(Date.parse(s))) throw new Error(`GitHub: ${what}`); return s; };

/** name -> count, most first; ties by name, so the order is stable. */
function tally(names: Iterable<string>): Tally {
  const m = new Map<string, number>();
  for (const n of names) m.set(n, (m.get(n) ?? 0) + 1);
  return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
}

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: PANEL_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
/** "2026-11-13T01:10:00Z" -> "2026-11-12": the calendar day in São Paulo. */
export const localDay = (iso: string): string => dayFormat.format(new Date(iso));

// ---------------------------------------------------------------- commits

export type Commit = { sha: string; date: string; author: string; login: string | null; coauthors: string[]; subject: string };

/** The names in a message's Co-Authored-By trailers, without their e-mail addresses; each once. */
export function coAuthors(message: string): string[] {
  const names = new Set<string>();
  for (const m of message.matchAll(/^co-authored-by:[ \t]*([^<\r\n]*?)[ \t]*(?:<[^>\r\n]*>)?[ \t]*$/gim)) if (m[1]) names.add(m[1]);
  return [...names];
}

/** GET /repos/{owner}/{repo}/commits -> what the panel counts. Throws on a response that is not that list. */
export function parseCommits(raw: unknown): Commit[] {
  if (!Array.isArray(raw)) throw new Error("GitHub: commits is not a list");
  return raw.map((c, i) => {
    if (!isObj(c) || !isObj(c.commit) || !isObj(c.commit.author)) throw new Error(`GitHub: commit ${i}`);
    const message = typeof c.commit.message === "string" ? c.commit.message : "";
    return {
      sha: str(c.sha, `commit ${i} sha`), date: when(c.commit.author.date, `commit ${i} date`), author: str(c.commit.author.name, `commit ${i} author`),
      login: isObj(c.author) && typeof c.author.login === "string" ? c.author.login : null,
      coauthors: coAuthors(message), subject: message.split("\n")[0].slice(0, 120),
    };
  });
}

export type CommitStats = { total: number; first: string | null; last: string | null; byAuthor: Tally; byCoauthor: Tally; accounts: Tally; byDay: { date: string; count: number }[] };

export function commitStats(commits: readonly Commit[]): CommitStats {
  const dates = commits.map((c) => c.date).sort();
  const days = tally(commits.map((c) => localDay(c.date))).map(({ name, count }) => ({ date: name, count })).sort((a, b) => a.date.localeCompare(b.date));
  return {
    total: commits.length, first: dates[0] ?? null, last: dates[dates.length - 1] ?? null,
    byAuthor: tally(commits.map((c) => c.author)),
    byCoauthor: tally(commits.flatMap((c) => c.coauthors)),
    accounts: tally(commits.flatMap((c) => (c.login ? [c.login] : []))),
    byDay: days,
  };
}

// ---------------------------------------------------------------- issues and pull requests

export type TicketKind = "pr" | "voluntariado" | "comunidade" | "outro";
export type Ticket = { number: number; title: string; open: boolean; login: string; created: string; kind: TicketKind; merged: boolean };

/** GET /repos/{owner}/{repo}/issues?state=all (issues and pull requests together, as GitHub lists them). */
export function parseTickets(raw: unknown): Ticket[] {
  if (!Array.isArray(raw)) throw new Error("GitHub: issues is not a list");
  return raw.map((t, i) => {
    if (!isObj(t) || !isObj(t.user)) throw new Error(`GitHub: issue ${i}`);
    const title = str(t.title, `issue ${i} title`);
    const pr = isObj(t.pull_request) ? t.pull_request : null;
    const kind: TicketKind = pr ? "pr" : title.startsWith(ISSUE_PREFIX.voluntariado) ? "voluntariado" : title.startsWith(ISSUE_PREFIX.comunidade) ? "comunidade" : "outro";
    if (t.state !== "open" && t.state !== "closed") throw new Error(`GitHub: issue ${i} state`);
    return { number: count(t.number, `issue ${i} number`), title, open: t.state === "open", login: str(t.user.login, `issue ${i} author`),
      created: when(t.created_at, `issue ${i} date`), kind, merged: !!pr && typeof pr.merged_at === "string" && pr.merged_at !== "" };
  });
}

export type TicketStats = {
  issues: { total: number; open: number; voluntariado: number; comunidade: number; outro: number };
  prs: { total: number; open: number; merged: number };
  /** Accounts other than the repository's own that opened an issue or a pull request, with how many. */
  community: Tally;
};

export function ticketStats(tickets: readonly Ticket[], owner: string = REPO.owner): TicketStats {
  const issues = tickets.filter((t) => t.kind !== "pr"), prs = tickets.filter((t) => t.kind === "pr");
  const of = (k: TicketKind) => issues.filter((t) => t.kind === k).length;
  return {
    issues: { total: issues.length, open: issues.filter((t) => t.open).length, voluntariado: of("voluntariado"), comunidade: of("comunidade"), outro: of("outro") },
    prs: { total: prs.length, open: prs.filter((t) => t.open).length, merged: prs.filter((t) => t.merged).length },
    community: tally(tickets.filter((t) => t.login.toLowerCase() !== owner.toLowerCase()).map((t) => t.login)),
  };
}

// ---------------------------------------------------------------- the repository itself

export type RepoFacts = { stars: number; forks: number; watchers: number; created: string; pushed: string };

/** GET /repos/{owner}/{repo}. "watchers" is subscribers_count (people watching), not the legacy watchers_count. */
export function parseRepo(raw: unknown): RepoFacts {
  if (!isObj(raw)) throw new Error("GitHub: repository");
  return { stars: count(raw.stargazers_count, "stars"), forks: count(raw.forks_count, "forks"), watchers: count(raw.subscribers_count, "watchers"),
    created: when(raw.created_at, "created_at"), pushed: when(raw.pushed_at, "pushed_at") };
}

/** Portuguese plural for a counted noun: 1 commit, 2 commits; 1 pessoa, 0 pessoas. */
export const plural = (n: number, one: string, many: string): string => `${n.toLocaleString("pt-BR")} ${n === 1 ? one : many}`;
