// Types for the portal modules
// (supabase/migrations/20260820180000_portal_modules.sql).
//
// Declared as type aliases rather than interfaces: supabase-js constrains
// table Row/Insert/Update to Record<string, unknown>, and an interface has
// no implicit index signature, which silently degrades every query on the
// table to `never`.

export type AiAssistant = {
  id: string;
  org_id: string;
  name: string;
  role: string;
  model: string;
  system_prompt: string;
  temperature: number;
  handoff_keywords: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

import type { FlowEdge, FlowNode } from "./flow";

export type ChatbotTrigger = "keyword" | "welcome" | "fallback" | "menu" | "business_hours";

/**
 * The pre-builder node shape: a single reply with optional button labels,
 * stored flat. Flows created before the visual builder still hold these, and
 * the builder page migrates them on open rather than in a data migration —
 * a graph position is a UI concern and cannot be chosen in SQL.
 */
export type LegacyChatbotNode = {
  id: string;
  type: string;
  body: string;
  buttons?: string[];
  next?: string | null;
  /**
   * Branching: maps a quick-reply button's label to the node it leads to.
   * The simple builder does not author this — a flow without it sends one
   * node and lets the tapped label fall through to ordinary matching.
   */
  button_next?: Record<string, string>;
};

export type ChatbotFlow = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  trigger_type: ChatbotTrigger;
  trigger_value: string | null;
  nodes: FlowNode[];
  edges: FlowEdge[];
  entry_node_id: string | null;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
};

export type FaqEntry = {
  id: string;
  org_id: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string | null;
  hit_count: number;
  is_active: boolean;
  created_at: string;
};

export type ReminderStatus = "pending" | "sent" | "cancelled" | "failed";

export type Reminder = {
  id: string;
  org_id: string;
  contact_id: string | null;
  created_by: string | null;
  title: string;
  body: string | null;
  remind_at: string;
  status: ReminderStatus;
  created_at: string;
};

export type IntegrationStatus = "connected" | "disconnected" | "error" | "pending";

export type OrgIntegration = {
  id: string;
  org_id: string;
  provider: string;
  status: IntegrationStatus;
  credentials_encrypted: string | null;
  config: Record<string, string>;
  last_error: string | null;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiKey = {
  id: string;
  org_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  created_by: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type OutgoingWebhook = {
  id: string;
  org_id: string;
  name: string;
  target_url: string;
  events: string[];
  secret: string;
  is_active: boolean;
  created_at: string;
};

export type WebhookDelivery = {
  id: string;
  webhook_id: string;
  org_id: string;
  event: string;
  status_code: number | null;
  error: string | null;
  created_at: string;
};

export type MediaAsset = {
  id: string;
  org_id: string;
  name: string;
  url: string;
  media_type: "image" | "video" | "document" | "audio";
  mime_type: string | null;
  size_bytes: number | null;
  /**
   * Object key in the media bucket. Null when the asset was added by pasting
   * an external URL — we do not own that file and must not try to delete it.
   */
  storage_path: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  org_id: string;
  name: string;
  sku: string | null;
  description: string | null;
  price_cents: number;
  currency: string;
  image_url: string | null;
  stock: number | null;
  is_active: boolean;
  created_at: string;
};

// Models offered when creating an AI assistant. Kept here so the option list
// and the stored value can never drift apart.
export const ASSISTANT_MODELS = [
  { value: "claude-opus-5", label: "Claude Opus 5 — most capable" },
  { value: "claude-sonnet-5", label: "Claude Sonnet 5 — balanced" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — fastest" },
] as const;

// --- message runner -------------------------------------------------------

export type BotMatchKind =
  | "flow_step"
  | "chatbot"
  | "faq"
  | "automation"
  | "assistant"
  | "handoff"
  | "none";

export type BotRunOutcome = "replied" | "skipped" | "handoff" | "failed";

export type BotRun = {
  id: string;
  org_id: string;
  conversation_id: string | null;
  contact_id: string | null;
  inbound_wa_message_id: string | null;
  inbound_text: string | null;
  matched_kind: BotMatchKind;
  matched_id: string | null;
  matched_label: string | null;
  node_id: string | null;
  node_kind: string | null;
  reply_text: string | null;
  outcome: BotRunOutcome;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
};

// --- manage workspace -----------------------------------------------------

export type CannedMessage = {
  id: string;
  org_id: string;
  shortcut: string;
  title: string;
  body: string;
  use_count: number;
  created_at: string;
};

export type ContactGroup = {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  colour: string;
  created_at: string;
};

export type ContactGroupMember = {
  group_id: string;
  contact_id: string;
  org_id: string;
  added_at: string;
};

export type ContactColumnType = "text" | "number" | "date" | "select" | "boolean";

export type ContactColumn = {
  id: string;
  org_id: string;
  key: string;
  label: string;
  field_type: ContactColumnType;
  options: string[];
  created_at: string;
};

export const COLUMN_TYPES: { value: ContactColumnType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Choice" },
  { value: "boolean", label: "Yes / No" },
];
