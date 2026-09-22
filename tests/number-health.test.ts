import test from "node:test";
import assert from "node:assert/strict";
import {
  healthChecks,
  worstTone,
  headline,
  type NumberFacts,
} from "../src/lib/number-health.ts";

const healthy: NumberFacts = {
  wabaId: "1662708401531431",
  phoneNumberId: "998877665544332",
  numberOnWaba: true,
  wabaNumbers: ["+91 74477 39348"],
  businessVerification: "verified",
  accountReview: "APPROVED",
  qualityRating: "GREEN",
  platformType: "CLOUD_API",
  numberStatus: "CONNECTED",
  wabaName: "Neurachat",
  ownershipType: "CLIENT_OWNED",
};

const find = (facts: NumberFacts, label: string) =>
  healthChecks(facts).find((check) => check.label === label)!;

test("a healthy account comes back clean", () => {
  const checks = healthChecks(healthy);
  assert.equal(worstTone(checks), "ok");
  assert.ok(checks.every((check) => check.tone === "ok"));
});

test("a clean result says to look at the message, not the account", () => {
  const line = headline(healthChecks(healthy));
  assert.match(line, /no problem/i);
  assert.match(line, /failed recipients/i);
});

// --- the one this exists for -----------------------------------------------

test("a number that is not on the configured account is the first check and is fatal", () => {
  const checks = healthChecks({
    ...healthy,
    numberOnWaba: false,
    wabaNumbers: ["+91 90000 11111", "+91 90000 22222"],
  });

  assert.equal(checks[0].label, "Number is on this account");
  assert.equal(checks[0].tone, "bad");
  // Names what the account does hold, so the right one can be found.
  assert.match(checks[0].detail, /\+91 90000 11111, \+91 90000 22222/);
});

test("an empty account says so rather than printing an empty list", () => {
  const check = find({ ...healthy, numberOnWaba: false, wabaNumbers: [] }, "Number is on this account");
  assert.match(check.detail, /no numbers at all/);
});

test("verification is reported for THIS account, not the portfolio", () => {
  const check = find({ ...healthy, businessVerification: "not_verified" }, "Business verification");
  assert.equal(check.tone, "bad");
  assert.match(check.detail, /THIS account/);
  assert.match(check.detail, /does not carry over/);
});

test("verification pending is a warning, not a failure", () => {
  assert.equal(find({ ...healthy, businessVerification: "pending" }, "Business verification").tone, "warn");
});

test("Meta's casing does not change the verdict", () => {
  assert.equal(find({ ...healthy, businessVerification: "VERIFIED" }, "Business verification").tone, "ok");
  assert.equal(find({ ...healthy, accountReview: "approved" }, "Account review").tone, "ok");
  assert.equal(find({ ...healthy, platformType: "cloud_api" }, "Platform").tone, "ok");
});

test("a field Meta did not return is unknown, never a failure", () => {
  for (const facts of [
    { ...healthy, businessVerification: null },
    { ...healthy, accountReview: undefined },
    { ...healthy, numberStatus: "" },
    { ...healthy, platformType: null },
  ]) {
    assert.equal(worstTone(healthChecks(facts)), "unknown", JSON.stringify(facts));
  }
});

test("an unrated number is not painted red", () => {
  assert.equal(find({ ...healthy, qualityRating: "UNKNOWN" }, "Quality rating").tone, "unknown");
  assert.equal(find({ ...healthy, qualityRating: null }, "Quality rating").tone, "unknown");
});

test("a number still on the WhatsApp Business app is called out", () => {
  const check = find({ ...healthy, platformType: "NOT_APPLICABLE" }, "Platform");
  assert.equal(check.tone, "bad");
  assert.match(check.detail, /Cloud API/);
});

test("red quality and yellow quality are told apart", () => {
  assert.equal(find({ ...healthy, qualityRating: "YELLOW" }, "Quality rating").tone, "warn");
  assert.equal(find({ ...healthy, qualityRating: "RED" }, "Quality rating").tone, "bad");
});

test("a flagged number blocks, a pending one warns", () => {
  assert.equal(find({ ...healthy, numberStatus: "FLAGGED" }, "Number status").tone, "bad");
  assert.equal(find({ ...healthy, numberStatus: "PENDING" }, "Number status").tone, "warn");
});

// --- the summary line ------------------------------------------------------

test("the headline counts the blocking problems", () => {
  const one = headline(healthChecks({ ...healthy, accountReview: "REJECTED" }));
  assert.match(one, /^1 thing here will stop/);

  const two = headline(
    healthChecks({ ...healthy, accountReview: "REJECTED", numberStatus: "RESTRICTED" })
  );
  assert.match(two, /^2 things here will stop/);
});

test("warnings alone do not claim anything is blocked", () => {
  const line = headline(healthChecks({ ...healthy, qualityRating: "YELLOW" }));
  assert.match(line, /Nothing is blocked outright/);
  assert.match(line, /1 thing needs attention/);
});

test("worstTone ranks bad over warn over unknown", () => {
  assert.equal(worstTone([{ label: "a", tone: "warn", detail: "" }, { label: "b", tone: "bad", detail: "" }]), "bad");
  assert.equal(worstTone([{ label: "a", tone: "unknown", detail: "" }, { label: "b", tone: "warn", detail: "" }]), "warn");
  assert.equal(worstTone([{ label: "a", tone: "ok", detail: "" }]), "ok");
});

// --- which account this is -------------------------------------------------

test("the account's name and kind are reported, never judged", () => {
  const check = find({ ...healthy, wabaName: "Neurachat", ownershipType: "CLIENT_OWNED" }, "Which account this is");
  assert.equal(check.tone, "ok");
  assert.match(check.detail, /Neurachat/);
  assert.match(check.detail, /CLIENT_OWNED/);
});

test("an unfamiliar ownership type is passed through rather than called a fault", () => {
  // Meta's enum here is not stable enough to branch on. Anything it says
  // is reported as-is; guessing which values are fatal is how an error
  // message ends up confidently wrong.
  const check = find({ ...healthy, wabaName: "X", ownershipType: "SOMETHING_NEW" }, "Which account this is");
  assert.equal(check.tone, "ok");
  assert.match(check.detail, /SOMETHING_NEW/);
});

test("an account Meta would not name is unknown, not a failure", () => {
  const facts = { ...healthy, wabaName: null, ownershipType: null };
  assert.equal(find(facts, "Which account this is").tone, "unknown");
  assert.equal(worstTone(healthChecks(facts)), "unknown");
});

test("the identity line explains why a template is not on every number", () => {
  const check = find({ ...healthy, wabaName: "Neurachat" }, "Which account this is");
  assert.match(check.detail, /Templates belong to an account/);
});
