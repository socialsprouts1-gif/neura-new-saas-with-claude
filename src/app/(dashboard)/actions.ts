"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { encryptToken } from "@/lib/crypto";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

// Every action re-derives the org server-side from the session. The org is
// never taken from the form, so a tampered payload cannot write into another
// tenant even before RLS gets involved.

export async function connectWaba(formData: FormData): Promise<ActionResult> {
  const { orgId, role } = await requireOrg();
  if (role !== "owner" && role !== "admin") {
    return { ok: false, error: "Only owners and admins can connect a WhatsApp number." };
  }

  const wabaId = String(formData.get("waba_id") ?? "").trim();
  const phoneNumberId = String(formData.get("phone_number_id") ?? "").trim();
  const metaAppId = String(formData.get("meta_app_id") ?? "").trim();
  const accessToken = String(formData.get("access_token") ?? "").trim();

  if (!wabaId || !phoneNumberId || !metaAppId || !accessToken) {
    return { ok: false, error: "All fields are required." };
  }

  let encrypted: string;
  try {
    encrypted = encryptToken(accessToken);
  } catch (err) {
    // Surface the real reason. Swallowing it made a missing variable and a
    // mis-pasted one look identical, which is the difference between "add
    // it" and "fix it".
    return {
      ok: false,
      error: `Can't store the access token securely — ${
        err instanceof Error ? err.message : "encryption failed"
      } Add it in Vercel → Settings → Environment Variables, then redeploy.`,
    };
  }

  const supabase = await createClient();

  // Reuse the existing verify token when this number is already connected.
  // Regenerating it on every save silently breaks a webhook already
  // registered with Meta — reconnecting to rotate an expiring access token
  // would invalidate the handshake, and Meta's only feedback is a generic
  // "couldn't be validated". The token is a handshake secret, not a
  // credential that needs rotating alongside the access token.
  const { data: existing } = await supabase
    .from("waba_connections")
    .select("webhook_verify_token")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();

  const { error } = await supabase.from("waba_connections").upsert(
    {
      org_id: orgId,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      meta_app_id: metaAppId,
      access_token_encrypted: encrypted,
      // Generated here rather than typed by the user: it is a shared secret
      // Meta echoes back during verification, so it should be unguessable.
      webhook_verify_token:
        existing?.webhook_verify_token ?? randomBytes(24).toString("base64url"),
      status: "active",
    },
    { onConflict: "phone_number_id" }
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return {
    ok: true,
    message: existing
      ? "WhatsApp number updated. The verify token is unchanged, so your webhook stays registered."
      : "WhatsApp number connected.",
  };
}

export async function regenerateVerifyToken(formData: FormData): Promise<ActionResult> {
  const { orgId, role } = await requireOrg();
  if (role !== "owner" && role !== "admin") {
    return { ok: false, error: "Only owners and admins can regenerate the verify token." };
  }

  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("waba_connections")
    .update({ webhook_verify_token: randomBytes(24).toString("base64url") })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return {
    ok: true,
    message: "New verify token generated. Re-register the webhook in Meta with the new value.",
  };
}

export async function disconnectWaba(formData: FormData): Promise<ActionResult> {
  const { orgId, role } = await requireOrg();
  if (role !== "owner" && role !== "admin") {
    return { ok: false, error: "Only owners and admins can disconnect a number." };
  }

  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("waba_connections").delete().eq("id", id).eq("org_id", orgId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true, message: "Number disconnected." };
}

export async function renameOrganization(formData: FormData): Promise<ActionResult> {
  const { orgId, role } = await requireOrg();
  if (role !== "owner" && role !== "admin") {
    return { ok: false, error: "Only owners and admins can rename the organization." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Name cannot be empty." };

  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ name }).eq("id", orgId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true, message: "Organization renamed." };
}

export async function createContact(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();

  const waId = String(formData.get("wa_id") ?? "").replace(/[^\d]/g, "");
  const name = String(formData.get("name") ?? "").trim();
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!waId) return { ok: false, error: "A WhatsApp number is required (digits only, with country code)." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .upsert({ org_id: orgId, wa_id: waId, name: name || null, tags }, { onConflict: "org_id,wa_id" });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/contacts");
  return { ok: true, message: "Contact saved." };
}

export async function deleteContact(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const id = String(formData.get("id") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id).eq("org_id", orgId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/contacts");
  return { ok: true, message: "Contact deleted." };
}

export async function createCampaign(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();

  const name = String(formData.get("name") ?? "").trim();
  const templateId = String(formData.get("template_id") ?? "") || null;
  const scheduledAt = String(formData.get("scheduled_at") ?? "").trim();
  const tag = String(formData.get("tag") ?? "").trim();

  if (!name) return { ok: false, error: "Campaign name is required." };

  const supabase = await createClient();
  const { error } = await supabase.from("campaigns").insert({
    org_id: orgId,
    template_id: templateId,
    // Stored as a filter document so the segment can grow richer later
    // without a schema change.
    segment_filter: tag ? { tags: [tag] } : {},
    scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    status: scheduledAt ? "scheduled" : "draft",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/campaigns");
  return { ok: true, message: "Campaign created." };
}

export async function createAutomation(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();

  const name = String(formData.get("name") ?? "").trim();
  const triggerType = String(formData.get("trigger_type") ?? "keyword");
  const keyword = String(formData.get("keyword") ?? "").trim();
  const reply = String(formData.get("reply") ?? "").trim();

  if (!name) return { ok: false, error: "Automation name is required." };
  if (triggerType === "keyword" && !keyword) {
    return { ok: false, error: "A keyword is required for keyword triggers." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("automation_flows").insert({
    org_id: orgId,
    name,
    trigger_type: triggerType,
    trigger_config: triggerType === "keyword" ? { keyword } : {},
    actions_json: reply ? [{ type: "send_text", body: reply }] : [],
    is_active: true,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/automations");
  return { ok: true, message: "Automation created." };
}

export async function toggleAutomation(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("is_active") ?? "") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("automation_flows")
    .update({ is_active: !isActive })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/automations");
  return { ok: true };
}

export async function createSupportTicket(formData: FormData): Promise<ActionResult> {
  const { orgId, user } = await requireOrg();

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const priority = String(formData.get("priority") ?? "normal");

  if (!subject || !body) return { ok: false, error: "Subject and message are required." };

  const supabase = await createClient();
  const { error } = await supabase.from("support_tickets").insert({
    org_id: orgId,
    created_by: user.id,
    subject,
    body,
    priority: priority as "low" | "normal" | "high" | "urgent",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  return { ok: true, message: "Support ticket raised." };
}

export async function toggleConversationBot(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();

  const id = String(formData.get("id") ?? "");
  const enable = String(formData.get("bot_enabled") ?? "") !== "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("conversations")
    // Turning the bot back on also clears any half-finished flow, so it
    // resumes by matching the next message fresh rather than replying from
    // wherever the customer abandoned it before a human stepped in.
    .update({
      bot_enabled: enable,
      bot_flow_id: null,
      bot_node_id: null,
      status: enable ? "open" : "pending",
    })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/inbox");
  return {
    ok: true,
    message: enable ? "Automated replies resumed." : "Automated replies paused for this chat.",
  };
}
