import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inDays,
  paymentReceivedEmail,
  renewalReminderEmail,
  subscriptionExpiredEmail,
  firstChatbotEmail,
  trialEndingEmail,
  trialExpiredEmail,
  trialFollowUpEmail,
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
  trialExpiredEmail(brand, { fromPrice: "₹1,000 a month" }),
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
  assert.match(trialExpiredEmail(brand, {}).text, /exactly where you left them/i);
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

// --- the newer messages ---------------------------------------------------

test("an expired trial leads with the price and a way to pay", () => {
  const email = trialExpiredEmail(brand, { fromPrice: "₹1,000 a month" });
  assert.match(email.text, /₹1,000 a month/);
  assert.match(email.text, /nothing has been deleted/i);
  assert.match(email.text, /Pick a plan and pay/);
});

test("an expired trial still reads without a price to quote", () => {
  const email = trialExpiredEmail(brand, {});
  assert.doesNotMatch(email.text, /undefined|null/);
  assert.match(email.text, /Choose a plan/);
});

test("follow-ups do not all say the same thing", () => {
  // Ten identical messages is one message sent ten times, which is what
  // gets a sender marked as spam.
  const bodies = new Set(
    [0, 1, 2, 3].map((step) => trialFollowUpEmail(brand, { step, daysSince: step * 3 }).text)
  );
  assert.ok(bodies.size > 1);
});

test("a follow-up never invents a deadline or escalates", () => {
  const tenth = trialFollowUpEmail(brand, { step: 10, daysSince: 30 });
  assert.doesNotMatch(tenth.subject, /final|last chance|urgent|expiring/i);
  assert.match(tenth.text, /ignore this/i);
});

test("the first chatbot is congratulated by name", () => {
  const email = firstChatbotEmail(brand, { botName: "Welcome bot" });
  assert.match(email.text, /Welcome bot/);
  assert.match(email.subject, /first chatbot/i);
});

test("a nameless bot still reads as a sentence", () => {
  assert.match(firstChatbotEmail(brand, { botName: "  " }).text, /your first bot/);
});

test("a bot name cannot inject markup into the email", () => {
  const email = firstChatbotEmail(brand, { botName: '<img src=x onerror="alert(1)">' });
  assert.doesNotMatch(email.html, /<img/);
});
