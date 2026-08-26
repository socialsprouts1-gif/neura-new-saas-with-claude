"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/org";
import { NODE_DEFS, type FlowEdge, type FlowNode } from "@/types/flow";
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
  const id = String(formData.get("id") ?? "");

  // Read the object key before deleting the row — afterwards there is
  // nothing left to tell us which file to remove.
  const { data: asset } = await supabase
    .from("media_assets")
    .select("storage_path")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();

  const { error } = await supabase
    .from("media_assets")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };

  // Only files we uploaded. An asset added by pasting someone else's URL has
  // no storage_path and nothing of ours to clean up.
  if (asset?.storage_path) {
    const { error: storageError } = await supabase.storage
      .from("media")
      .remove([asset.storage_path]);
    // The row is already gone, so a failure here leaks a file rather than
    // breaking the delete. Worth logging, not worth failing.
    if (storageError) console.error("Deleted media row but not its file", storageError);
  }

  revalidatePath("/gallery");
  return { ok: true, message: "Media deleted." };
}

/**
 * Records a file the browser has already uploaded to the media bucket.
 *
 * The upload itself does not come through here: Vercel caps a serverless
 * request body at 4.5 MB, which is smaller than a phone photo, so the client
 * puts the file in storage directly and then calls this to make it visible.
 */
