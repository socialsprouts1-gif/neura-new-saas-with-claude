import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, SUPABASE_NOT_CONFIGURED_MESSAGE } from "@/lib/supabase/env";
import { decryptToken } from "@/lib/crypto";
import {
  sendTemplateMessage,
  sendTextMessage,
  MetaApiError,
  InvalidAccessTokenError,
  describeMetaError,
  type MetaTemplateComponent,
} from "@/lib/meta-whatsapp";

interface SendRequestBody {
  orgId?: string;
  contactId?: string;
  body?: string;
  templateName?: string;
  language?: string;
  components?: MetaTemplateComponent[];
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: SUPABASE_NOT_CONFIGURED_MESSAGE }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const body = payload as SendRequestBody;
  if (!body.orgId || !body.contactId) {
    return NextResponse.json({ error: "orgId and contactId are required" }, { status: 400 });
  }
  const isTemplate = typeof body.templateName === "string";
  if (!isTemplate && !body.body) {
    return NextResponse.json(
      { error: "Provide either body, or templateName and language" },
      { status: 400 }
    );
  }
  if (isTemplate && !body.language) {
    return NextResponse.json({ error: "language is required with templateName" }, { status: 400 });
  }

  // RLS scopes every query below to orgs the caller is a member of — an
  // orgId the user doesn't belong to simply matches no rows.
  const { data: connection, error: connectionError } = await supabase
    .from("waba_connections")
    .select("phone_number_id, access_token_encrypted")
    .eq("org_id", body.orgId)
    .eq("status", "active")
    .maybeSingle();

  if (connectionError || !connection) {
    return NextResponse.json(
      { error: "No active WhatsApp connection for this organization" },
      { status: 404 }
    );
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, wa_id")
    .eq("org_id", body.orgId)
    .eq("id", body.contactId)
    .maybeSingle();

  if (contactError || !contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .upsert(
      { org_id: body.orgId, contact_id: contact.id },
      { onConflict: "org_id,contact_id", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (conversationError || !conversation) {
    return NextResponse.json({ error: "Failed to resolve conversation" }, { status: 500 });
  }

  const accessToken = decryptToken(connection.access_token_encrypted);

  try {
    const messageType = isTemplate ? "template" : "text";
    const content = isTemplate
      ? { template_name: body.templateName, language: body.language, components: body.components ?? [] }
      : { body: body.body };

    const result = isTemplate
      ? await sendTemplateMessage(
          connection.phone_number_id,
          contact.wa_id,
          body.templateName!,
          body.language!,
          body.components ?? [],
          accessToken
        )
      : await sendTextMessage(connection.phone_number_id, contact.wa_id, body.body!, accessToken);

    const waMessageId = result.messages[0]?.id ?? null;

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        direction: "outbound",
        type: messageType,
        content,
        wa_message_id: waMessageId,
        status: "sent",
      })
      .select()
      .single();

    if (messageError) {
      console.error("Message sent to Meta but failed to log it", messageError);
    }

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id);

    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof MetaApiError) {
      // The composer renders `error` verbatim, so it has to be the sentence
      // that names the fix — not the label "Meta API error" over raw JSON.
      console.error("Meta rejected an operator send", error.body);
      return NextResponse.json({ error: describeMetaError(error.status, error.body) }, { status: 502 });
    }
    if (error instanceof InvalidAccessTokenError) {
      // Stored before the paste-time check existed, or edited since. Either
      // way the operator needs the sentence, not "Failed to send message".
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to send WhatsApp message", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
