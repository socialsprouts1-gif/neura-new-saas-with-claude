import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FLOW_JSON_VERSION,
  buildFlowJson,
  newField,
  newScreen,
  normaliseFieldName,
  normaliseScreenId,
  uniqueName,
  validateFlow,
  answerKeys,
  type FormField,
  type FormScreen,
} from "../src/lib/flow-json.ts";

function field(over: Partial<FormField> = {}): FormField {
  return {
    key: "k",
    kind: "TextInput",
    text: "",
    name: "full_name",
    label: "Your Name",
    inputType: "text",
    required: true,
    helperText: "",
    options: [],
    ...over,
  };
}

function screen(over: Partial<FormScreen> = {}): FormScreen {
  return {
    key: "s",
    screenId: "SCREEN_1",
    title: "Basic",
    buttonLabel: "Continue",
    fields: [field()],
    ...over,
  };
}

test("a one-screen form completes rather than navigating", () => {
  const json = buildFlowJson([screen()]);

  assert.equal(json.version, FLOW_JSON_VERSION);
  const only = json.screens[0] as Record<string, unknown>;
  assert.equal(only.terminal, true);
  assert.equal(only.success, true);

  const form = (only.layout as { children: Array<Record<string, unknown>> }).children[0];
  const children = form.children as Array<Record<string, unknown>>;
  const footer = children[children.length - 1];
  assert.equal(footer.type, "Footer");
  assert.deepEqual(footer["on-click-action"], {
    name: "complete",
    payload: { full_name: "${form.full_name}" },
  });
});

test("inputs live inside a Form named form", () => {
  const layout = buildFlowJson([screen()]).screens[0].layout as {
    type: string;
    children: Array<Record<string, unknown>>;
  };
  assert.equal(layout.type, "SingleColumnLayout");
  assert.equal(layout.children[0].type, "Form");
  assert.equal(layout.children[0].name, "form");
});

test("component properties are hyphenated the way Meta expects", () => {
  const json = buildFlowJson([
    screen({
      fields: [
        field({ inputType: "email", helperText: "We'll only use this to reply" }),
        field({ kind: "Dropdown", name: "city", label: "City", options: [{ id: "1", title: "Pune" }] }),
      ],
    }),
  ]);
  const children = (
    (json.screens[0].layout as { children: Array<{ children: Array<Record<string, unknown>> }> })
      .children[0].children
  );

  assert.equal(children[0]["input-type"], "email");
  assert.equal(children[0]["helper-text"], "We'll only use this to reply");
  assert.deepEqual(children[1]["data-source"], [{ id: "1", title: "Pune" }]);
  // The snake_case spellings must not appear at all.
  assert.equal(children[0].input_type, undefined);
  assert.equal(children[1].data_source, undefined);
});

test("blank helper text is omitted rather than sent empty", () => {
  const children = (
    (buildFlowJson([screen()]).screens[0].layout as {
      children: Array<{ children: Array<Record<string, unknown>> }>;
    }).children[0].children
  );
  assert.ok(!("helper-text" in children[0]));
});

test("a middle screen navigates and relays what it has collected", () => {
  const json = buildFlowJson([
    screen({ screenId: "ONE", fields: [field({ name: "full_name" })] }),
    screen({
      screenId: "TWO",
      fields: [field({ name: "email", label: "Email", inputType: "email" })],
    }),
  ]);

  const first = json.screens[0] as Record<string, unknown>;
  assert.equal(first.terminal, undefined);

  const firstFooter = (
    (first.layout as { children: Array<{ children: Array<Record<string, unknown>> }> })
      .children[0].children
  ).at(-1)!;
  assert.deepEqual(firstFooter["on-click-action"], {
    name: "navigate",
    next: { type: "screen", name: "TWO" },
    payload: { full_name: "${form.full_name}" },
  });

  // The second screen must declare what it was handed, or the reference
  // below would not type-check on Meta's side.
  const second = json.screens[1] as Record<string, unknown>;
  assert.deepEqual(second.data, {
    full_name: { type: "string", __example__: "" },
  });

  const lastFooter = (
    (second.layout as { children: Array<{ children: Array<Record<string, unknown>> }> })
      .children[0].children
  ).at(-1)!;
  // Relayed answers come from data, this screen's own from form.
  assert.deepEqual(lastFooter["on-click-action"], {
    name: "complete",
    payload: { full_name: "${data.full_name}", email: "${form.email}" },
  });
});

