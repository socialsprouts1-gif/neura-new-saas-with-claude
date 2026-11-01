import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/crypto";
import { followsAccount, sendMessage } from "@/lib/instagram-api";
import { FOLLOW_BUTTON, ruleFromPayload } from "@/lib/instagram";
import {
  asLoadedRule,
  bump,
  RULE_COLUMNS,
  sendEmailPrompt,
  sendRuleMessage,
} from "@/lib/instagram-deliver";

// Somebody tapped "I'm following".
//
// This is the second half of a gated automation, and the only moment
// the follow can actually be checked — Instagram refuses to say whether
// a person follows an account until that person has interacted with it,
// and the tap is the interaction. Checking silently at comment time is
// not merely rude, it is an error.
//
// A tap that turns out to be a fib gets the ask again rather than the
// link. Sending anyway would make the gate decorative, and nobody would
// follow a second time.

const NOT_YET =
  "I can't see the follow yet — give Instagram a second, then tap the button again 🙏";

export async function handlePostback(
  connection: {
    id: string;
    org_id: string;
    ig_user_id: string;
    access_token_encrypted: string;
  },
  input: { personId: string; payload: string; deliveryId?: string | null }
): Promise<void> {
  // The tap can reach us twice: once as a postback, and once as a plain
  // message, because Instagram also shows the button's title as
  // something the person said.
  //
  // Claimed on the tap's own id, not on the pending row. That row is
  // keyed by the id Instagram used for the person in the *comment*
  // webhook, and nothing guarantees it is the id the messaging webhook
  // uses for them. Requiring it would make a mismatch look exactly like
  // the bug this is fixing — asked, tapped, never answered — except
  // permanently, and for everybody.
  const ruleId = ruleFromPayload(input.payload);
  if (!ruleId) return;

  const admin = createAdminClient();

  const { data: row } = await admin
    .from("instagram_comment_rules")
    .select(RULE_COLUMNS)
    .eq("id", ruleId)
    .eq("org_id", connection.org_id)
    .maybeSingle();

  // Deleted between the ask and the tap. Nothing to send, and an error
  // message about a missing automation means nothing to the person
  // holding the phone.
  if (!row || !row.is_active) return;

  const rule = asLoadedRule(row as Parameters<typeof asLoadedRule>[0]);
  const token = decryptToken(connection.access_token_encrypted);

  const check = await followsAccount({
    igUserId: connection.ig_user_id,
    personId: input.personId,
    token,
  });

  // A check that could not run is not a refusal. Instagram being
  // briefly unavailable should not cost somebody the thing they
  // followed for, so an unanswerable check sends the message.
  const follows = check.ok ? check.follows : true;

  if (!follows) {
    await sendMessage({
      igUserId: connection.ig_user_id,
      recipient: { id: input.personId },
      text: NOT_YET,
      buttons: [{ title: FOLLOW_BUTTON, payload: input.payload }],
      token,
    });
    return;
  }

  // Claim this delivery. The events table has a unique index on the id
  // column, so a redelivery of the same tap conflicts here and stops
  // before a second copy goes out. A tap with no id of its own — the
  // text fallback — was already claimed by the message row that
  // carried it, so it needs no second guard.
  if (input.deliveryId) {
    const { error: claimError } = await admin.from("instagram_comment_events").insert({
      org_id: connection.org_id,
      connection_id: connection.id,
      rule_id: ruleId,
      kind: "follow_gate",
      comment_id: input.deliveryId,
      ig_user_id: input.personId,
      outcome: "matching",
      comment_text: "Tapped “I'm following”",
    });
    if (claimError) {
      // 23505 is the unique index doing its job.
      if (claimError.code !== "23505") {
        console.error("Could not claim an Instagram button tap", claimError);
      }
      return;
    }
  }

  const finish = async (outcome: string, error?: string) => {
    if (input.deliveryId) {
      await admin
        .from("instagram_comment_events")
        .update({ outcome, error: error ?? null })
        .eq("comment_id", input.deliveryId);
      return;
    }
    await admin.from("instagram_comment_events").insert({
      org_id: connection.org_id,
      connection_id: connection.id,
      rule_id: ruleId,
      kind: "follow_gate",
      ig_user_id: input.personId,
      outcome,
      error: error ?? null,
      comment_text: "Tapped “I'm following”",
    });
  };

  const outcome = await sendRuleMessage({
    connection,
    rule,
    recipient: { id: input.personId },
    token,
  });

  if (!outcome.ok) {
    console.error(`Instagram gated send failed: ${outcome.error}`);
    // Recorded rather than swallowed: a gate that asks and then goes
    // quiet is the worst failure this feature has, and without a row
    // here the screen cannot say it happened.
    await finish("failed", outcome.error);
    return;
  }

  await bump(admin, ruleId, "sent_count");
  await finish("sent");

  // The follower tally, when the pending row can be found. It is a
  // number on a screen, so a lookup that misses costs a number rather
  // than the message — which is why the send never waited for it.
  const { data: claimed } = await admin
    .from("instagram_pending_sends")
    .delete()
    .eq("org_id", connection.org_id)
    .eq("ig_user_id", input.personId)
    .eq("rule_id", ruleId)
    .select("id");

  if (claimed && claimed.length > 0) {
    await bump(admin, ruleId, "follower_gain_count");
  }

  await sendEmailPrompt({ connection, rule, personId: input.personId, token });
}
