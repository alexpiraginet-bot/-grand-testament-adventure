// The devs' panel numbers, counted from responses of GitHub's public API recorded for this repository on 13/11/2026
// (test/fixtures/github, e-mail addresses removed). Expected values were counted apart with Python.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { coAuthors, commitStats, localDay, parseCommits, parseRepo, parseTickets, plural, ticketStats } from "../src/project-stats.ts";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/github/${name}.json`, import.meta.url), "utf8")) as unknown;

test("commits: who and how many, by the names in the history, never by e-mail", () => {
  const commits = parseCommits(fixture("commits"));
  const s = commitStats(commits);
  assert.equal(s.total, 29);
  assert.deepEqual(s.byAuthor, [{ name: "alexpiraginet-bot", count: 20 }, { name: "Claude", count: 9 }]);
  assert.deepEqual(s.byCoauthor, [{ name: "Claude Opus 5.5", count: 9 }]);
  assert.deepEqual(s.accounts, [{ name: "alexpiraginet-bot", count: 20 }, { name: "claude", count: 9 }]);
  assert.equal(s.first, "2026-11-12T19:30:57Z"); assert.equal(s.last, "2026-11-13T15:23:03Z");
  // days are São Paulo's: a commit at 01:10 UTC belongs to the evening before
  assert.deepEqual(s.byDay, [{ date: "2026-11-12", count: 15 }, { date: "2026-11-13", count: 14 }]);
  assert.equal(localDay("2026-11-13T02:59:59Z"), "2026-11-12"); assert.equal(localDay("2026-11-13T03:00:00Z"), "2026-11-13");
  assert.ok(commits.every((c) => !JSON.stringify(c).includes("@")), "no e-mail address survives parsing");
  assert.ok(commits.every((c) => c.subject.length > 0 && !c.subject.includes("\n")));
});

test("co-authors: the name before the address, each once, whatever the case of the trailer", () => {
  assert.deepEqual(coAuthors("Fix x\n\nCo-Authored-By: Ana Lima <ana@example.com>\nco-authored-by: Ana Lima <other@example.com>\nCo-authored-by: Bot"), ["Ana Lima", "Bot"]);
  assert.deepEqual(coAuthors("Mention of Co-Authored-By: in the middle of a line is not a trailer"), []);
  assert.deepEqual(coAuthors("x\n\nCo-Authored-By: <only@example.com>"), [], "an address alone gives no name");
  assert.deepEqual(coAuthors(""), []);
});

test("issues and pull requests: kinds from the forms' title prefixes, community apart from the project's account", () => {
  const tickets = parseTickets(fixture("issues"));
  const s = ticketStats(tickets);
  assert.deepEqual(s.issues, { total: 1, open: 1, voluntariado: 1, comunidade: 0, outro: 0 });
  assert.deepEqual(s.prs, { total: 3, open: 1, merged: 2 });
  assert.deepEqual(s.community, [{ name: "marcosmoski", count: 1 }]);
  assert.deepEqual(ticketStats(tickets, "MarcosMoski").community, [{ name: "alexpiraginet-bot", count: 3 }], "the owner is matched whatever the case");
  const made = parseTickets([
    { number: 9, title: "[Comunidade] Ideia", state: "closed", user: { login: "a" }, created_at: "2026-11-13T00:00:00Z" },
    { number: 8, title: "Sem prefixo", state: "open", user: { login: "b" }, created_at: "2026-11-13T00:00:00Z" },
    { number: 7, title: "[Voluntariado] PR com esse título", state: "closed", user: { login: "a" }, created_at: "2026-11-13T00:00:00Z", pull_request: { merged_at: null } },
  ]);
  assert.deepEqual(made.map((t) => [t.kind, t.open, t.merged]), [["comunidade", false, false], ["outro", true, false], ["pr", false, false]]);
  assert.deepEqual(ticketStats(made).community, [{ name: "a", count: 2 }, { name: "b", count: 1 }]);
});

test("the repository's own counters", () => {
  assert.deepEqual(parseRepo(fixture("repo")), { stars: 0, forks: 0, watchers: 0, created: "2026-11-12T22:41:57Z", pushed: "2026-11-13T17:31:05Z" });
});

test("a response that is not what was asked for is refused, not half-read", () => {
  for (const bad of [null, {}, "x", { message: "API rate limit exceeded" }]) {
    assert.throws(() => parseCommits(bad), /GitHub/); assert.throws(() => parseTickets(bad), /GitHub/);
  }
  assert.throws(() => parseRepo({ message: "Not Found" }), /GitHub/);
  assert.throws(() => parseRepo({ stargazers_count: -1, forks_count: 0, subscribers_count: 0, created_at: "2026-01-01T00:00:00Z", pushed_at: "2026-01-01T00:00:00Z" }), /stars/);
  assert.throws(() => parseCommits([{ sha: "a", commit: { author: { name: "x", date: "not a date" }, message: "" } }]), /date/);
  assert.throws(() => parseTickets([{ number: 1, title: "t", state: "merged", user: { login: "a" }, created_at: "2026-11-13T00:00:00Z" }]), /state/);
  assert.deepEqual(commitStats([]), { total: 0, first: null, last: null, byAuthor: [], byCoauthor: [], accounts: [], byDay: [] });
});

test("counted nouns in Portuguese", () => {
  assert.equal(plural(1, "commit", "commits"), "1 commit"); assert.equal(plural(0, "pessoa", "pessoas"), "0 pessoas");
  assert.equal(plural(1234, "commit", "commits"), "1.234 commits");
});
