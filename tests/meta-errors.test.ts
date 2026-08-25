import { strict as assert } from "node:assert";
import { test } from "node:test";
import { describeMetaError, isMetaAuthError, metaErrorDetail } from "../src/lib/meta-errors.ts";

// Run with: npm test
//
// These are the sentences an operator reads when a send fails, so the thing
// worth pinning is that no path can leak the raw JSON envelope back to them —
// that is the bug this module exists to fix.

// The exact body Meta returned when the stored token expired in production.
const EXPIRED_TOKEN = {
  error: {
    message: "Authentication Error",
    code: 190,
    type: "OAuthException",
    fbtrace_id: "A29xKocep--lOwYvSsx3n2P",
  },
};

test("parses a real Meta error body", () => {
  const detail = metaErrorDetail(EXPIRED_TOKEN);
  assert.equal(detail.code, 190);
  assert.equal(detail.type, "OAuthException");
  assert.equal(detail.detail, "Authentication Error");
});

test("prefers error_data.details over the generic message", () => {
  const detail = metaErrorDetail({
    error: {
      message: "Invalid parameter",
      code: 100,
      error_data: { details: "template name (welcome_v2) does not exist in en_US" },
    },
  });
  assert.equal(detail.detail, "template name (welcome_v2) does not exist in en_US");
});

test("an unparsable body yields nulls rather than throwing", () => {
  for (const body of [null, undefined, "nope", 42, {}, { error: null }, { error: "boom" }]) {
    const detail = metaErrorDetail(body);
    assert.equal(detail.code, null);
    assert.equal(detail.detail, null);
  }
});

test("code 190 is a credential failure, not a message failure", () => {
  assert.equal(isMetaAuthError(401, EXPIRED_TOKEN), true);
});

test("a bad template is not a credential failure", () => {
  // Recording this against the connection would put a permanent warning on
  // the card for a fault in one message.
  assert.equal(
    isMetaAuthError(400, { error: { message: "Template not found", code: 132001 } }),
    false
  );
  assert.equal(
    isMetaAuthError(400, { error: { message: "Re-engagement message", code: 131047 } }),
    false
  );
});

test("a 401 OAuthException with no code still reads as a credential failure", () => {
  assert.equal(isMetaAuthError(401, { error: { type: "OAuthException" } }), true);
});

test("a 401 without an OAuth envelope is not assumed to be one", () => {
  assert.equal(isMetaAuthError(401, { something: "else" }), false);
});

test("the expired-token message names the fix and the token that lasts", () => {
  const message = describeMetaError(401, EXPIRED_TOKEN);
  assert.match(message, /expired or been revoked/);
  assert.match(message, /Integrations/);
  assert.match(message, /System User token does not expire/);
});

test("the test-number restriction names where to add the recipient", () => {
  const message = describeMetaError(400, {
    error: { message: "Recipient phone number not in allowed list", code: 131030 },
  });
  assert.match(message, /allowed list/);
  assert.match(message, /API Setup/);
});

test("an unrecognised code falls back to Meta's own wording", () => {
  const message = describeMetaError(400, {
    error: { message: "Something inventive went wrong", code: 999999 },
  });
  assert.match(message, /Something inventive went wrong/);
  assert.match(message, /999999/);
});

test("no branch ever returns the raw JSON envelope", () => {
  const bodies: unknown[] = [
    EXPIRED_TOKEN,
    { error: { message: "Invalid parameter", code: 100 } },
    { error: { message: "unknown", code: 987654 } },
    { error: { message: "Rate limit", code: 130429 } },
    {},
    null,
    "not json at all",
  ];

  for (const body of bodies) {
    const message = describeMetaError(400, body);
    assert.ok(message.length > 0, "every branch produces a message");
    assert.doesNotMatch(message, /[{}]/, `leaked JSON braces for ${JSON.stringify(body)}`);
    assert.doesNotMatch(message, /fbtrace_id/, "leaked Meta's trace id into operator-facing text");
  }
});

// Meta reuses code 100 for "bad field" and for "that object does not exist
// or you cannot see it". The generic text for 100 sends people looking at
// their message when the problem is asset assignment on the token.
test("code 100 subcode 33 is about permissions, not the message body", () => {
  const message = describeMetaError(400, {
    error: {
      message: "Unsupported post request. Object with ID '1203608382834277' does not exist…",
      code: 100,
      type: "GraphMethodException",
      error_subcode: 33,
    },
  });
  assert.match(message, /System User/);
  assert.match(message, /does not update an existing token/);
  assert.doesNotMatch(message, /rejected one of the message's fields/);
});

test("code 100 without that subcode keeps the generic field wording", () => {
  const message = describeMetaError(400, {
    error: { message: "Invalid parameter", code: 100 },
  });
  assert.match(message, /rejected one of the message's fields/);
});
