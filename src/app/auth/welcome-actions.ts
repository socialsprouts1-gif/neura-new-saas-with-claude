"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveConnection } from "@/lib/connections";
import { sendTemplateMessage, describeMetaError, MetaApiError } from "@/lib/meta-whatsapp";
import { normaliseWaNumber } from "@/lib/whatsapp-link";
import {
  readWelcome,
  canSendWelcome,
  welcomeComponents,
  greetingName,
} from "@/lib/signup-welcome";
import { recordOutboundTemplate } from "@/lib/outbound-log";

// Saying hello on WhatsApp, to somebody who just signed up for WhatsApp.
//
// A person who buys a WhatsApp automation product and hears nothing on
// WhatsApp has been shown the product not working, on the one day they
// were most willing to be impressed.
//
// It has to be a template. A brand-new contact has never written in, so
// the 24-hour service window is shut and Meta refuses free-form text to
// them outright. It goes out on the platform's own number, because at
// sign-up the customer has not connected one of their own.
//
// Nothing here is allowed to fail loudly. The account already exists and
// the person is watching a spinner: a welcome message that could not be
// sent must not turn into a sign-up that looks like it failed.

const WELCOME_SETTING = "platform_whatsapp";

/** How a welcome message is labelled, so a second one can be recognised. */
const WELCOME_SOURCE = "Sign-up welcome";

export interface WelcomeResult {
  sent: boolean;
  /** Only ever for the server log and the admin test button. */
  reason?: string;
}

/**
 * Sends the welcome template to whoever is signed in right now.
 *
 * Called from the browser straight after sign-up. Takes no arguments on
 * purpose: the number comes from the signed-in user's own metadata, so a
 * caller cannot use this to send a template to an arbitrary number.
 */
export async function sendSignupWelcome(): Promise<WelcomeResult> {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return { sent: false, reason: "Not signed in" };

    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const rawNumber =
      typeof metadata.whatsapp_number === "string"
        ? metadata.whatsapp_number
        : typeof metadata.phone === "string"
          ? metadata.phone
          : "";

    const waId = normaliseWaNumber(rawNumber);
    if (!waId) return { sent: false, reason: "No WhatsApp number on this account" };

    const admin = createAdminClient();

    const { data: setting } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", WELCOME_SETTING)
      .maybeSingle();

    const welcome = readWelcome(setting?.value);
    if (!canSendWelcome(welcome)) {
      return { sent: false, reason: "Welcome messages are not set up" };
    }

    // Sign-up can call this more than once — a refresh, a second tab, a
    // retried confirmation link — and being welcomed twice reads as the
    // automation being broken, which is the opposite of the point.
    if (await alreadyWelcomed(admin, welcome.orgId, waId)) {
      return { sent: false, reason: "Already welcomed" };
    }

    const connection = await resolveConnection(admin, welcome.orgId, {
      connectionId: welcome.connectionId || null,
    });
    if ("error" in connection) return { sent: false, reason: connection.error };

    const name = greetingName(
      typeof metadata.full_name === "string" ? metadata.full_name : ""
    );

    const result = await sendTemplateMessage(
      connection.phoneNumberId,
      waId,
      welcome.templateName,
      welcome.language,
      welcomeComponents(welcome, name),
      connection.accessToken
    );

    // Into the platform's own inbox, so whoever runs this business can see
    // every new sign-up as a conversation rather than as a row in a table.
    await recordOutboundTemplate(admin, {
      orgId: welcome.orgId,
      connectionId: connection.id,
      waId,
      contactName: typeof metadata.full_name === "string" ? metadata.full_name : null,
      templateName: welcome.templateName,
      language: welcome.language,
      body: name ? `Welcome to NeuraChat, ${name}.` : "Welcome to NeuraChat.",
      // Also how a repeat is recognised: the log of what was sent is the
      // record of having sent it, so there is no second flag to keep in
      // step with reality.
      source: WELCOME_SOURCE,
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
    // Logged, never surfaced as a sign-up failure: the account exists and
    // the person is already through the door.
    console.error("Could not send the sign-up welcome", reason);
    return { sent: false, reason };
  }
}

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Whether this number has had a welcome already.
 *
 * Read from the messages themselves rather than a flag on the workspace:
 * the log of what was sent is the record of having sent it, and a separate
 * flag is one more thing that can disagree with reality — recording a
 * welcome that never went out is worse than sending none.
 */
async function alreadyWelcomed(admin: Admin, orgId: string, waId: string): Promise<boolean> {
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
    .limit(50);

  return (sent ?? []).some(
    (row) => (row.content as { source?: unknown } | null)?.source === WELCOME_SOURCE
  );
}