test("relayed answers declare the right type", () => {
  const json = buildFlowJson([
    screen({
      screenId: "ONE",
      fields: [
        field({ kind: "OptIn", name: "agreed", label: "I agree" }),
        field({ kind: "CheckboxGroup", name: "topics", label: "Topics", options: [{ id: "a", title: "A" }] }),
      ],
    }),
    screen({ screenId: "TWO" }),
  ]);

  assert.deepEqual(json.screens[1].data, {
    agreed: { type: "boolean", __example__: false },
    topics: { type: "array", items: { type: "string" }, __example__: [] },
  });
});

test("display-only components are not relayed", () => {
  const json = buildFlowJson([
    screen({ screenId: "ONE", fields: [field({ kind: "TextHeading", text: "Hello" })] }),
    screen({ screenId: "TWO" }),
  ]);
  assert.equal(json.screens[1].data, undefined);
});

test("validateFlow accepts a well-formed form", () => {
  assert.deepEqual(validateFlow([screen()]), { ok: true, errors: [] });
});

test("two questions cannot share a name, even across screens", () => {
  const result = validateFlow([
    screen({ screenId: "ONE" }),
    screen({ screenId: "TWO" }),
  ]);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("both named")));
});

test("SUCCESS is refused as a screen id", () => {
  const result = validateFlow([screen({ screenId: "SUCCESS" })]);
  assert.ok(result.errors.some((error) => error.includes("reserved")));
});

test("a field name that isn't an identifier is refused", () => {
  const result = validateFlow([screen({ fields: [field({ name: "Full Name" })] })]);
  assert.ok(result.errors.some((error) => error.includes("lowercase letters")));
});

test("an over-long label is caught before Meta sees it", () => {
  const result = validateFlow([screen({ fields: [field({ label: "x".repeat(21) })] })]);
  assert.ok(result.errors.some((error) => error.includes("over 20 characters")));
  // A date picker gets 40, so the same label passes there.
  assert.equal(
    validateFlow([
      screen({ fields: [field({ kind: "DatePicker", label: "x".repeat(21) })] }),
    ]).ok,
    true
  );
});

test("an empty screen and a choice with no options are both refused", () => {
  assert.ok(
    validateFlow([screen({ fields: [] })]).errors.some((error) => error.includes("empty"))
  );
  assert.ok(
    validateFlow([
      screen({ fields: [field({ kind: "Dropdown", name: "city", options: [] })] }),
    ]).errors.some((error) => error.includes("no options"))
  );
});

test("normaliseFieldName produces an identifier", () => {
  assert.equal(normaliseFieldName("Your Name"), "your_name");
  assert.equal(normaliseFieldName("  E-mail Address! "), "e_mail_address");
  // Must start with a letter.
  assert.equal(normaliseFieldName("1st choice"), "field_1st_choice");
});

test("normaliseScreenId shouts and starts with a letter", () => {
  assert.equal(normaliseScreenId("Contact us"), "CONTACT_US");
  assert.equal(normaliseScreenId("2nd step"), "SCREEN_2ND_STEP");
});

test("uniqueName only counts answering fields", () => {
  const existing = [field({ name: "email" }), field({ kind: "TextBody", name: "email" })];
  assert.equal(uniqueName("email", existing), "email_2");
  assert.equal(uniqueName("phone", existing), "phone");
});

test("newScreen and newField make something that validates", () => {
  const first = newScreen(0);
  first.fields = [newField("TextHeading"), newField("TextInput")];
  assert.equal(validateFlow([first]).ok, true);
});

test("answerKeys lists the submission shape in order", () => {
  assert.deepEqual(
    answerKeys([
      screen({ screenId: "ONE", fields: [field({ kind: "TextHeading", text: "Hi" }), field()] }),
      screen({ screenId: "TWO", fields: [field({ name: "email", label: "Email" })] }),
    ]),
    [
      { name: "full_name", label: "Your Name" },
      { name: "email", label: "Email" },
    ]
  );
});
