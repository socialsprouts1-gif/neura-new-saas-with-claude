import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES,
  DEFAULT_RATES,
  MIN_TOPUP,
  balanceState,
  canSpend,
  checkTopup,
  costOf,
  formatMoney,
  formatRate,
  isCategory,
  isCredit,
  messagesLeft,
  readRates,
  signedAmount,
  summarise,
  walletInUse,
  writeRates,
  type WalletRates,
} from "../src/lib/wallet.ts";

const RATES: WalletRates = {
  currency: "INR",
  marketing: 109,
  utility: 42,
  authentication: 35,
  service: 0,
  blockWhenEmpty: false,
  lowBalance: 10000,
};

// --- rates -----------------------------------------------------------------

test("stored rates come back whole, and write back unchanged", () => {
  const stored = writeRates(RATES);
  assert.deepEqual(readRates(stored), RATES);
});

test("nothing stored reads as a wallet that is switched off", () => {
  for (const value of [null, undefined, {}, "nonsense", 42]) {
    const rates = readRates(value);
    assert.equal(walletInUse(rates), false, String(value));
    assert.equal(balanceState(0, rates), "off");
  }
});

test("blocking is only ever literally true", () => {
  // A half-configured wallet that starts refusing sends is a support ticket
  // from every customer at once.
  assert.equal(readRates({ block_when_empty: "yes" }).blockWhenEmpty, false);
  assert.equal(readRates({ block_when_empty: 1 }).blockWhenEmpty, false);
  assert.equal(readRates({ block_when_empty: true }).blockWhenEmpty, true);
  assert.equal(DEFAULT_RATES.blockWhenEmpty, false);
});

test("a negative or nonsense rate reads as zero rather than as a credit", () => {
  const rates = readRates({ marketing: -50, utility: "abc", authentication: NaN });
  assert.equal(rates.marketing, 0);
  assert.equal(rates.utility, 0);
  assert.equal(rates.authentication, 0);
});

test("rates are whole units, because a fraction of a paisa is not money", () => {
  // Held as 0.85 instead of 85, three thousand messages cost ₹2,549.9999994.
  assert.equal(readRates({ marketing: 84.6 }).marketing, 85);
});

// --- what a send costs -----------------------------------------------------

test("each category costs its own rate", () => {
  assert.equal(costOf("marketing", RATES), 109);
  assert.equal(costOf("utility", RATES), 42);
  assert.equal(costOf("authentication", RATES), 35);
  assert.equal(costOf("service", RATES), 0);
});

test("the category is read however it was cased", () => {
  assert.equal(costOf("MARKETING", RATES), 109);
});

test("an unrecognised category costs the utility rate, not nothing", () => {
  // Charging zero for something unrecognised is the error that only shows
  // up on the month's invoice, by which time the messages are long gone.
  assert.equal(costOf("", RATES), 42);
  assert.equal(costOf("something_new", RATES), 42);
});

test("every category in the list is a category", () => {
  for (const category of CATEGORIES) assert.equal(isCategory(category.key), true);
  assert.equal(isCategory("postcard"), false);
});

// --- the balance -----------------------------------------------------------

test("the balance has a state, and each one is distinguishable", () => {
  assert.equal(balanceState(500000, RATES), "healthy");
  assert.equal(balanceState(5000, RATES), "low");
  assert.equal(balanceState(10000, RATES), "low");
  assert.equal(balanceState(0, RATES), "empty");
  assert.equal(balanceState(-200, RATES), "negative");
});

test("sending is not blocked unless somebody switched blocking on", () => {
  assert.equal(canSpend(0, 109, RATES), true);
  assert.equal(canSpend(-5000, 109, RATES), true);
});

test("with blocking on, an empty wallet stops a charged message", () => {
  const strict = { ...RATES, blockWhenEmpty: true };
  assert.equal(canSpend(500, 109, strict), true);
  assert.equal(canSpend(100, 109, strict), false);
  assert.equal(canSpend(109, 109, strict), true);
});

test("a free message goes out whatever the balance says", () => {
  const strict = { ...RATES, blockWhenEmpty: true };
  assert.equal(canSpend(0, 0, strict), true);
});

test("how many messages are left is worked out at the dearest rate", () => {
  // The number worked out at the cheapest rate is the one that runs out two
  // days early.
  assert.equal(messagesLeft(10900, RATES), 100);
});

test("with nothing priced there is no estimate, rather than an infinite one", () => {
  assert.equal(messagesLeft(10000, DEFAULT_RATES), null);
});

// --- topping up ------------------------------------------------------------

test("a sensible top-up is accepted", () => {
  const check = checkTopup(100000);
  assert.equal(check.ok, true);
  assert.equal(check.ok && check.cents, 100000);
});

test("too little is refused, and the message says the floor", () => {
  const check = checkTopup(500);
  assert.equal(check.ok, false);
  assert.match(check.ok === false ? check.error : "", /100/);
});

test("a mistyped amount with four extra zeros is refused", () => {
  // Which is a refund request and a very bad afternoon.
  assert.equal(checkTopup(999999999).ok, false);
});

test("nothing at all is refused", () => {
  for (const bad of [0, -100, "", null, undefined, "abc"]) {
    assert.equal(checkTopup(bad).ok, false, String(bad));
  }
});

test("the floor is a real amount of money", () => {
  assert.ok(MIN_TOPUP >= 1000);
});

// --- the statement ---------------------------------------------------------

test("money in and money out are told apart", () => {
  assert.equal(isCredit("topup"), true);
  assert.equal(isCredit("refund"), true);
  assert.equal(isCredit("debit"), false);
  assert.equal(isCredit("adjustment"), false);
});

test("a statement line carries its sign, so it scans without reading", () => {
  assert.match(signedAmount({ kind: "topup", amountCents: 500000 }), /^\+/);
  assert.match(signedAmount({ kind: "debit", amountCents: 109 }), /^−/);
});

test("added and spent are kept apart rather than netted", () => {
  // "You added ₹5,000 and spent ₹4,096" can be checked against somebody's
  // own records. A single net figure of ₹904 cannot.
  const total = summarise([
    { kind: "topup", amountCents: 500000, balanceAfterCents: 500000, description: "", createdAt: "" },
    { kind: "debit", amountCents: 109, balanceAfterCents: 499891, description: "", createdAt: "" },
    { kind: "debit", amountCents: 42, balanceAfterCents: 499849, description: "", createdAt: "" },
    { kind: "refund", amountCents: 42, balanceAfterCents: 499891, description: "", createdAt: "" },
  ]);
  assert.equal(total.added, 500042);
  assert.equal(total.spent, 151);
  // Only the debits are messages. A refund is not a message un-sent.
  assert.equal(total.messages, 2);
});

// --- money on screen -------------------------------------------------------

test("a total reads as money", () => {
  assert.match(formatMoney(125000), /1,250/);
  assert.match(formatMoney(0), /0/);
});

test("a per-message rate keeps the decimals a total does not need", () => {
  // ₹0.85 a message is the difference between a usable price list and one
  // that reads "₹1" for every row.
  assert.match(formatRate(85), /0\.85/);
});

test("an unknown currency does not take the page down", () => {
  assert.match(formatMoney(10000, "NOTACURRENCY"), /100\.00/);
  assert.match(formatRate(85, "NOTACURRENCY"), /0\.85/);
});
