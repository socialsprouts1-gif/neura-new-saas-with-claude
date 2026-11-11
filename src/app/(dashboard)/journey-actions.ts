"use server";

import { createClient } from "@/lib/supabase/server";
import { requireFeature } from "@/lib/org";
import { DEFAULT_SETTINGS, type DripStep } from "@/lib/drip";
import { starterFor, templateNameFor, type JourneyStarter } from "@/lib/journey-starters";
import { submitTemplate } from "./campaign-actions";
import { saveDrip } from "./drip-actions";
import type { ActionResult } from "./actions";

// Building a whole journey from one click.
//
// What makes a follow-up sequence hard to start is not the engine, it is
// the four WhatsApp templates it needs before it can send anything — each
// written, submitted, and waiting on Meta. Nobody gets through that on a
// Tuesday afternoon to find out whether follow-up works for them.
//
// So this does the whole of it: creates the templates, submits them for
// approval, and leaves a draft sequence wired to them. Nothing sends until
// somebody switches it on, which is the point — the words are ours and
// they are going out under the business's name, so they get read first.
//
// Deliberately built on submitTemplate and saveDrip rather than writing
// the rows here. Both carry rules this must not get a second, quieter
// version of: which WhatsApp account a template is created on, what Meta
// does with a media header, how a rejection is explained, and what makes
// a sequence refusable.

export interface StarterResult extends ActionResult {
  /** The sequence, once it exists, so the screen can open it. */
  id?: string;
  /** Templates that went to Meta on this run and are waiting on approval. */
  pending?: number;
  /** Templates that already existed and were reused as they are. */
  reused?: number;
}

export async function buildJourneyFromStarter(formData: FormData): Promise<StarterResult> {
  const { orgId } = await requireFeature("drip");

  const key = String(formData.get("starter") ?? "").trim();
  const starter = starterFor(key);
  if (!starter) return { ok: false, error: "That ready-made journey no longer exists." };

  const appointmentTypeId = String(formData.get("appointment_type_id") ?? "").trim() || null;
  const connectionId = String(formData.get("connection_id") ?? "").trim() || null;

  const supabase = await createClient();

  // What this workspace already has under these names. Checked in one
  // query rather than per step: running the same starter twice must reuse
  // the approved templates, not submit a second copy of each and put the
  // operator back in the approval queue for nothing.
  const names = starter.steps.map((step) => templateNameFor(starter, step));
  const { data: existing } = await supabase
    .from("message_templates")
    .select("id, name, status")
    .eq("org_id", orgId)
    .in("name", names);

  const known = new Map((existing ?? []).map((row) => [row.name, row]));

  const steps: DripStep[] = [];
  let pending = 0;
  let reused = 0;

  for (const [index, step] of starter.steps.entries()) {
    const name = templateNameFor(starter, step);
    const already = known.get(name);

    // A rejected template is worse than a missing one: wired into a
    // sequence it looks finished and can never send. Submit it again.
    if (already && already.status !== "rejected") {
      steps.push(toStep(index, starter, already.id));
      reused += 1;
      continue;
    }

    const submission = new FormData();
    submission.set("name", name);
    submission.set("language", "en_US");
    submission.set("category", step.category);
    submission.set("header_format", "NONE");
    submission.set("body", step.body);
    submission.set("footer", step.footer ?? "");
    submission.set("buttons", "[]");
    submission.set("samples", (step.samples ?? []).join("\n"));
    if (connectionId) submission.set("connection_id", connectionId);

    const result = await submitTemplate(submission);

    if (!result.ok || !result.id) {
      // Stopped here rather than carried on. A sequence missing its third
      // message is a sequence that goes quiet half way through for
      // everybody in it, and that is harder to notice than a refusal.
      return {
        ok: false,
        error: `Message ${index + 1} of this journey could not be created: ${
          result.error ?? "Meta refused it."
        }`,
      };
    }

    steps.push(toStep(index, starter, result.id));
    pending += 1;
  }

  const saved = await saveDrip({
    name: starter.name,
    description: starter.description,
    connectionId,
    settings: {
      ...DEFAULT_SETTINGS,
      trigger: "appointment",
      triggerEvent: starter.event,
      triggerAppointmentTypeId: appointmentTypeId,
      // Deliberately NOT exit-on-reply.
      //
      // Every one of these messages asks for a reply — "tell us if it
      // still hurts", "reply BOOK". Stopping the sequence when somebody
      // answers would mean the people who engaged are exactly the ones
      // who never get the check-in, the review request or the recall six
      // months later. The gaps here are days and months apart, so a
      // scheduled message landing in a conversation is not the problem it
      // is in a sequence that sends daily.
      //
      // A way out there must still be, so: an exit keyword.
      exitOnReply: false,
      exitOnKeyword: true,
      exitKeywords: ["stop", "unsubscribe"],
    },
    steps,
    activate: false,
  });

  if (!saved.ok) return { ok: false, error: saved.error };

  return {
    ok: true,
    id: saved.id,
    pending,
    reused,
    message: pending
      ? `Created as a draft. ${pending} message${pending === 1 ? "" : "s"} ${
          pending === 1 ? "has" : "have"
        } gone to Meta for approval — switch the sequence on once ${
          pending === 1 ? "it is" : "they are"
        } approved.`
      : "Created as a draft, using the templates you already have. Read it through and switch it on.",
  };
}

/** One starter step as a sequence step. The gap belongs to the step it follows. */
function toStep(index: number, starter: JourneyStarter, templateId: string): DripStep {
  const step = starter.steps[index];
  return {
    stepIndex: index + 1,
    templateId,
    variables: step.variables ?? [],
    waitKind: "duration",
    waitMinutes: step.waitMinutes,
    sendAtMinutes: 600,
    sendAtDays: 1,
  };
}
