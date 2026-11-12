import test from "node:test";
import assert from "node:assert/strict";
import { COMMUNITY_REPO, FEEDBACK_LIMITS, feedbackIssueUrl, type FeedbackDraft } from "../src/feedback.ts";

const draft: FeedbackDraft = { kind: "idea", title: "Melhorar a câmera", description: "Seria bom poder ajustar a distância da câmera.", nickname: "", acknowledged: true };

test("feedback requires useful text, a valid category and explicit publication acknowledgement", () => {
  for (const changes of [{ kind: "__proto__" }, { kind: "unknown" }, { title: "   " }, { title: "ok" },
    { description: "curto" }, { acknowledged: false }, { nickname: "duas\nlinhas" },
    { title: "x".repeat(FEEDBACK_LIMITS.title + 1) }, { description: "x".repeat(FEEDBACK_LIMITS.description + 1) }]) {
    assert.equal(feedbackIssueUrl({ ...draft, ...changes }).ok, false);
  }
});

test("issue link preserves accents and punctuation as data, uses the fixed repository and no elevated options", () => {
  const result = feedbackIssueUrl({ ...draft, title: "E se tivesse água & céu?", description: "<script>alert(1)</script> &labels=approved # Minha ideia", nickname: "  Jogador  " });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const url = new URL(result.url);
  assert.equal(`${url.origin}${url.pathname}`, `${COMMUNITY_REPO}/issues/new`);
  assert.equal(url.searchParams.get("title"), "[Comunidade] E se tivesse água & céu?");
  assert.match(url.searchParams.get("body")!, /<script>alert\(1\)<\/script> &labels=approved/);
  assert.match(url.searchParams.get("body")!, /Apelido informado\n\nJogador/);
  assert.deepEqual([...url.searchParams.keys()], ["title", "body"]);
});

test("repeating an attempt is deterministic, no private progress is included and anonymous nickname is optional", () => {
  const result = feedbackIssueUrl(draft);
  assert.deepEqual(feedbackIssueUrl(draft), result);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.doesNotMatch(new URL(result.url).searchParams.get("body")!, /Apelido informado|gta:|cloud-code|playSeconds/);
});

test("long encoded text is rejected without silently trimming the player's contribution", () => {
  const description = "🌊".repeat(500);
  assert.equal(description.length, FEEDBACK_LIMITS.description);
  const result = feedbackIssueUrl({ ...draft, title: "é".repeat(90), nickname: "é".repeat(32), description });
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /grande demais/);
});