export async function recordUploadedMedia(input: {
  name: string;
  url: string;
  storagePath: string;
  mediaType: "image" | "video" | "document" | "audio";
  mimeType: string | null;
  sizeBytes: number | null;
}): Promise<ActionResult> {
  const { orgId, user } = await requireOrg();

  const name = input.name.trim();
  if (!name) return { ok: false, error: "The file needs a name." };

  // The client chose this path, so check it belongs to the caller's org
  // rather than trusting it. Storage RLS enforces the same rule, but a row
  // pointing at another tenant's object would still be wrong.
  if (!input.storagePath.startsWith(`${orgId}/`)) {
    return { ok: false, error: "That file does not belong to this workspace." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("media_assets").insert({
    org_id: orgId,
    name,
    url: input.url,
    storage_path: input.storagePath,
    media_type: input.mediaType,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    uploaded_by: user.id,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/gallery");
  return { ok: true, message: `Uploaded ${name}.` };
}

/**
 * Deletes several assets at once, for the gallery's multi-select.
 */
export async function deleteMediaAssets(ids: string[]): Promise<ActionResult> {
  const { orgId } = await requireOrg();
  if (ids.length === 0) return { ok: false, error: "Nothing selected." };

  const supabase = await createClient();

  const { data: assets } = await supabase
    .from("media_assets")
    .select("storage_path")
    .in("id", ids)
    .eq("org_id", orgId);

  const { error } = await supabase
    .from("media_assets")
    .delete()
    .in("id", ids)
    .eq("org_id", orgId);

  if (error) return { ok: false, error: error.message };

  const paths = (assets ?? [])
    .map((a) => a.storage_path)
    .filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from("media").remove(paths);
    if (storageError) console.error("Deleted media rows but not their files", storageError);
  }

  revalidatePath("/gallery");
  return { ok: true, message: `Deleted ${ids.length} item${ids.length === 1 ? "" : "s"}.` };
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

/**
 * A working example flow, not an empty canvas.
 *
 * The fastest way to understand what the builder can do is to open something
 * that already runs: a keyword trigger, a button message, and a branch per
 * button — including a handoff, which is the outlet people most often forget
 * to wire and then wonder why "talk to a human" does nothing.
 */
export async function createStarterFlow(): Promise<ActionResult & { id?: string }> {
  const ctx = await requireOrg();
  const supabase = await createClient();

  const stamp = Date.now().toString(36);
  const trigger = `on_message_${stamp}`;
  const greet = `send_buttons_${stamp}`;
  const services = `send_text_${stamp}`;
  const human = `handoff_${stamp}`;
  const bye = `send_text_bye_${stamp}`;

  const buttons = [
    { id: `btn_more_${stamp}`, title: "Tell me more" },
    { id: `btn_human_${stamp}`, title: "Talk to a human" },
    { id: `btn_no_${stamp}`, title: "Not now" },
  ];

  const nodes: FlowNode[] = [
    {
      id: trigger,
      kind: "on_message",
      position: { x: 80, y: 220 },
      data: { keywords: ["hi", "hey", "hello"], fuzzy: true, sensitivity: 80 },
    },
    {
      id: greet,
      kind: "send_buttons",
      position: { x: 420, y: 180 },
      data: {
        body: "Hi! Thanks for getting in touch. What can I help you with?",
        footer: "",
        buttons,
      },
    },
    {
      id: services,
      kind: "send_text",
      position: { x: 820, y: 60 },
      data: { body: "Here is what we do — tell me which part interests you and I'll go deeper." },
    },
    {
      id: human,
      kind: "handoff",
      position: { x: 820, y: 240 },
      data: { body: "Of course — putting you through to the team now." },
    },
    {
      id: bye,
      kind: "send_text",
      position: { x: 820, y: 400 },
      data: { body: "No problem. Message us any time." },
    },
  ];

  const edges: FlowEdge[] = [
    { id: `e_trigger_${stamp}`, source: trigger, target: greet, sourceHandle: null },
    { id: `e_more_${stamp}`, source: greet, target: services, sourceHandle: buttons[0].id },
    { id: `e_human_${stamp}`, source: greet, target: human, sourceHandle: buttons[1].id },
    { id: `e_no_${stamp}`, source: greet, target: bye, sourceHandle: buttons[2].id },
  ];

  const { data, error } = await supabase
    .from("chatbot_flows")
    .insert({
      org_id: ctx.orgId,
      name: "Example bot",
      trigger_type: "keyword",
      nodes,
      edges,
      entry_node_id: trigger,
      // Draft on purpose: dropping an example bot into live traffic without
      // the owner reading it first is not a favour.
      is_active: false,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/chatbot");
  return { ok: true, id: data.id, message: "Example bot created as a draft. Open it and read it before publishing." };
}

/**
 * Recreates a flow from the JSON that the row menu exports.
 *
 * Deliberately strict about shape but forgiving about extras: a file from a
 * later version of the builder should still import, minus anything this
 * version does not understand.
 */
export async function importFlow(raw: string): Promise<ActionResult & { id?: string }> {
  const ctx = await requireOrg();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "That is not valid JSON. Export a bot first to see the expected shape." };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "That file does not describe a bot." };
  }

  const source = parsed as { name?: unknown; nodes?: unknown; edges?: unknown };
  const nodes = Array.isArray(source.nodes) ? (source.nodes as FlowNode[]) : null;
  if (!nodes || nodes.length === 0) {
    return { ok: false, error: "That file has no nodes, so there is nothing to import." };
  }

  const known = new Set(NODE_DEFS.map((d) => d.kind));
  const unknown = nodes.find((n) => !n || typeof n !== "object" || !known.has(n.kind));
  if (unknown) {
    return {
      ok: false,
      error: `This file contains a node type this version does not know${
        unknown.kind ? ` ("${unknown.kind}")` : ""
      }.`,
    };
  }

  const edges = Array.isArray(source.edges) ? (source.edges as FlowEdge[]) : [];
  const entry = nodes.find((n) => n.kind === "on_message") ?? nodes[0];
  const name = typeof source.name === "string" && source.name.trim() ? source.name.trim() : "Imported bot";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chatbot_flows")
    .insert({
      org_id: ctx.orgId,
      name,
      trigger_type: "keyword",
      nodes,
      edges,
      entry_node_id: entry?.id ?? null,
      // Never import straight into live traffic.
      is_active: false,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/chatbot");
  return { ok: true, id: data.id, message: `Imported "${name}" as a draft.` };
}
