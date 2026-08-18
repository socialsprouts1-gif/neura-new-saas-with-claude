import { createHmac, timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// --- Meta webhook payload shapes (loose — only the fields we read) -------

interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      field: string;
      value: MetaWebhookValue;
    }>;
  }>;
}

interface MetaWebhookValue {
  messaging_product?: "whatsapp";
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
  messages?: MetaInboundMessage[];
  statuses?: MetaStatusUpdate[];
}

interface MetaInboundMessage {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  [key: string]: unknown;
}

interface MetaStatusUpdate {
  id: string;
  status: string;
  timestamp: string;
  recipient_id: string;
}

const VALID_MESSAGE_STATUSES = new Set(["sent", "delivered", "read", "failed"]);

// --- GET: Meta's webhook verification handshake ---------------------------
// https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: connection } = await supabase
    .from("waba_connections")
    .select("id")
    .eq("webhook_verify_token", token)
    .maybeSingle();

  if (!connection) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(challenge, { status: 200 });
}

// --- POST: inbound messages + status updates ------------------------------

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-hub-signature-256");

  if (!isValidSignature(rawBody, signatureHeader)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  // Meta expects a fast 200 and will retry (with backoff, then eventually
  // give up) if the callback is slow or errors — so ack immediately and do
  // the DB writes after the response is flushed.
  after(() => processWebhookPayload(payload).catch((error) => {
    console.error("Error processing WhatsApp webhook payload", error);
  }));

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}

function isValidSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;

  const [scheme, signatureHex] = signatureHeader.split("=");
  if (scheme !== "sha256" || !signatureHex) return false;

  const expectedHex = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(signatureHex, "hex");
  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}

async function processWebhookPayload(payload: MetaWebhookPayload) {
  const supabase = createAdminClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      await processChangeValue(supabase, change.value);
    }
  }
}

async function processChangeValue(
  supabase: ReturnType<typeof createAdminClient>,
  value: MetaWebhookValue
) {
  const phoneNumberId = value.metadata?.phone_number_id;
  if (!phoneNumberId) return;

  const { data: connection, error: connectionError } = await supabase
    .from("waba_connections")
    .select("org_id")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();

  if (connectionError || !connection) {
    console.error(`No waba_connection found for phone_number_id ${phoneNumberId}`, connectionError);
    return;
  }

  if (value.messages?.length) {
    await handleInboundMessages(supabase, connection.org_id, value);
  }
  if (value.statuses?.length) {
    await handleStatusUpdates(supabase, value.statuses);
  }
}

async function handleInboundMessages(
  supabase: ReturnType<typeof createAdminClient>,
  orgId: string,
  value: MetaWebhookValue
) {
  const nameByWaId = new Map(
    (value.contacts ?? []).map((c) => [c.wa_id, c.profile?.name] as const)
  );

  for (const message of value.messages ?? []) {
    const waId = message.from;
    const name = nameByWaId.get(waId);

    const contactPayload: { org_id: string; wa_id: string; name?: string } = {
      org_id: orgId,
      wa_id: waId,
    };
    // Only include name when Meta actually sent one, so a repeat message
    // without a contacts[] entry doesn't null out a name we already have.
    if (name) contactPayload.name = name;

    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .upsert(contactPayload, { onConflict: "org_id,wa_id" })
      .select("id")
      .single();

    if (contactError || !contact) {
      console.error("Failed to upsert contact", contactError);
      continue;
    }

    const timestampMs = Number(message.timestamp) * 1000;
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .upsert(
        {
          org_id: orgId,
          contact_id: contact.id,
          last_message_at: new Date(timestampMs).toISOString(),
          status: "open",
        },
        { onConflict: "org_id,contact_id" }
      )
      .select("id")
      .single();

    if (conversationError || !conversation) {
      console.error("Failed to upsert conversation", conversationError);
      continue;
    }

    const { error: messageError } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      direction: "inbound",
      type: message.type,
      content: extractMessageContent(message),
      wa_message_id: message.id,
      status: "delivered",
    });

    if (messageError) {
      console.error("Failed to insert inbound message", messageError);
    }
  }
}

async function handleStatusUpdates(
  supabase: ReturnType<typeof createAdminClient>,
  statuses: MetaStatusUpdate[]
) {
  for (const status of statuses) {
    if (!VALID_MESSAGE_STATUSES.has(status.status)) continue;

    const { error } = await supabase
      .from("messages")
      .update({ status: status.status as "sent" | "delivered" | "read" | "failed" })
      .eq("wa_message_id", status.id);

    if (error) {
      console.error(`Failed to update status for message ${status.id}`, error);
    }
  }
}

function extractMessageContent(message: MetaInboundMessage): Record<string, unknown> {
  // The type-specific payload (text/image/video/audio/document/location/
  // interactive/button/reaction/...) lives under a key matching `type`.
  // Fall back to the whole message for types with no such sub-object.
  const typed = message[message.type];
  return typed && typeof typed === "object" ? (typed as Record<string, unknown>) : message;
}
