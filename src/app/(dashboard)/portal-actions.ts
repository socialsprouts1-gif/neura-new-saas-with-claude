"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import type { FlowEdge, FlowNode } from "@/types/flow";
import { encryptToken } from "@/lib/crypto";
import { integrationBySlug } from "@/lib/integrations";
import type { ActionResult } from "./actions";

// As in actions.ts: the org is always re-derived from the session, never
// taken from the submitted form.

async function requireManager() {
  const ctx = await requireOrg();
  if (ctx.role !== "owner" && ctx.role !== "admin") return null;
  return ctx;
}

// ---------------------------------------------------------------- AI assistants

export async function saveAiAssistant(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();

  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() || "Support agent";
  const model = String(formData.get("model") ?? "claude-sonnet-5");
  const systemPrompt = String(formData.get("system_prompt") ?? "").trim();
  const temperature = Number(formData.get("temperature") ?? 0.7);

  if (!name) return { ok: false, error: "Assistant name is required." };
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    return { ok: false, error: "Temperature must be between 0 and 2." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("ai_assistants").insert({
    org_id: orgId,
    name,
    role,
    model,
    system_prompt: systemPrompt,
    temperature,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/ai-assistant");
  return { ok: true, message: "Assistant created." };
}

export async function deleteAiAssistant(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_assistants")
    .delete()
    .eq("id", String(formData.get("id") ?? ""))
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/ai-assistant");
  return { ok: true, message: "Assistant deleted." };
}

// ---------------------------------------------------------------- Chatbot

export async function saveChatbotFlow(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();

  const name = String(formData.get("name") ?? "").trim();
  const triggerType = String(formData.get("trigger_type") ?? "keyword");
  const triggerValue = String(formData.get("trigger_value") ?? "").trim() || null;
  const reply = String(formData.get("reply") ?? "").trim();
  const buttonsRaw = String(formData.get("buttons") ?? "").trim();

  if (!name) return { ok: false, error: "Bot name is required." };
  if (triggerType === "keyword" && !triggerValue) {
    return { ok: false, error: "A keyword is required for keyword triggers." };
  }

  // The quick form produces a real two-node graph rather than its own
  // shape, so opening it in the builder afterwards needs no conversion:
  // a trigger wired to one reply.
  const buttons = buttonsRaw
    ? buttonsRaw
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((title, index) => ({ id: `btn_${index}`, title }))
    : [];

  const stamp = Date.now().toString(36);
  const triggerId = `on_message_${stamp}`;
  const replyId = `send_${stamp}`;

  const nodes: FlowNode[] = [
    {
      id: triggerId,
      kind: "on_message",
      position: { x: 120, y: 180 },
      data: {
        keywords: triggerValue ? [triggerValue] : [],
        fuzzy: false,
        sensitivity: 80,
      },
    },
    {
      id: replyId,
      kind: buttons.length ? "send_buttons" : "send_text",
      position: { x: 470, y: 180 },
      data: buttons.length
        ? { body: reply || "Hi! How can we help?", footer: "", buttons }
        : { body: reply || "Hi! How can we help?" },
    },
  ];

  const edges: FlowEdge[] = [
    { id: `e_${stamp}`, source: triggerId, target: replyId, sourceHandle: null },
  ];

  const supabase = await createClient();
  const { error } = await supabase.from("chatbot_flows").insert({
    org_id: orgId,
    name,
    trigger_type: triggerType as "keyword" | "welcome" | "fallback" | "menu" | "business_hours",
    trigger_value: triggerValue,
    nodes,
    edges,
    entry_node_id: triggerId,
    is_active: false,
  });

  if (error) {
    // The partial unique index on active triggers surfaces here.
    if (error.code === "23505") {
      return { ok: false, error: "Another active bot already uses that trigger." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/chatbot");
  return { ok: true, message: "Bot created. Activate it when you're ready." };
}

export async function toggleChatbotFlow(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const isActive = String(formData.get("is_active") ?? "") === "true";

  const supabase = await createClient();
  const { error } = await supabase
    .from("chatbot_flows")
    .update({ is_active: !isActive })
    .eq("id", String(formData.get("id") ?? ""))
    .eq("org_id", orgId);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Another active bot already uses that trigger." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/chatbot");
  return { ok: true };
}

export async function deleteChatbotFlow(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const supabase = await createClient();
  const { error } = await supabase
    .from("chatbot_flows")
    .delete()
    .eq("id", String(formData.get("id") ?? ""))
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/chatbot");
  return { ok: true, message: "Bot deleted." };
}

// ---------------------------------------------------------------- FAQ

export async function saveFaqEntry(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();

  const question = String(formData.get("question") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();
  const keywords = String(formData.get("keywords") ?? "")
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  const category = String(formData.get("category") ?? "").trim() || null;

  if (!question || !answer) return { ok: false, error: "Question and answer are both required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("faq_entries")
    .insert({ org_id: orgId, question, answer, keywords, category });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/faq-bot");
  return { ok: true, message: "FAQ added." };
}

export async function deleteFaqEntry(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const supabase = await createClient();
  const { error } = await supabase
    .from("faq_entries")
    .delete()
    .eq("id", String(formData.get("id") ?? ""))
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/faq-bot");
  return { ok: true, message: "FAQ deleted." };
}

// ---------------------------------------------------------------- Reminders

export async function saveReminder(formData: FormData): Promise<ActionResult> {
  const { orgId, user } = await requireOrg();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim() || null;
  const contactId = String(formData.get("contact_id") ?? "") || null;
  const remindAt = String(formData.get("remind_at") ?? "").trim();

  if (!title) return { ok: false, error: "Title is required." };
  if (!remindAt) return { ok: false, error: "Pick a date and time." };

  const when = new Date(remindAt);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "That date could not be read." };

  const supabase = await createClient();
  const { error } = await supabase.from("reminders").insert({
    org_id: orgId,
    contact_id: contactId,
    created_by: user.id,
    title,
    body,
    remind_at: when.toISOString(),
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/reminders");
  return { ok: true, message: "Reminder scheduled." };
}

export async function cancelReminder(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const supabase = await createClient();
  const { error } = await supabase
    .from("reminders")
    .update({ status: "cancelled" })
    .eq("id", String(formData.get("id") ?? ""))
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/reminders");
  return { ok: true, message: "Reminder cancelled." };
}

// ---------------------------------------------------------------- Integrations

export async function connectIntegration(formData: FormData): Promise<ActionResult> {
  const ctx = await requireManager();
  if (!ctx) return { ok: false, error: "Only owners and admins can manage integrations." };

  const slug = String(formData.get("provider") ?? "");
  const def = integrationBySlug(slug);
  if (!def) return { ok: false, error: "Unknown integration." };

  const credentials: Record<string, string> = {};
  const config: Record<string, string> = {};

  for (const field of def.fields) {
    const value = String(formData.get(field.name) ?? "").trim();
    if (field.required && !value) {
      return { ok: false, error: `${field.label} is required.` };
    }
    if (!value) continue;
    // Anything secret is encrypted; non-secret settings such as a shop
    // domain stay queryable in config.
    if (field.type === "password") credentials[field.name] = value;
    else config[field.name] = value;
  }

  let encrypted: string | null = null;
  if (Object.keys(credentials).length > 0) {
    try {
      encrypted = encryptToken(JSON.stringify(credentials));
    } catch (err) {
      return {
        ok: false,
        error: `Can't store credentials securely — ${
          err instanceof Error ? err.message : "encryption failed"
        } Add it in Vercel → Settings → Environment Variables, then redeploy.`,
      };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("org_integrations").upsert(
    {
      org_id: ctx.orgId,
      provider: slug,
      status: "connected",
      credentials_encrypted: encrypted,
      config,
      last_error: null,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,provider" }
  );

  if (error) return { ok: false, error: error.message };

  // A webhook-based provider is only genuinely connected once the delivery
  // target exists, so create it in the same step.
  if (def.capability === "via_webhook" && config.target_url) {
    await supabase.from("outgoing_webhooks").upsert(
      {
        org_id: ctx.orgId,
        name: def.name,
        target_url: config.target_url,
        events: ["message.received", "message.status", "contact.created"],
        secret: randomBytes(24).toString("base64url"),
        is_active: true,
      },
      { onConflict: "id", ignoreDuplicates: false }
    );
  }

  revalidatePath("/integrations");
  return { ok: true, message: `${def.name} connected.` };
}

export async function disconnectIntegration(formData: FormData): Promise<ActionResult> {
  const ctx = await requireManager();
  if (!ctx) return { ok: false, error: "Only owners and admins can manage integrations." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("org_integrations")
    .delete()
    .eq("org_id", ctx.orgId)
    .eq("provider", String(formData.get("provider") ?? ""));

  if (error) return { ok: false, error: error.message };
  revalidatePath("/integrations");
  return { ok: true, message: "Disconnected." };
}

// ---------------------------------------------------------------- API keys

export async function createApiKey(formData: FormData): Promise<ActionResult> {
  const ctx = await requireManager();
  if (!ctx) return { ok: false, error: "Only owners and admins can create API keys." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Give the key a name so you can identify it later." };

  // Only the hash is stored. The plaintext is returned once, here, and can
  // never be recovered afterwards.
  const secret = randomBytes(24).toString("base64url");
  const key = `nc_live_${secret}`;
  const hash = createHash("sha256").update(key).digest("hex");

  const supabase = await createClient();
  const { error } = await supabase.from("api_keys").insert({
    org_id: ctx.orgId,
    name,
    key_prefix: key.slice(0, 12),
    key_hash: hash,
    created_by: ctx.user.id,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/api-endpoints");
  return { ok: true, message: `Copy this now — it is shown only once:  ${key}` };
}

export async function revokeApiKey(formData: FormData): Promise<ActionResult> {
  const ctx = await requireManager();
  if (!ctx) return { ok: false, error: "Only owners and admins can revoke API keys." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", String(formData.get("id") ?? ""))
    .eq("org_id", ctx.orgId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/api-endpoints");
  return { ok: true, message: "Key revoked." };
}

// ---------------------------------------------------------------- Webhooks

export async function createWebhook(formData: FormData): Promise<ActionResult> {
  const ctx = await requireManager();
  if (!ctx) return { ok: false, error: "Only owners and admins can manage webhooks." };

  const name = String(formData.get("name") ?? "").trim();
  const targetUrl = String(formData.get("target_url") ?? "").trim();

  if (!name) return { ok: false, error: "Name is required." };
  if (!/^https:\/\//i.test(targetUrl)) {
    return { ok: false, error: "The target URL must start with https://" };
  }

  const events = ["message.received", "message.status", "contact.created"].filter(
    (e) => formData.get(e) === "on"
  );

  const supabase = await createClient();
  const { error } = await supabase.from("outgoing_webhooks").insert({
    org_id: ctx.orgId,
    name,
    target_url: targetUrl,
    events: events.length ? events : ["message.received"],
    secret: randomBytes(24).toString("base64url"),
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/integrations");
  return { ok: true, message: "Webhook created." };
}

export async function deleteWebhook(formData: FormData): Promise<ActionResult> {
  const ctx = await requireManager();
  if (!ctx) return { ok: false, error: "Only owners and admins can manage webhooks." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("outgoing_webhooks")
    .delete()
    .eq("id", String(formData.get("id") ?? ""))
    .eq("org_id", ctx.orgId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/integrations");
  return { ok: true, message: "Webhook deleted." };
}

// ---------------------------------------------------------------- Commerce / Gallery

export async function saveProduct(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();

  const name = String(formData.get("name") ?? "").trim();
  const sku = String(formData.get("sku") ?? "").trim() || null;
  const priceRupees = Number(formData.get("price") ?? 0);
  const stockRaw = formData.get("stock");
  const imageUrl = String(formData.get("image_url") ?? "").trim() || null;

  if (!name) return { ok: false, error: "Product name is required." };
  if (!Number.isFinite(priceRupees) || priceRupees < 0) {
    return { ok: false, error: "Price must be a positive number." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("products").insert({
    org_id: orgId,
    name,
    sku,
    price_cents: Math.round(priceRupees * 100),
    stock: stockRaw ? Number(stockRaw) : null,
    image_url: imageUrl,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "That SKU already exists." };
    return { ok: false, error: error.message };
  }

  revalidatePath("/commerce");
  return { ok: true, message: "Product added." };
}

export async function deleteProduct(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", String(formData.get("id") ?? ""))
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/commerce");
  return { ok: true, message: "Product deleted." };
}

export async function saveMediaAsset(formData: FormData): Promise<ActionResult> {
  const { orgId, user } = await requireOrg();

  const name = String(formData.get("name") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const mediaType = String(formData.get("media_type") ?? "image");

  if (!name) return { ok: false, error: "Name is required." };
  if (!/^https:\/\//i.test(url)) return { ok: false, error: "The URL must start with https://" };

  const supabase = await createClient();
  const { error } = await supabase.from("media_assets").insert({
    org_id: orgId,
    name,
    url,
    media_type: mediaType as "image" | "video" | "document" | "audio",
    uploaded_by: user.id,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/gallery");
  return { ok: true, message: "Media added." };
}

export async function deleteMediaAsset(formData: FormData): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  const supabase = await createClient();
  const { error } = await supabase
    .from("media_assets")
    .delete()
    .eq("id", String(formData.get("id") ?? ""))
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/gallery");
  return { ok: true, message: "Media deleted." };
}

export async function saveFlowGraph(input: {
  id: string;
  name: string;
  isActive: boolean;
  nodes: FlowNode[];
  edges: FlowEdge[];
}): Promise<ActionResult> {
  const ctx = await requireOrg();

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Bot name is required." };

  // The entry node is stored rather than inferred: a graph can have several
  // trigger nodes while the canvas is being reorganised, and the runtime
  // needs one answer.
  const entry = input.nodes.find((n) => n.kind === "on_message") ?? input.nodes[0];

  const supabase = await createClient();
  const { error } = await supabase
    .from("chatbot_flows")
    .update({
      name,
      is_active: input.isActive,
      nodes: input.nodes,
      edges: input.edges,
      entry_node_id: entry?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .eq("org_id", ctx.orgId);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Another active bot already uses that trigger." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/chatbot");
  revalidatePath(`/chatbot/${input.id}`);
  return {
    ok: true,
    message: input.isActive ? "Saved and active." : "Saved as draft.",
  };
}

export async function createFlow(): Promise<ActionResult & { id?: string }> {
  const ctx = await requireOrg();
  const supabase = await createClient();

  // A new bot opens with a trigger already placed. An empty canvas gives no
  // hint that a flow must start from one.
  const triggerId = `on_message_${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from("chatbot_flows")
    .insert({
      org_id: ctx.orgId,
      name: "Untitled bot",
      trigger_type: "keyword",
      nodes: [
        {
          id: triggerId,
          kind: "on_message",
          position: { x: 120, y: 180 },
          data: { keywords: [], fuzzy: false, sensitivity: 80 },
        },
      ],
      edges: [],
      entry_node_id: triggerId,
      is_active: false,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/chatbot");
  return { ok: true, id: data.id, message: "Bot created." };
}
