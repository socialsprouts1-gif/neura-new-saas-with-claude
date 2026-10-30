import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  authoriseUrl,
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
