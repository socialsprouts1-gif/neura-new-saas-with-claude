import { test } from "node:test";
import assert from "node:assert/strict";
import { NOTICE_DAYS, dueBillingEmail } from "../src/lib/billing-email-plan.ts";

const now = new Date("2026-09-16T10:00:00Z");
const inDays = (days: number) =>
  new Date(now.getTime() + days * 86_400_000).toISOString();

const sub = (status: string, days: number, planName = "Growth") => ({
  status,
  current_period_end: inDays(days),
  plans: { name: planName },
});

test("a trial is left alone until it is nearly over", () => {
  // Warning on day one of seven is nagging, and it would burn the one
  // send this period is allowed.
  assert.equal(dueBillingEmail("o1", sub("trialing", 7), now), null);
  assert.equal(dueBillingEmail("o1", sub("trialing", 4), now), null);
});

test("a trial inside the notice window is due a warning", () => {
  const due = dueBillingEmail("o1", sub("trialing", NOTICE_DAYS), now);
  assert.equal(due?.kind, "trial_ending");
  assert.equal(due?.daysLeft, NOTICE_DAYS);
});

test("an ended trial asks for the sale", () => {
  assert.equal(dueBillingEmail("o1", sub("trialing", -1), now)?.kind, "trial_expired");
});

test("a paid plan is reminded a few days before it renews", () => {
  assert.equal(dueBillingEmail("o1", sub("active", 2), now)?.kind, "renewal_reminder");
  assert.equal(dueBillingEmail("o1", sub("active", 20), now), null);
});

test("a lapsed paid plan is told, not reminded", () => {
  assert.equal(dueBillingEmail("o1", sub("past_due", -2), now)?.kind, "subscription_expired");
});

test("a workspace with no billing row is owed nothing", () => {
  // Saying "your plan has lapsed" to someone who never had one is worse
  // than silence.
  assert.equal(dueBillingEmail("o1", null, now), null);
  assert.equal(dueBillingEmail("o1", { status: null, current_period_end: null }, now), null);
});

test("no period end means no send, because there is nothing to dedupe on", () => {
  // Any send here would repeat on every sweep for ever.
  assert.equal(dueBillingEmail("o1", { status: "active", current_period_end: null }, now), null);
});

test("the key is unique per workspace and per period", () => {
  const a = dueBillingEmail("org-a", sub("active", 1), now)!;
  const b = dueBillingEmail("org-b", sub("active", 1), now)!;
  assert.notEqual(a.dedupeKey, b.dedupeKey);

  // The period is in the key, which is what gives a monthly plan exactly
  // one reminder a month with nothing having to count them.
  const october = dueBillingEmail("org-a", sub("active", 31), new Date(now.getTime() + 30 * 86_400_000))!;
  assert.notEqual(a.dedupeKey, october.dedupeKey);
});

test("the same period asked twice produces the same key", () => {
  const first = dueBillingEmail("o1", sub("active", 2), now)!;
  const later = dueBillingEmail("o1", sub("active", 2), new Date(now.getTime() + 3600_000))!;
  assert.equal(first.dedupeKey, later.dedupeKey);
});

test("the plan name travels with the email so it can be named", () => {
  assert.equal(dueBillingEmail("o1", sub("active", 1, "Scale"), now)?.planName, "Scale");
});
