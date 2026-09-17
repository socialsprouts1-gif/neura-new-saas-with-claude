import test from "node:test";
import assert from "node:assert/strict";
import { routeFlow, accountsToSync, type NumberOnAccount } from "../src/lib/flow-routing.ts";

const onA: NumberOnAccount = { id: "n1", wabaId: "A", status: "active", isDefault: true };
const onB: NumberOnAccount = { id: "n2", wabaId: "B", status: "active", isDefault: false };
const alsoOnB: NumberOnAccount = { id: "n3", wabaId: "B", status: "active", isDefault: false };

test("a flow is sent from a number on its own account, not the default", () => {
  // The bug in one line: the default is on A, the flow lives on B.
  assert.deepEqual(routeFlow([onA, onB], "B"), { ok: true, connectionId: "n2", wabaId: "B" });
});

test("the default still wins among numbers on the right account", () => {
  const defaultOnB = { ...alsoOnB, isDefault: true };
  const result = routeFlow([onA, onB, defaultOnB], "B");
  assert.deepEqual(result, { ok: true, connectionId: "n3", wabaId: "B" });
});

test("a flow whose account has no active number is refused, not redirected", () => {
  // Redirecting to the default is what produced Meta 131009 with nothing in
  // it to act on, so this must be an error rather than a silent fallback.
  assert.deepEqual(routeFlow([onA], "B"), { ok: false, reason: "account-not-connected" });
});

test("a disabled number on the right account does not count", () => {
  const disabled = { ...onB, status: "disabled" };
  assert.deepEqual(routeFlow([onA, disabled], "B"), { ok: false, reason: "account-not-connected" });
});

test("a flow with no account recorded falls back to the default", () => {
  // Rows created before the column was filled in still have to work.
  assert.deepEqual(routeFlow([onA, onB], null), { ok: true, connectionId: "n1", wabaId: "A" });
  assert.deepEqual(routeFlow([onA, onB], undefined), { ok: true, connectionId: "n1", wabaId: "A" });
});

test("no numbers at all reads differently from the wrong number", () => {
  assert.deepEqual(routeFlow([], "B"), { ok: false, reason: "none-connected" });
  assert.deepEqual(routeFlow([{ ...onA, status: "pending" }], null), {
    ok: false,
    reason: "none-connected",
  });
});

test("an account is synced once however many numbers sit on it", () => {
  // Listing B twice would import every form on it twice over.
  assert.deepEqual(accountsToSync([onA, onB, alsoOnB]), ["A", "B"]);
});

test("only active numbers contribute an account to sync", () => {
  assert.deepEqual(accountsToSync([onA, { ...onB, status: "error" }]), ["A"]);
  assert.deepEqual(accountsToSync([]), []);
});
