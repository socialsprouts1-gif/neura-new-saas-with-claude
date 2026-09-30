import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveConnection } from "@/lib/connections";
import { sendTemplateMessage, describeMetaError, MetaApiError } from "@/lib/meta-whatsapp";
import { normaliseWaNumber } from "@/lib/whatsapp-link";
import { recordOutboundTemplate } from "@/lib/outbound-log";
import {
  readEvents,
  canSend,
  eventComponents,
  greetingName,
  eventSource,
  type EventKey,
} from "@/lib/whatsapp-events";

// Sending one of the platform's own messages to one of its customers.
//
// Every moment that matters — signing up, a trial running out, a payment
// landing — is the same three steps: look up what template was configured
// for it, send it to the number they gave, log it. So there is one
// function rather than one per moment.
//
// Nothing here is allowed to fail loudly. These run alongside something
// the customer is actually doing, and a message that could not be sent
// must never turn a successful sign-up or a successful payment into an
// error on their screen.

const SETTING = "platform_whatsapp";

export interface PlatformSendResult {
  sent: boolean;
  /** For the server log and the admin test button only. */
  reason?: string;
}

/**
 * Sends the configured template for one event to one person.
 *
 * Idempotent per person per event: the log of what was sent is the record
 * of having sent it, so there is no second flag to keep in step with
 * reality. Somebody who signs up, lets their trial lapse and pays gets
 * three different messages; somebody whose payment webhook is redelivered
 * gets one.
 */
export async function sendPlatformEvent(
  key: EventKey,
  recipient: { waId: string; name?: string | null }
): Promise<PlatformSendResult> {
  try {
    const waId = normaliseWaNumber(recipient.waId ?? "");
    if (!waId) return { sent: false, reason: "No usable WhatsApp number" };

    const admin = createAdminClient();

    const { data: setting } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", SETTING)
      .maybeSingle();

    const settings = readEvents(setting?.value);
    if (!canSend(settings, key)) {
      return { sent: false, reason: `No ${key} message is set up` };
    }

    const source = eventSource(key);

    if (await alreadySent(admin, settings.orgId, waId, source)) {
      return { sent: false, reason: "Already sent" };
    }

    const connection = await resolveConnection(admin, settings.orgId, {
      connectionId: settings.connectionId || null,
    });
    if ("error" in connection) return { sent: false, reason: connection.error };

    const message = settings.messages[key];
    const name = greetingName(recipient.name);

    const result = await sendTemplateMessage(
      connection.phoneNumberId,
      waId,
      message.templateName,
      message.language,
      eventComponents(settings, key, name),
      connection.accessToken
    );

    // Into the platform's own inbox, so whoever runs this business sees
    // every one of these as a conversation rather than as a log line —
    // and so a reply lands somewhere a person will read it.
    await recordOutboundTemplate(admin, {
      orgId: settings.orgId,
      connectionId: connection.id,
      waId,
      contactName: recipient.name ?? null,
      templateName: message.templateName,
      language: message.language,
      body: `${source}${name ? ` — ${name}` : ""}`,
      // Also how a repeat is recognised, which is why it is the event's
      // own label rather than something generic.
      source,
      waMessageId: result.messages[0]?.id ?? null,
    });

    return { sent: true };
  } catch (error) {
    const reason =
      error instanceof MetaApiError
        ? describeMetaError(error.status, error.body)
        : error instanceof Error
          ? error.message
          : "Unknown failure";
    console.error(`Could not send the ${key} message`, reason);
    return { sent: false, reason };
  }
}

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Whether this number has had this particular message already.
 *
 * Read from the messages themselves rather than a flag: the log of what
 * was sent is the record of having sent it, and a separate flag is one
 * more thing that can disagree with reality — recording a message that
 * never went out is worse than sending none.
 */
async function alreadySent(
  admin: Admin,
  orgId: string,
  waId: string,
  source: string
): Promise<boolean> {
  const { data: contact } = await admin
    .from("contacts")
    .select("id")
    .eq("org_id", orgId)
    .eq("wa_id", waId)
    .maybeSingle();

  if (!contact) return false;

  const { data: conversations } = await admin
    .from("conversations")
    .select("id")
    .eq("org_id", orgId)
    .eq("contact_id", contact.id)
    .limit(5);

  const ids = (conversations ?? []).map((row) => row.id);
  if (ids.length === 0) return false;

  const { data: sent } = await admin
    .from("messages")
    .select("id, content")
    .in("conversation_id", ids)
    .eq("direction", "outbound")
    .eq("type", "template")
    .limit(100);

  return (sent ?? []).some(
    (row) => (row.content as { source?: unknown } | null)?.source === source
  );
}

/**
 * The owner's WhatsApp number and name, for a message about their account.
 *
 * The owner, and only the owner — the same rule the billing emails
 * follow. A message about a lapsed plan sent to somebody who cannot pay
 * it is worse than one nobody gets.
 *
 * The number lives on the auth user rather than in profiles, because it
 * is collected at sign-up and at sign-in and never needs a table of its
 * own.
 */
export async function ownerWhatsApp(
  admin: Admin,
  orgId: string
): Promise<{ waId: string; name: string | null } | null> {
  try {
    const { data: member } = await admin
      .from("org_members")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    if (!member?.user_id) return null;

    const { data } = await admin.auth.admin.getUserById(member.user_id);
    const metadata = (data?.user?.user_metadata ?? {}) as Record<string, unknown>;

    const raw =
      typeof metadata.whatsapp_number === "string"
        ? metadata.whatsapp_number
        : typeof metadata.phone === "string"
          ? metadata.phone
          : "";

    const waId = normaliseWaNumber(raw);
    if (!waId) return null;

    return {
      waId,
      name: typeof metadata.full_name === "string" ? metadata.full_name : null,
    };
  } catch (error) {
    console.error("Could not read an owner's WhatsApp number", error);
    return null;
  }
}

/** Sends an event to a workspace's owner, when they have a number on file. */
export async function sendPlatformEventToOwner(
  key: EventKey,
  orgId: string
): Promise<PlatformSendResult> {
  const admin = createAdminClient();
  const owner = await ownerWhatsApp(admin, orgId);
  if (!owner) return { sent: false, reason: "The owner has no WhatsApp number on file" };
  return sendPlatformEvent(key, owner);
}
