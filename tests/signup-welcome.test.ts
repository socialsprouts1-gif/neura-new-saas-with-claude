import test from "node:test";
import assert from "node:assert/strict";
import {
  readWelcome,
  writeWelcome,
  welcomeProblem,
  canSendWelcome,
  welcomeComponents,
  greetingName,
  DEFAULT_WELCOME,
} from "../src/lib/signup-welcome.ts";

const CONFIGURED = {
  enabled: true,
  org_id: "org-1",
  connection_id: "conn-1",
  template_name: "welcome_to_neurachat",
  language: "en",
  uses_name: true,
};

test("stored settings are read back whole", () => {
  assert.deepEqual(readWelcome(CONFIGURED), {
    enabled: true,
    orgId: "org-1",
    connectionId: "conn-1",
    templateName: "welcome_to_neurachat",
    language: "en",
    usesName: true,
  });
});

test("a missing row reads as off, not as half-configured", () => {
  // A welcome that tries to send with nothing set is one Meta error per
  // sign-up, every sign-up.
  for (const value of [null, undefined, {}, "nonsense", 42]) {
    assert.equal(readWelcome(value).enabled, false);
  }
  assert.deepEqual(readWelcome(null), DEFAULT_WELCOME);
});

test("enabled is only ever literally true", () => {
  assert.equal(readWelcome({ enabled: "yes" }).enabled, false);
  assert.equal(readWelcome({ enabled: 1 }).enabled, false);
});

test("a blank language falls back rather than sending an empty one", () => {
  assert.equal(readWelcome({ language: "   " }).language, "en");
});

test("what is read can be written back unchanged", () => {
  assert.deepEqual(writeWelcome(readWelcome(CONFIGURED)), CONFIGURED);
});

// --- is it usable ----------------------------------------------------------

test("a fully configured welcome can send", () => {
  assert.equal(welcomeProblem(readWelcome(CONFIGURED)), null);
  assert.equal(canSendWelcome(readWelcome(CONFIGURED)), true);
});

test("switched off is not a problem to report", () => {
  // Nothing is wrong with choosing not to send one.
  assert.equal(welcomeProblem(readWelcome({ ...CONFIGURED, enabled: false })), null);
  assert.equal(canSendWelcome(readWelcome({ ...CONFIGURED, enabled: false })), false);
});

test("each missing piece is named, not lumped into 'not set up'", () => {
  assert.match(welcomeProblem(readWelcome({ ...CONFIGURED, org_id: "" }))!, /workspace/i);
  assert.match(welcomeProblem(readWelcome({ ...CONFIGURED, template_name: "" }))!, /template/i);
  // Not through readWelcome: a blank language there falls back to "en",
  // so this guards a caller that built the settings itself.
  assert.match(
    welcomeProblem({ ...readWelcome(CONFIGURED), language: "" })!,
    /language/i
  );
});

test("a template name Meta would not accept is caught before sending", () => {
  // Meta's names are lowercase, digits and underscores. "Welcome Message"
  // comes back as a 404 that names nothing.
  assert.match(
    welcomeProblem(readWelcome({ ...CONFIGURED, template_name: "Welcome Message" }))!,
    /lowercase/i
  );
});

test("no connection named is fine — the workspace default is used", () => {
  assert.equal(welcomeProblem(readWelcome({ ...CONFIGURED, connection_id: "" })), null);
});

// --- the parameters --------------------------------------------------------

test("a template with a name variable is sent exactly one parameter", () => {
  const components = welcomeComponents(readWelcome(CONFIGURED), "Vivek");
  assert.deepEqual(components, [
    { type: "body", parameters: [{ type: "text", text: "Vivek" }] },
  ]);
});

test("a template with no variables is sent none", () => {
  // Meta counts them. One too many is refused exactly as hard as one too
  // few — that is the 132000 that broke every campaign.
  assert.deepEqual(welcomeComponents(readWelcome({ ...CONFIGURED, uses_name: false }), "Vivek"), []);
});

test("a missing name never becomes an empty parameter", () => {
  for (const name of ["", "   "]) {
    const components = welcomeComponents(readWelcome(CONFIGURED), name);
    assert.equal(components[0].parameters[0].text, "there");
  }
});

test("the greeting uses a first name, not the whole one", () => {
  assert.equal(greetingName("Vivek Sharma"), "Vivek");
  assert.equal(greetingName("  Vivek  "), "Vivek");
  assert.equal(greetingName(null), "");
  assert.equal(greetingName(""), "");
});
