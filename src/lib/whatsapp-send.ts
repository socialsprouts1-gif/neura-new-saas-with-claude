import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { decryptToken } from "@/lib/crypto";
import {
  MetaApiError,
  sendInteractiveButtons,
  sendTextMessage,
  type MetaReplyButton,
} from "@/lib/meta-whatsapp";

// The single outbound path used by anything that is not a user clicking
// "send" in the inbox: the message runner today, campaigns and reminders
// next. It owns three things the callers kept getting wrong individually —
// decrypting the org's token, honouring WhatsApp's 24-hour service window,
// and logging the outbound message so it shows up in the thread.

export type RunnerClient = SupabaseClient<Database>;

// WhatsApp permits free-form messages only within 24 hours of the
// customer's last inbound message. Outside it, Meta rejects anything that
// is not an approved template.
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface OrgConnection {
  phoneNumberId: string;
  accessToken: string;
}

export type SendOutcome =
  | { ok: true; waMessageId: string | null }
  | { ok: false; error: string; outsideWindow?: boolean };

/**
 * Loads and decrypts the org's active WhatsApp credentials.
 *
 * Returns null rather than throwing when there is no active connection —
 * an org that has not finished onboarding is an ordinary state, not an
 * error worth aborting webhook processing over.
 */
export async function loadOrgConnection(
  supabase: RunnerClient,
  orgId: string
): Promise<OrgConnection | null> {
  const { data, error } = await supabase
    .from("waba_connections")
    .select("phone_number_id, access_token_encrypted")
    .eq("org_id", orgId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  try {
    return {
      phoneNumberId: data.phone_number_id,
      accessToken: decryptToken(data.access_token_encrypted),
    };
  } catch (err) {
    // A key rotation without re-encrypting stored tokens lands here. Say so
    // in the log: "send failed" alone sends people hunting in Meta.
    console.error(`Failed to decrypt the access token for org ${orgId}`, err);
    return null;
  }
}

export function isWithinServiceWindow(
  lastInboundAt: string | null | undefined,
  now: number = Date.now()
): boolean {
  if (!lastInboundAt) return false;
  const inboundMs = new Date(lastInboundAt).getTime();
  if (Number.isNaN(inboundMs)) return false;
  return now - inboundMs < SERVICE_WINDOW_MS;
}

interface SendArgs {
  supabase: RunnerClient;
  connection: OrgConnection;
  conversationId: string;
  toWaId: string;
  body: string;
  buttons?: MetaReplyButton[];
  /**
   * Skip the window check. Only for sends that answer an inbound message
   * we are holding in hand — there the window is open by definition and
   * re-reading a just-written column would only add a round trip.
   */
  skipWindowCheck?: boolean;
  /** Used for the window check when it is not skipped. */
  lastInboundAt?: string | null;
}

/**
 * Sends a free-form message and records it on the conversation.
 *
 * Never throws: every caller is inside webhook processing, where an
 * exception is a silently dropped customer message.
 */
export async function sendAndLogText({
  supabase,
  connection,
  conversationId,
  toWaId,
  body,
  buttons,
  skipWindowCheck = false,
  lastInboundAt,
}: SendArgs): Promise<SendOutcome> {
  if (!skipWindowCheck && !isWithinServiceWindow(lastInboundAt)) {
    return {
      ok: false,
      outsideWindow: true,
      error:
        "Outside WhatsApp's 24-hour service window — only approved templates can be sent to this contact.",
    };
  }

  const useButtons = Boolean(buttons?.length);

  let waMessageId: string | null = null;
  try {
    const result = useButtons
      ? await sendInteractiveButtons(
          connection.phoneNumberId,
          toWaId,
          body,
          buttons!,
          connection.accessToken
        )
      : await sendTextMessage(connection.phoneNumberId, toWaId, body, connection.accessToken);

    waMessageId = result.messages[0]?.id ?? null;
  } catch (error) {
    const message =
      error instanceof MetaApiError
        ? `Meta rejected the send (${error.status}): ${JSON.stringify(error.body)}`
        : error instanceof Error
          ? error.message
          : "Unknown send failure";
    console.error(`Failed to send to ${toWaId}`, error);
    return { ok: false, error: message };
  }

  // The message went out. From here on failures are logging failures — do
  // not report them as send failures, or a retry would double-send.
  const sentAt = new Date().toISOString();

  const { error: messageError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    direction: "outbound",
    type: useButtons ? "interactive" : "text",
    content: useButtons ? { body, buttons } : { body },
    wa_message_id: waMessageId,
    status: "sent",
  });

  if (messageError) {
    console.error("Sent to WhatsApp but failed to log the outbound message", messageError);
  }

  const { error: conversationError } = await supabase
    .from("conversations")
    .update({ last_message_at: sentAt })
    .eq("id", conversationId);

  if (conversationError) {
    console.error("Failed to bump conversation last_message_at", conversationError);
  }

  return { ok: true, waMessageId };
}
