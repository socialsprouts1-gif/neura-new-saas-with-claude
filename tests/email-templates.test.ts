import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inDays,
  paymentReceivedEmail,
  renewalReminderEmail,
  subscriptionExpiredEmail,
  trialEndingEmail,
  trialExpiredEmail,
  welcomeEmail,
  type EmailBrand,
} from "../src/lib/email-templates.ts";

const brand: EmailBrand = {
  name: "Neura Chat",
  appUrl: "https://neurachat.in",
  supportEmail: "support@neurachat.in",
};

const all = [
  welcomeEmail(brand, { trialDays: 7 }),
  trialEndingEmail(brand, { daysLeft: 2 }),
  trialExpiredEmail(brand),
  paymentReceivedEmail(brand, {
    planName: "Growth",
    amount: "₹1,500",
    renewsOn: "16 October 2026",
    interval: "monthly",
  }),
  renewalReminderEmail(brand, { planName: "Growth", daysLeft: 3, renewsOn: "16 Oct 2026" }),
  subscriptionExpiredEmail(brand, { planName: "Growth" }),
];

test("every message has a subject, HTML and text", () => {
  // A missing text part is what drops a message into spam, and writing it
  // as an afterthought is how it ends up empty.
  for (const email of all) {
    assert.ok(email.subject.trim(), "subject");
    assert.ok(email.html.includes("<html>"), "html");
    assert.ok(email.text.trim().length > 40, "text");
  }
});

test("no message leaves a placeholder in the subject", () => {
  for (const email of all) {
    assert.doesNotMatch(email.subject, /undefined|null|\{\{|\}\}/);
  }
});

test("every message links back into the app", () => {
  for (const email of all) {
    assert.match(email.html, /https:\/\/neurachat\.in/);
    assert.match(email.text, /https:\/\/neurachat\.in/);
  }
});

test("days are written the way a person says them", () => {
  assert.equal(inDays(3), "in 3 days");
  assert.equal(inDays(1), "tomorrow");
  assert.equal(inDays(0), "today");
  // Already past, in a sentence that still has to read.
  assert.equal(inDays(-2), "today");
});

test("the last day of a trial does not say 'in 0 days'", () => {
  const email = trialEndingEmail(brand, { daysLeft: 0 });
  assert.match(email.subject, /ends today/);
  assert.doesNotMatch(email.subject, /0 days/);
});

test("a payment confirmation states the amount and the renewal date", () => {
  const email = paymentReceivedEmail(brand, {
    planName: "Scale",
    amount: "₹12,000",
    renewsOn: "16 September 2027",
    interval: "yearly",
  });
  assert.match(email.subject, /Scale/);
  assert.match(email.text, /₹12,000/);
  assert.match(email.text, /16 September 2027/);
});

test("a renewal notice does not read as a demand for money", () => {
  // The plan is already paid for. A subject that sounds like a debt
  // collector is how a working product starts feeling like one.
  const email = renewalReminderEmail(brand, {
    planName: "Growth",
    daysLeft: 3,
    renewsOn: "16 Oct 2026",
  });
  assert.doesNotMatch(email.subject, /pay|overdue|action required/i);
  assert.match(email.text, /Nothing is needed from you/);
});

test("an expired plan says the data is still there", () => {
  // The fear at this moment is losing everything; the mail has to answer
  // it before it asks for anything.
  assert.match(subscriptionExpiredEmail(brand, { planName: "Growth" }).text, /nothing has been deleted/i);
  assert.match(trialExpiredEmail(brand).text, /still here/i);
});

test("a plan with no name still reads as a sentence", () => {
  const email = subscriptionExpiredEmail(brand, { planName: null });
  assert.match(email.subject, /^Your plan has ended$/);
});

test("a brand name with markup in it cannot break out of the HTML", () => {
  const nasty = welcomeEmail(
    { ...brand, name: '<script>alert("x")</script>' },
    { trialDays: 7 }
  );
  assert.doesNotMatch(nasty.html, /<script>/);
  assert.match(nasty.html, /&lt;script&gt;/);
});

test("the preheader is hidden rather than shown twice", () => {
  const email = welcomeEmail(brand, { trialDays: 7 });
  assert.match(email.html, /display:none;max-height:0/);
});
