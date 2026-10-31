import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  authoriseUrl,
  credentialProblem,
  mentions,
  redirectUri,
  ruleFor,
  ruleProblem,
  SCOPES,
  withinReplyWindow,
  type CommentRule,
} from "../src/lib/instagram.ts";

function rule(overrides: Partial<CommentRule> & { id: string; name: string }): CommentRule {
  return {
    keywords: [],
    mediaId: null,
    dmMessage: "Here you go!",
    publicReply: null,
    isActive: true,
    ...overrides,
  };
}

test("the consent screen asks for exactly the three scopes", () => {
  const url = authoriseUrl({ instagramAppId: "123", redirectUri: "https://x.in/cb", state: "s" });
  for (const scope of SCOPES) assert.ok(url.includes(scope), `missing ${scope}`);
  assert.ok(url.startsWith("https://www.instagram.com/oauth/authorize?"));
  assert.ok(url.includes("response_type=code"));
});

test("the redirect URI has no double slash, whatever the app url ends with", () => {
  // Meta compares the whole string, so one stray slash is a refused login.
  assert.equal(redirectUri("https://neurachat.in"), "https://neurachat.in/api/instagram/connect/callback");
  assert.equal(redirectUri("https://neurachat.in/"), "https://neurachat.in/api/instagram/connect/callback");
});

test("a keyword matches on a word boundary, not as a substring", () => {
  // The thing that makes a comment bot embarrassing: "hi" firing on
  // "this", "shipping" and "Chicago".
  assert.equal(mentions("hi there", "hi"), true);
  assert.equal(mentions("is this shipping to Chicago", "hi"), false);
  assert.equal(mentions("Send me the PRICE please", "price"), true);
});

test("a keyword with punctuation in it cannot break the pattern", () => {
  assert.equal(mentions("do you have 20% off", "20% off"), true);
  assert.equal(mentions("nothing here", "20% off"), false);
  // A keyword that is pure punctuation would match everything.
  assert.equal(mentions("anything", "   "), false);
});

test("a rule pinned to a post beats a catch-all", () => {
  const picked = ruleFor(
    { id: "c1", mediaId: "post-9", text: "price please" },
    [
      rule({ id: "any", name: "Everything", keywords: ["price"] }),
      rule({ id: "pinned", name: "This post", keywords: ["price"], mediaId: "post-9" }),
    ]
  );
  assert.equal(picked?.id, "pinned");
});

test("a named keyword beats a rule that answers every comment", () => {
  const picked = ruleFor({ id: "c1", mediaId: "p1", text: "price?" }, [
    rule({ id: "all", name: "DM everybody", keywords: [] }),
    rule({ id: "kw", name: "Price asks", keywords: ["price"] }),
  ]);
  assert.equal(picked?.id, "kw");
});

test("an empty keyword list really does mean every comment", () => {
  // A real campaign, not an unfinished rule.
  const picked = ruleFor({ id: "c1", mediaId: "p1", text: "🔥🔥" }, [
    rule({ id: "all", name: "DM everybody", keywords: [] }),
  ]);
  assert.equal(picked?.id, "all");
});

test("a rule pinned to another post does not fire", () => {
  const picked = ruleFor({ id: "c1", mediaId: "post-1", text: "price" }, [
    rule({ id: "other", name: "Other post", keywords: ["price"], mediaId: "post-2" }),
  ]);
  assert.equal(picked, null);
});

test("a switched-off rule never fires", () => {
  const picked = ruleFor({ id: "c1", mediaId: "p1", text: "price" }, [
    rule({ id: "off", name: "Paused", keywords: ["price"], isActive: false }),
  ]);
  assert.equal(picked, null);
});

test("a rule that does nothing is refused before it can be saved", () => {
  assert.match(ruleProblem({ name: "Empty", dmMessage: "", publicReply: "" }) ?? "", /does nothing/);
  assert.match(ruleProblem({ name: "", dmMessage: "hi" }) ?? "", /name/);
  assert.equal(ruleProblem({ name: "Fine", dmMessage: "hi" }), null);
  assert.equal(ruleProblem({ name: "Fine", publicReply: "thanks!" }), null);
});

test("a DM over Instagram's limit is caught here, not by Meta", () => {
  assert.match(ruleProblem({ name: "Long", dmMessage: "x".repeat(1200) }) ?? "", /1000 characters/);
});

test("the private reply window is seven days, and the future is not in it", () => {
  const now = new Date("2026-10-30T12:00:00Z");
  assert.equal(withinReplyWindow("2026-10-29T12:00:00Z", now), true);
  assert.equal(withinReplyWindow("2026-10-23T13:00:00Z", now), true);
  assert.equal(withinReplyWindow("2026-10-22T12:00:00Z", now), false);
  assert.equal(withinReplyWindow("2026-11-01T12:00:00Z", now), false);
  assert.equal(withinReplyWindow("not a date", now), false);
});

// --- the credentials -------------------------------------------------
//
// These exist because of a real afternoon lost to them: the whole block
// was pasted into Vercel's value box, so the id became
// "INSTAGRAM_APP_ID        = 1480246337381870\nINSTAGRAM_APP_SECRET..."
// and went into a query string on instagram.com — taking the secret
// with it, into browser history and two sets of server logs. Instagram
// answered "Page isn't available", which reads as a broken integration
// rather than a mistyped setting.

test("a plain id and secret are accepted", () => {
  assert.equal(credentialProblem("1480246337381870", "abc123def456"), null);
});

test("a whole pasted block is refused, and says the secret is in it", () => {
  const pasted = "INSTAGRAM_APP_ID        = 1480246337381870\nINSTAGRAM_APP_SECRET = s3cr3t";
  const problem = credentialProblem(pasted, "s3cr3t");
  assert.ok(problem, "the block should be refused");
  assert.match(problem, /resetting in Meta/);
});

test("an id with the name and equals sign is refused", () => {
  assert.ok(credentialProblem("INSTAGRAM_APP_ID = 1480246337381870", "s3cr3t"));
});

test("a missing id is named before anything else", () => {
  assert.match(credentialProblem("", "")!, /INSTAGRAM_APP_ID is not set/);
});

test("a missing secret is named once the id is good", () => {
  assert.match(credentialProblem("1480246337381870", "")!, /INSTAGRAM_APP_SECRET is not set/);
});

test("a secret with whitespace in it is refused", () => {
  assert.ok(credentialProblem("1480246337381870", "INSTAGRAM_APP_SECRET = s3cr3t"));
});

test("a bad id never reaches the authorise url", () => {
  // The guard is the only thing between a pasted block and a secret in
  // somebody's browser history, so this asserts the order: refuse
  // first, build the url second.
  const pasted = "INSTAGRAM_APP_ID = 1480246337381870\nINSTAGRAM_APP_SECRET = s3cr3t";
  assert.ok(credentialProblem(pasted, "s3cr3t"));

  const url = authoriseUrl({
    instagramAppId: pasted,
    redirectUri: redirectUri("https://neurachat.in"),
    state: "state",
  });
  assert.ok(url.includes("s3cr3t"), "without the guard the secret lands in the url");
});
